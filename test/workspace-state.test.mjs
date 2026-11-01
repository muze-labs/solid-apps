import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceState, emptyWorkspace } from '../packages/solid-app-data/src/workspace-state.mjs';
import { oldm, prefixes } from '../packages/solid-app-data/src/index.mjs';
import { StateGraph, apps, stateRoot, named } from '../packages/solid-app-data/src/state-rdf.mjs';
import { readWorkspace, writeWorkspace, sameWorkspace } from '../packages/solid-app-data/src/workspace-rdf.mjs';
const owner = 'https://person.example/profile#me';
const url = 'https://pod.example/workspace.ttl';
function fixture(turtle = '<#other> <https://example.org/value> [<https://example.org/label> "keep"].') {
  let cached = '';
  let written;
  let fail = false;
  let etag = '"v1"';
  const source = { load: async () => cached, save: async text => { cached = text; } };
  const session = { webId: owner, perform: fn => fn(), client: {
    get: async () => new Response(turtle, { headers: etag ? { ETag: etag } : {} }),
    put: async (_url, options) => {
      written = options;
      if (fail) { return new Response(null, { status: 412 }); }
      return new Response(null, { status: 204, headers: { ETag: '"v2"' } });
    }
  } };
  const state = new WorkspaceState({ owner, source });
  return { state, session, source, written: () => written,
    conflict: (value = true) => { fail = value; },
    remote: (text, tag) => { turtle = text; etag = tag; } };
}
const snapshot = () => ({ ...emptyWorkspace(), apps: [{ id: 'one',
  url: 'https://files.example/', allowBrowse: true,
  state: { turtle: '<' + stateRoot + '> <' + apps + 'folder> <https://pod.example/>; <https://example.org/unknown> \"preserve\".' } }] });

test('local updates do not write the Pod; a conditional checkpoint preserves native RDF', async () => {
  const { state, session, written } = fixture();
  await state.open();
  await state.bind(session, url);
  await state.stage(snapshot(), { one: 'private-reconnect-key' });
  assert.equal(written(), undefined);
  assert.equal(await state.save(session, url), true);
  assert.equal(written().headers['If-Match'], '"v1"');
  assert(!written().body.includes('private-reconnect-key'));
  const graph = oldm.context({ prefixes }).parse(written().body, url, 'text/turtle');
  const other = graph.get(url + '#other');
  assert(other);
  assert.match(await graph.write(), /keep/);
  const data = readWorkspace(new StateGraph(written().body, url), url + '#workspace');
  const stateGraph = new StateGraph(data.apps[0].state.turtle);
  assert.equal(stateGraph.one(named(stateRoot),
    'https://example.org/unknown', 'string').value, 'preserve');
  assert.equal(data.owner, owner);
});
test('conflicts and wrong accounts retain pending local state without an unsafe write', async () => {
  const { state, session, source, written, conflict } = fixture();
  await state.open();
  await state.bind(session, url);
  await state.stage(snapshot());
  await assert.rejects(state.save({ ...session, webId: 'https://other.example/#me' },
    url), /Connect and load/);
  assert.equal(written(), undefined);
  conflict();
  await assert.rejects(state.save(session, url),
    error => error.code === 'workspace-conflict');
  assert.equal(state.dirty, true);
  const reloaded = new WorkspaceState({ owner, source });
  await reloaded.open();
  assert.equal(reloaded.snapshot.apps[0].id, 'one');
});
test('unsupported structured/multiple snapshot edits are refused', async () => {
  for (const object of ['[<https://example.org/p> "keep"]', '"x", "y"']) {
    const { state, session, written } = fixture('<#workspace> <' + prefixes.apps +
      'formatVersion> ' + object + '.');
    await state.open();
    await assert.rejects(state.bind(session, url), /Expected one integer/);
    assert.equal(written(), undefined);
  }
});
test('tab-close dispatch uses conditional keepalive and remains unconfirmed locally', async () => {
  const { state, session, written } = fixture();
  await state.open();
  await state.bind(session, url);
  await state.stage(snapshot());
  state.attemptExit(session, url);
  await Promise.resolve();
  assert.equal(written().keepalive, true);
  assert.equal(written().headers['If-Match'], '"v1"');
  assert.equal(state.dirty, true);
});

function remoteTurtle(snapshot, target = url) {
  const graph = new StateGraph('<#other> <https://example.org/value> "preserve remote metadata".', target);
  writeWorkspace(graph, target + '#workspace', snapshot);
  return graph.write();
}

test('reload retains a conflict; explicit review allows a conditional local save', async () => {
  const { state, session, source, remote, conflict, written } = fixture();
  await state.open();
  await state.bind(session, url);
  const local = snapshot();
  await state.stage(local, { one: 'local-key' });
  const pod = { ...snapshot(), owner,
    launcher: { resource: 'https://pod.example/other' } };
  remote(remoteTurtle(pod), '"remote"');
  const reloaded = new WorkspaceState({ owner, source });
  await reloaded.open();
  await assert.rejects(reloaded.bind(session, url),
    error => error.code === 'workspace-conflict');
  await assert.rejects(reloaded.resolveConflict(session, url, 'local'), /Review/);
  const review = await reloaded.reviewConflict(session, url);
  assert.equal(review.remote.launcher.resource, pod.launcher.resource);
  assert.equal(review.local.apps[0].id, 'one');
  assert.equal(written(), undefined);
  await reloaded.resolveConflict(session, url, 'local');
  conflict();
  await assert.rejects(reloaded.save(session, url),
    error => error.code === 'workspace-conflict');
  assert.equal(written().headers['If-Match'], '"remote"');
  await assert.rejects(reloaded.resolveConflict(session, url, 'local'), /Review/);
  conflict(false);
  remote(remoteTurtle({ ...pod,
    launcher: { resource: 'https://pod.example/newer-remote' } }), '"newer"');
  await reloaded.reviewConflict(session, url);
  await reloaded.resolveConflict(session, url, 'local');
  await reloaded.save(session, url);
  assert.equal(written().headers['If-Match'], '"newer"');
  assert.match(written().body, /preserve remote metadata/);
  assert.equal(reloaded.snapshot.launcher.resource, undefined);
  assert.equal(reloaded.keys.one, 'local-key');
});

test('using the reviewed Pod snapshot changes only local restoration state', async () => {
  const { state, session, remote, written } = fixture();
  await state.open();
  await state.bind(session, url);
  await state.stage(snapshot(), { one: 'keep-private' });
  const pod = { ...snapshot(), owner,
    launcher: { resource: 'https://pod.example/reviewed' } };
  remote(remoteTurtle(pod), '"remote"');
  await state.reviewConflict(session, url);
  await state.resolveConflict(session, url, 'pod');
  assert(sameWorkspace(state.snapshot, pod));
  assert.equal(state.dirty, false);
  assert.equal(state.keys.one, 'keep-private');
  assert.equal(written(), undefined);
});

test('remote preparation failure cannot poison local persistence or retries', async () => {
  const { state, session, source, remote } = fixture();
  await state.open();
  remote('<#other> <https://example.org/p> "keep".', null);
  await assert.rejects(state.bind(session, url), /no ETag/);
  await state.stage(snapshot());
  assert.match(await source.load(), /one/);
  remote('<#other> <https://example.org/p> "keep".', '"recovered"');
  await state.bind(session, url);
  assert.equal(await state.save(session, url), true);
});

function withoutWriteValidator() {
  const fixtureData = fixture();
  const { session, remote } = fixtureData;
  let version = 0;
  let reads = 0;
  const get = session.client.get;
  const put = session.client.put;
  session.client.get = async (...args) => { reads++; return get(...args); };
  session.client.put = async (...args) => {
    const response = await put(...args);
    if (response.status !== 204) { return response; }
    version++;
    remote(args[1].body, '"read-' + version + '"');
    return new Response(null, { status: 205 });
  };
  return { ...fixtureData, reads: () => reads };
}

test('205 PUT without ETag acknowledges saving; the next write refreshes its validator', async () => {
  const { state, session, written, reads } = withoutWriteValidator();
  await state.open();
  await state.bind(session, url);
  await state.stage(snapshot());
  assert.equal(await state.save(session, url), true);
  assert.equal(state.dirty, false);
  assert.equal(state.prepared, null);
  assert.equal(state.baseETag, null);
  assert.equal(reads(), 1);
  const next = snapshot();
  next.launcher.resource = 'https://pod.example/new';
  await state.stage(next);
  assert.equal(reads(), 1, 'Local updates must not continuously fetch the Pod.');
  const previous = written();
  state.attemptExit(session, url);
  assert.equal(written(), previous, 'Closure cannot reuse the pre-write ETag.');
  assert.equal(await state.save(session, url), true);
  assert.equal(reads(), 2);
  assert.equal(written().headers['If-Match'], '"read-1"');
  assert.match(written().body, /keep/);
});

test('acknowledged baseline survives reload without hiding real concurrent changes', async () => {
  const { state, session, source, remote, written } = withoutWriteValidator();
  await state.open();
  await state.bind(session, url);
  await state.stage(snapshot());
  await state.save(session, url);
  const pending = snapshot();
  pending.launcher.resource = 'https://pod.example/local-edit';
  await state.stage(pending);
  const reopened = new WorkspaceState({ owner, source });
  await reopened.open();
  await reopened.bind(session, url);
  assert.equal(reopened.conflict, false);
  assert.equal(reopened.snapshot.launcher.resource, pending.launcher.resource);
  assert.equal(await reopened.save(session, url), true);
  assert.equal(written().headers['If-Match'], '"read-1"');
  await reopened.stage({ ...pending, launcher: { resource: 'local-again' } });
  remote(remoteTurtle({ ...pending, owner,
    launcher: { resource: 'https://pod.example/remote-edit' } }), '"external"');
  await assert.rejects(reopened.bind(session, url),
    error => error.code === 'workspace-conflict');
});

test('local edits during an acknowledged PUT remain pending without a false conflict', async () => {
  const { state, session, written } = withoutWriteValidator();
  await state.open();
  await state.bind(session, url);
  await state.stage(snapshot());
  const put = session.client.put;
  const next = snapshot();
  next.launcher.resource = 'https://pod.example/changed-during-save';
  session.client.put = async (...args) => {
    const response = await put(...args);
    await state.stage(next);
    return response;
  };
  assert.equal(await state.save(session, url), false);
  assert.equal(state.dirty, true);
  session.client.put = put;
  assert.equal(await state.save(session, url), true);
  assert.equal(written().headers['If-Match'], '"read-1"');
});

test('unauthorized validator refresh cannot become an empty workspace or unsafe write', async () => {
  const { state, session, written } = withoutWriteValidator();
  await state.open();
  await state.bind(session, url);
  await state.stage(snapshot());
  await state.save(session, url);
  const previous = written();
  const next = snapshot();
  next.launcher.resource = 'https://pod.example/pending';
  await state.stage(next);
  session.client.get = async () => new Response('Not authorized', { status: 401 });
  await assert.rejects(state.save(session, url), /401/);
  assert.equal(written(), previous);
  assert.equal(state.snapshot.launcher.resource, next.launcher.resource);
  assert.equal(state.dirty, true);
});

test('an acknowledged baseline cannot waive conflicts at a different target', async () => {
  const { state, session, remote } = withoutWriteValidator();
  await state.open();
  await state.bind(session, url);
  await state.stage(snapshot());
  await state.save(session, url);
  const next = snapshot();
  next.launcher.resource = 'https://pod.example/local';
  await state.stage(next);
  remote(remoteTurtle({ ...snapshot(), owner },
    'https://pod.example/other-workspace.ttl'), '"other-resource"');
  await assert.rejects(state.bind(session, 'https://pod.example/other-workspace.ttl'),
    error => error.code === 'workspace-conflict');
});

test('refresh during explicit saving cannot silently adopt a concurrent Pod change', async () => {
  const { state, session, remote, written } = withoutWriteValidator();
  await state.open();
  await state.bind(session, url);
  await state.stage(snapshot());
  await state.save(session, url);
  assert.equal(state.dirty, false);
  const previous = written();
  remote(remoteTurtle({ ...snapshot(), owner,
    launcher: { resource: 'https://pod.example/concurrent' } }), '"external"');
  await assert.rejects(state.save(session, url),
    error => error.code === 'workspace-conflict');
  assert.equal(written(), previous);
  assert.equal(state.snapshot.launcher.resource, undefined);
  assert.equal(state.dirty, true);
});

test('an edit during checkpoint preparation cannot be acknowledged with an older body', async () => {
  const { state, session, written } = fixture();
  await state.open();
  await state.bind(session, url);
  await state.stage(snapshot());
  const next = snapshot();
  next.launcher.resource = 'https://pod.example/edit-during-preparation';
  let update;
  const saving = state.save(session, url);
  queueMicrotask(() => { update = state.stage(next); });
  await Promise.allSettled([saving]);
  await update;
  if (!state.dirty) {
    assert(written(), 'Clean state must have a Pod acknowledgement.');
    const acknowledged = readWorkspace(new StateGraph(written().body, url),
      url + '#workspace');
    assert(sameWorkspace(acknowledged, state.snapshot),
      'A clean checkpoint must describe exactly the data acknowledged by PUT.');
  }
  assert.equal(state.snapshot.launcher.resource, next.launcher.resource);
  if (state.dirty) {
    assert.equal(await state.save(session, url), true);
  }
  const acknowledged = readWorkspace(new StateGraph(written().body, url),
    url + '#workspace');
  assert(sameWorkspace(acknowledged, state.snapshot));
});
