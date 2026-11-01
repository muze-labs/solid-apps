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
  const source = { load: async () => cached, save: async text => { cached = text; } };
  const session = { webId: owner, perform: fn => fn(), client: {
    get: async () => new Response(turtle, { headers: { ETag: '"v1"' } }),
    put: async (_url, options) => {
      written = options;
      if (fail) { return new Response(null, { status: 412 }); }
      return new Response(null, { status: 204, headers: { ETag: '"v2"' } });
    }
  } };
  const state = new WorkspaceState({ owner, source });
  return { state, session, source, written: () => written,
    conflict: () => { fail = true; } };
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
  await assert.rejects(state.save(session, url), /changed elsewhere/);
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
