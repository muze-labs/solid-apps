import { local } from '@muze-labs/solid-workspace';
import { httpUrl, requireOk } from './index.mjs';
import { StateGraph } from './state-rdf.mjs';
import { validateAppState } from './app-state.mjs';
import {
  readWorkspace,
  writeWorkspace,
  readCache,
  writeCache,
  sameWorkspace
} from './workspace-rdf.mjs';

function conflictError() {
  const error = new Error(
    'workspace-state: Pod conflict; local state is retained. Review both versions.'
  );
  error.code = 'workspace-conflict';
  return error;
}
export const emptyWorkspace = () => ({ version: 2, apps: [], launcher: {} });
export function validateWorkspace(value) {
  if (
    !value ||
    value.version !== 2 ||
    !Array.isArray(value.apps) ||
    value.apps.length > 100
  ) {
    throw new Error('workspace-state: Unsupported workspace snapshot.');
  }
  if (
    Object.keys(value).some(
      (key) => !['version', 'apps', 'launcher', 'owner'].includes(key)
    ) ||
    !value.launcher ||
    typeof value.launcher !== 'object' ||
    Object.keys(value.launcher).some((key) => key !== 'resource') ||
    (value.launcher.resource !== undefined &&
      typeof value.launcher.resource !== 'string')
  ) {
    throw new Error('workspace-state: Unsupported workspace fields.');
  }
  const ids = new Set();
  for (const entry of value.apps) {
    if (
      !entry ||
      typeof entry.id !== 'string' ||
      ids.has(entry.id) ||
      typeof entry.url !== 'string' ||
      typeof entry.allowBrowse !== 'boolean' ||
      (entry.label !== undefined && typeof entry.label !== 'string') ||
      Object.keys(entry).some(
        (key) => !['id', 'url', 'label', 'allowBrowse', 'state'].includes(key)
      )
    ) {
      throw new Error('workspace-state: Invalid or duplicate app instance.');
    }
    httpUrl(entry.url);
    validateAppState(entry.state);
    ids.add(entry.id);
  }
  return structuredClone(value);
}
export class WorkspaceState {
  constructor({
    owner = '',
    source,
    indexedDBFactory,
    onStatus = () => {}
  } = {}) {
    this.owner = owner;
    this.factory = indexedDBFactory;
    this.source = source || this.localSource(owner);
    this.onStatus = onStatus;
    this.snapshot = emptyWorkspace();
    this.keys = {};
    this.dirty = false;
    this.baseETag = null;
    this.baseSnapshot = null;
    this.baseUrl = null;
    this.needsValidatorRefresh = false;
    this.work = Promise.resolve();
  }
  localSource(owner) {
    return local.indexedDB('solid-apps-managed-workspaces-native', {
      key: owner || 'anonymous',
      indexedDB: this.factory
    });
  }
  async open() {
    const text = await this.source.load();
    this.localGraph = new StateGraph(text, 'https://workspace.invalid/');
    const saved = readCache(this.localGraph);
    if (saved) {
      this.snapshot = validateWorkspace(saved.snapshot);
      this.keys = saved.keys || {};
      this.baseETag = saved.baseETag || null;
      this.baseSnapshot = saved.baseSnapshot || null;
      this.baseUrl = saved.baseUrl || null;
      this.dirty = Boolean(saved.dirty);
    }
    return this.snapshot;
  }
  async persist() {
    writeCache(this.localGraph, {
      snapshot: this.snapshot,
      keys: this.keys,
      baseETag: this.baseETag,
      baseSnapshot: this.baseSnapshot,
      baseUrl: this.baseUrl,
      dirty: this.dirty
    });
    await this.source.save(this.localGraph.write());
  }
  stage(snapshot, keys = this.keys) {
    const next = validateWorkspace({ ...snapshot, owner: this.owner });
    this.dirty ||= !sameWorkspace(next, this.snapshot);
    this.snapshot = next;
    this.keys = { ...keys };
    this.work = this.work
      .catch(() => {})
      .then(async () => {
        await this.persist();
        try {
          await this.prepare();
        }
        catch (error) {
          this.onStatus(error.message);
        }
      });
    return this.work;
  }
  async bind(session, url, { forWrite = false } = {}) {
    await this.work;
    if (this.owner && session.webId !== this.owner) {
      throw new Error(
        'workspace-state: Reopen Launcher to switch workspace accounts.'
      );
    }
    if (!this.owner) {
      const source = this.localSource(session.webId);
      const existing = await source.load();
      if (existing && this.snapshot.apps.length) {
        throw new Error(
          'workspace-state: This account has a saved workspace. Reopen Launcher first.'
        );
      }
      this.owner = session.webId;
      this.source = source;
      if (existing) {
        await this.open();
      }
      this.snapshot.owner = this.owner;
    }
    url = httpUrl(url);
    const previousTarget = this.url || this.baseUrl;
    const changedTarget = previousTarget && previousTarget !== url;
    if (changedTarget) {
      this.baseETag = null;
      this.baseSnapshot = null;
    }
    this.session = session;
    this.url = url;
    this.document = null;
    this.prepared = null;
    this.reviewedDocument = null;
    const response = await session.client.get(url, {
      headers: { Accept: 'text/turtle' }
    });
    const missing = response.status === 404;
    if (!missing) {
      requireOk(response);
    }
    const document = {
      url,
      missing,
      etag: response.headers.get('ETag'),
      graph: new StateGraph(missing ? '' : await response.text(), url)
    };
    const remote = readWorkspace(document.graph, url + '#workspace');
    if (remote) {
      validateWorkspace(remote);
      if (remote.owner && remote.owner !== session.webId) {
        throw new Error(
          'workspace-state: Pod workspace belongs to another WebID.'
        );
      }
    }
    const equal = remote && sameWorkspace(remote, this.snapshot);
    const remoteSnapshot = remote ? structuredClone(remote) : null;
    const sameBaseline =
      this.baseUrl === url &&
      this.baseSnapshot !== null &&
      sameWorkspace(remoteSnapshot, this.baseSnapshot);
    this.conflict = Boolean(
      remote &&
        (this.dirty || forWrite) &&
        !equal &&
        document.etag !== this.baseETag &&
        !sameBaseline
    );
    if (this.conflict) {
      this.dirty = true;
    }
    if (!this.dirty && !forWrite && remote) {
      const previous = new Map(
        this.snapshot.apps.map((entry) => [entry.id, entry.url])
      );
      this.keys = Object.fromEntries(
        remote.apps
          .filter(
            (entry) =>
              previous.get(entry.id) === entry.url && this.keys[entry.id]
          )
          .map((entry) => [entry.id, this.keys[entry.id]])
      );
      this.snapshot = remote;
    }
    if (equal) {
      this.dirty = false;
    }
    this.document = document;
    this.baseUrl = url;
    this.needsValidatorRefresh = false;
    this.remoteSnapshot = remote;
    if (!this.conflict) {
      this.baseETag = document.etag;
      this.baseSnapshot = remoteSnapshot;
    }
    await this.persist();
    await this.prepare();
    if (this.conflict) {
      throw conflictError();
    }
    return this.snapshot;
  }
  async reviewConflict(session, url) {
    try {
      await this.bind(session, url, { forWrite: true });
    }
    catch (error) {
      if (error.code !== 'workspace-conflict') {
        throw error;
      }
    }
    this.reviewedDocument = this.document;
    return {
      local: structuredClone(this.snapshot),
      remote: structuredClone(this.remoteSnapshot)
    };
  }
  async resolveConflict(session, url, choice) {
    await this.work;
    if (
      !this.conflict ||
      !this.reviewedDocument ||
      this.reviewedDocument !== this.document ||
      session.webId !== this.owner ||
      url !== this.url ||
      !['local', 'pod'].includes(choice)
    ) {
      throw new Error(
        'workspace-state: Review the current Pod conflict first.'
      );
    }
    if (choice === 'pod') {
      if (!this.remoteSnapshot) {
        throw new Error(
          'workspace-state: No saved Pod workspace is available.'
        );
      }
      const previous = new Map(
        this.snapshot.apps.map((entry) => [entry.id, entry.url])
      );
      this.snapshot = validateWorkspace(this.remoteSnapshot);
      this.keys = Object.fromEntries(
        this.snapshot.apps
          .filter(
            (entry) =>
              previous.get(entry.id) === entry.url && this.keys[entry.id]
          )
          .map((entry) => [entry.id, this.keys[entry.id]])
      );
    }
    this.conflict = false;
    this.reviewedDocument = null;
    this.baseETag = this.document.etag;
    this.baseSnapshot = this.remoteSnapshot
      ? structuredClone(this.remoteSnapshot)
      : null;
    this.dirty = choice === 'local';
    await this.persist();
    await this.prepare();
  }
  async prepare() {
    this.prepared = null;
    if (!this.document || this.conflict || this.needsValidatorRefresh) {
      return;
    }
    if (!this.document.missing && !this.document.etag) {
      throw new Error(
        'workspace-state: Pod GET supplied no ETag for a safe ' +
          'write at ' +
          this.url +
          '. Check that GET returns and exposes ETag. ' +
          'Local state is retained; Close locally remains available.'
      );
    }
    const draft = {
      ...this.document,
      graph: new StateGraph(this.document.graph.write(), this.url)
    };
    const snapshot = structuredClone(this.snapshot);
    writeWorkspace(draft.graph, this.url + '#workspace', snapshot);
    this.prepared = {
      draft,
      body: draft.graph.write(),
      snapshot,
      url: this.url,
      owner: this.owner,
      headers: {
        'Content-Type': 'text/turtle',
        [draft.missing ? 'If-None-Match' : 'If-Match']: draft.missing
          ? '*'
          : draft.etag
      }
    };
  }
  checkTarget(session, url) {
    if (
      session?.webId !== this.owner ||
      url !== this.url ||
      !this.prepared ||
      this.prepared.owner !== this.owner ||
      this.prepared.url !== url ||
      !sameWorkspace(this.prepared.snapshot, this.snapshot)
    ) {
      throw new Error(
        'workspace-state: Connect and load this workspace target before saving.'
      );
    }
  }
  async save(session, url) {
    await this.work;
    if (this.needsValidatorRefresh) {
      if (session?.webId !== this.owner || url !== this.url) {
        throw new Error(
          'workspace-state: Connect and load this workspace ' +
            'target before saving.'
        );
      }
      await this.bind(session, url, { forWrite: true });
    }
    if (this.conflict) {
      throw conflictError();
    }
    await this.prepare();
    this.checkTarget(session, url);
    const prepared = this.prepared;
    const response = await session.client.put(url, {
      headers: prepared.headers,
      body: prepared.body
    });
    if (response.status === 412) {
      this.conflict = true;
      this.reviewedDocument = null;
      this.prepared = null;
      this.dirty = true;
      await this.persist();
      throw conflictError();
    }
    requireOk(response);
    this.document = {
      ...prepared.draft,
      missing: false,
      etag: response.headers.get('ETag')
    };
    this.baseETag = this.document.etag;
    this.baseSnapshot = prepared.snapshot;
    this.needsValidatorRefresh = !this.document.etag;
    this.dirty = !sameWorkspace(prepared.snapshot, this.snapshot);
    await this.persist();
    await this.prepare();
    return !this.dirty;
  }
  attemptExit(session, url) {
    if (!this.dirty || this.skipExit) {
      return;
    }
    let result = 'unconfirmed';
    try {
      this.checkTarget(session, url);
      const prepared = this.prepared;
      if (new TextEncoder().encode(prepared.body).byteLength > 60000) {
        throw new Error('workspace-state: Too large for a background save.');
      }
      session
        .perform(
          () =>
            session.client.put(url, {
              headers: prepared.headers,
              body: prepared.body,
              keepalive: true
            }),
          { interactive: false }
        )
        .catch(() => {});
    }
    catch (error) {
      result = error.message;
    }
    try {
      localStorage.setItem(
        'solid-apps.workspace-exit',
        JSON.stringify({
          owner: this.owner,
          url,
          time: new Date().toISOString(),
          result
        })
      );
    }
    catch {}
  }
}
