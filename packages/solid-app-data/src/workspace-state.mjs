import { local } from '@muze-labs/solid-workspace';
import { oldm, prefixes, valueAt, httpUrl, loadDocument,
  copyDocument, requireOk } from './index.mjs';
import { serializable } from './capabilities.mjs';

const jsonType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#JSON';
const predicate = prefixes.apps + 'snapshot';
const localId = 'urn:muze:solid-apps:workspace:cache';
function conflictError() {
  const error = new Error(
    'workspace-state: Pod conflict; local state is retained. Review both versions.'
  );
  error.code = 'workspace-conflict';
  return error;
}
function textOf(value) {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
    }
    return item;
  });
}
export const emptyWorkspace = () => ({ version: 1, apps: [], launcher: {} });
export function validateWorkspace(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.apps) ||
    value.apps.length > 100) {
    throw new Error('workspace-state: Unsupported workspace snapshot.');
  }
  const ids = new Set();
  for (const entry of value.apps) {
    if (!entry || typeof entry.id !== 'string' || ids.has(entry.id) ||
      typeof entry.url !== 'string' || typeof entry.allowBrowse !== 'boolean') {
      throw new Error('workspace-state: Invalid or duplicate app instance.');
    }
    httpUrl(entry.url);
    serializable(entry.state);
    ids.add(entry.id);
  }
  return structuredClone(value);
}
function readJSON(graph, subject) {
  const node = graph.get(subject);
  let value = valueAt(node, predicate);
  if (value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length !== 1) {
      throw new Error('workspace-state: Snapshot has multiple values.');
    }
    value = value[0];
  }
  if (!(value instanceof String) || String(value.type) !== jsonType ||
    value.language) {
    throw new Error('workspace-state: Snapshot must be one RDF JSON literal.');
  }
  try {
    return JSON.parse(String(value));
  }
  catch {
    throw new Error('workspace-state: Snapshot contains invalid JSON.');
  }
}
function setJSON(graph, subject, value) {
  graph.set(subject, predicate, oldm.literal(JSON.stringify(value), {
    type: jsonType
  }));
}

export class WorkspaceState {
  constructor({ owner = '', source, indexedDBFactory, onStatus = () => {} } = {}) {
    this.owner = owner;
    this.factory = indexedDBFactory;
    this.source = source || this.localSource(owner);
    this.onStatus = onStatus;
    this.snapshot = emptyWorkspace();
    this.keys = {};
    this.dirty = false;
    this.baseETag = null;
    this.baseSnapshotText = null;
    this.baseUrl = null;
    this.needsValidatorRefresh = false;
    this.work = Promise.resolve();
  }
  localSource(owner) {
    return local.indexedDB('solid-apps-managed-workspaces', {
      key: owner || 'anonymous', indexedDB: this.factory
    });
  }
  async open() {
    const text = await this.source.load();
    this.localGraph = oldm.context({ prefixes }).parse(text,
      'https://workspace.invalid/', 'text/turtle');
    const saved = readJSON(this.localGraph, localId);
    if (saved) {
      this.snapshot = validateWorkspace(saved.snapshot);
      this.keys = saved.keys || {};
      this.baseETag = saved.baseETag || null;
      this.baseSnapshotText = saved.baseSnapshotText || null;
      this.baseUrl = saved.baseUrl || null;
      this.dirty = Boolean(saved.dirty);
    }
    return this.snapshot;
  }
  async persist() {
    setJSON(this.localGraph, localId, { snapshot: this.snapshot,
      keys: this.keys, baseETag: this.baseETag,
      baseSnapshotText: this.baseSnapshotText, baseUrl: this.baseUrl,
      dirty: this.dirty });
    await this.source.save(await this.localGraph.write());
  }
  stage(snapshot, keys = this.keys) {
    const next = validateWorkspace({ ...snapshot, owner: this.owner });
    this.dirty ||= textOf(next) !== textOf(this.snapshot);
    this.snapshot = next;
    this.keys = { ...keys };
    this.work = this.work.catch(() => {}).then(async () => {
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
      throw new Error('workspace-state: Reopen Launcher to switch workspace accounts.');
    }
    if (!this.owner) {
      const source = this.localSource(session.webId);
      const existing = await source.load();
      if (existing && this.snapshot.apps.length) {
        throw new Error('workspace-state: This account has a saved workspace. Reopen Launcher first.');
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
      this.baseSnapshotText = null;
    }
    this.session = session;
    this.url = url;
    this.document = null;
    this.prepared = null;
    this.reviewedDocument = null;
    const document = await loadDocument(session.client, url, { allowMissing: true });
    const remote = readJSON(document.graph, url + '#workspace');
    if (remote) {
      validateWorkspace(remote);
      if (remote.owner && remote.owner !== session.webId) {
        throw new Error('workspace-state: Pod workspace belongs to another WebID.');
      }
    }
    const equal = remote && textOf(remote) === textOf(this.snapshot);
    const remoteText = remote ? textOf(remote) : null;
    const sameBaseline = this.baseUrl === url && this.baseSnapshotText !== null &&
      remoteText === this.baseSnapshotText;
    this.conflict = Boolean(remote && (this.dirty || forWrite) && !equal &&
      document.etag !== this.baseETag && !sameBaseline);
    if (this.conflict) {
      this.dirty = true;
    }
    if (!this.dirty && !forWrite && remote) {
      const previous = new Map(this.snapshot.apps.map(entry => [entry.id, entry.url]));
      this.keys = Object.fromEntries(remote.apps.filter(entry =>
        previous.get(entry.id) === entry.url && this.keys[entry.id])
        .map(entry => [entry.id, this.keys[entry.id]]));
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
      this.baseSnapshotText = remoteText;
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
    return { local: structuredClone(this.snapshot),
      remote: structuredClone(this.remoteSnapshot) };
  }
  async resolveConflict(session, url, choice) {
    await this.work;
    if (!this.conflict || !this.reviewedDocument ||
      this.reviewedDocument !== this.document || session.webId !== this.owner ||
      url !== this.url || !['local', 'pod'].includes(choice)) {
      throw new Error('workspace-state: Review the current Pod conflict first.');
    }
    if (choice === 'pod') {
      if (!this.remoteSnapshot) {
        throw new Error('workspace-state: No saved Pod workspace is available.');
      }
      const previous = new Map(this.snapshot.apps.map(entry =>
        [entry.id, entry.url]));
      this.snapshot = validateWorkspace(this.remoteSnapshot);
      this.keys = Object.fromEntries(this.snapshot.apps.filter(entry =>
        previous.get(entry.id) === entry.url && this.keys[entry.id])
        .map(entry => [entry.id, this.keys[entry.id]]));
    }
    this.conflict = false;
    this.reviewedDocument = null;
    this.baseETag = this.document.etag;
    this.baseSnapshotText = this.remoteSnapshot
      ? textOf(this.remoteSnapshot) : null;
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
      throw new Error('workspace-state: Pod GET supplied no ETag for a safe ' +
        'write at ' + this.url + '. Check that GET returns and exposes ETag. ' +
        'Local state is retained; Close locally remains available.');
    }
    const draft = await copyDocument(this.document);
    setJSON(draft.graph, this.url + '#workspace', this.snapshot);
    this.prepared = { draft, body: await draft.graph.write(),
      snapshotText: textOf(this.snapshot), url: this.url,
      owner: this.owner,
      headers: { 'Content-Type': 'text/turtle',
        [draft.missing ? 'If-None-Match' : 'If-Match']:
          draft.missing ? '*' : draft.etag } };
  }
  checkTarget(session, url) {
    if (session?.webId !== this.owner || url !== this.url || !this.prepared ||
      this.prepared.owner !== this.owner || this.prepared.url !== url ||
      this.prepared.snapshotText !== textOf(this.snapshot)) {
      throw new Error('workspace-state: Connect and load this workspace target before saving.');
    }
  }
  async save(session, url) {
    await this.work;
    if (this.needsValidatorRefresh) {
      if (session?.webId !== this.owner || url !== this.url) {
        throw new Error('workspace-state: Connect and load this workspace ' +
          'target before saving.');
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
      headers: prepared.headers, body: prepared.body
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
    this.document = { ...prepared.draft, missing: false,
      etag: response.headers.get('ETag') };
    this.baseETag = this.document.etag;
    this.baseSnapshotText = prepared.snapshotText;
    this.needsValidatorRefresh = !this.document.etag;
    this.dirty = prepared.snapshotText !== textOf(this.snapshot);
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
      session.perform(() => session.client.put(url, {
        headers: prepared.headers, body: prepared.body, keepalive: true
      }), { interactive: false }).catch(() => {});
    }
    catch (error) {
      result = error.message;
    }
    try {
      localStorage.setItem('solid-apps.workspace-exit', JSON.stringify({
        owner: this.owner, url, time: new Date().toISOString(), result
      }));
    }
    catch {}
  }
}
