import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceState, emptyWorkspace } from '../packages/solid-app-data/src/workspace-state.mjs';
import { oldm, prefixes, valueAt } from '../packages/solid-app-data/src/index.mjs';
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
  state: { folder: 'https://pod.example/', unknown: ['preserve'] } }] });

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
  const data = JSON.parse(String(valueAt(graph.get(url + '#workspace'),
    prefixes.apps + 'snapshot')));
  assert.deepEqual(data.apps[0].state.unknown, ['preserve']);
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
      'snapshot> ' + object + '.');
    await state.open();
    await assert.rejects(state.bind(session, url), /Snapshot/);
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

function remoteTurtle(snapshot) {
  return '<#other> <https://example.org/value> "preserve remote metadata". ' +
    '<#workspace> <' + prefixes.apps + 'snapshot> ' +
    JSON.stringify(JSON.stringify(snapshot)) +
    '^^<http://www.w3.org/1999/02/22-rdf-syntax-ns#JSON>.';
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
  remote(remoteTurtle(pod), '"newer"');
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
  assert.deepEqual(state.snapshot, pod);
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
