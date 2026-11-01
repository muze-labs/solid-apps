import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StateGraph,
  apps,
  rdf,
  xsd,
  stateScope,
  stateRoot,
  named,
  literal,
  sameGraph
} from '../packages/solid-app-data/src/state-rdf.mjs';
import {
  AppState,
  validateAppState
} from '../packages/solid-app-data/src/app-state.mjs';
import {
  readWorkspace,
  writeWorkspace,
  readCache,
  writeCache,
  sameWorkspace
} from '../packages/solid-app-data/src/workspace-rdf.mjs';
import {
  WorkspaceState,
  emptyWorkspace
} from '../packages/solid-app-data/src/workspace-state.mjs';
import { readDraft, writeDraft } from '../packages/solid-profile/src/state.mjs';
import { fields } from '../packages/solid-profile/src/index.mjs';

const url = 'https://pod.example/workspace.ttl';
const root = url + '#workspace';
const owner = 'https://person.example/profile#me';
const nativeState = () => ({
  turtle: `
  @prefix s: <${stateScope}> .
  @prefix ex: <https://example.org/> .
  s:root <${apps}folder> <https://pod.example/notes/#item>;
    ex:shared _:shared, _:shared; ex:second _:shared;
    ex:list ("a"@en "b"^^<${xsd}string>); ex:extra s:child .
  _:shared ex:next _:cycle; ex:label "one", "two"@nl .
  _:cycle ex:next _:shared .
  s:child ex:number "01"^^<${xsd}integer> .
`
});
const snapshot = () => ({
  ...emptyWorkspace(),
  owner,
  launcher: { resource: 'https://pod.example/file.ttl#part' },
  apps: [
    {
      id: 'one',
      url: 'https://apps.example/files/',
      label: 'First',
      allowBrowse: true,
      state: nativeState()
    },
    {
      id: 'two',
      url: 'https://apps.example/files/',
      label: 'Second',
      allowBrowse: false,
      state: nativeState()
    }
  ]
});
function roundTrip(graph) {
  return new StateGraph(graph.write(), url);
}

test('native workspace keeps ordering, instance identity, lists and scoped graph identity', () => {
  const graph = new StateGraph();
  const input = snapshot();
  writeWorkspace(graph, root, input);
  const parsed = roundTrip(graph);
  const result = readWorkspace(parsed, root);
  assert(sameWorkspace(input, result));
  assert.deepEqual(
    result.apps.map((entry) => entry.id),
    ['one', 'two']
  );
  assert(sameGraph(nativeState().turtle, result.apps[0].state.turtle));
  const instances = parsed.list(named(root), apps + 'instances').values;
  assert.notEqual(instances[0].id, instances[1].id);
  const state = new StateGraph(result.apps[0].state.turtle);
  const shared = state.one(
    named(stateRoot),
    'https://example.org/shared',
    'node'
  );
  assert.equal(
    state.one(named(stateRoot), 'https://example.org/second', 'node').id,
    shared.id,
    'Shared blank-node identity survives saving.'
  );
  const next = state.one(shared, 'https://example.org/next', 'node');
  assert.equal(
    state.one(next, 'https://example.org/next', 'node').id,
    shared.id
  );
  assert(!parsed.quads.some((q) => q.object.datatype?.id === rdf + 'JSON'));
  assert(!parsed.write().includes('snapshot>'));
});

test('updating/reordering retains unknown native fields and existing instance identities', () => {
  const graph = new StateGraph();
  const value = snapshot();
  writeWorkspace(graph, root, value);
  const entries = graph.list(named(root), apps + 'instances').values;
  const extra = 'https://example.org/extension';
  graph.add(named(root), rdf + 'type', named('https://example.org/OtherType'));
  graph.set(entries[0], extra, literal('unknown instance metadata'));
  graph.quads.push(
    {
      subject: named(url + '#other'),
      predicate: named(extra),
      object: { termType: 'BlankNode', id: 'unrelated' }
    },
    {
      subject: { termType: 'BlankNode', id: 'unrelated' },
      predicate: named(extra),
      object: literal('unknown graph')
    }
  );
  value.apps.reverse();
  value.apps[1].label = 'Renamed';
  writeWorkspace(graph, root, value);
  const restored = roundTrip(graph);
  assert.equal(
    restored.list(named(root), apps + 'instances').values[1].id,
    entries[0].id
  );
  assert.equal(
    restored.one(entries[0], extra, 'string').value,
    'unknown instance metadata'
  );
  assert.equal(restored.values(named(root), rdf + 'type').length, 2);
  assert.match(restored.write(), /unknown graph/);
});

test('native cache holds independent current/baseline graphs and local-only reconnect keys', () => {
  const graph = new StateGraph();
  const baseline = snapshot(),
    current = snapshot();
  current.launcher.resource = 'unfinished input';
  current.apps[0].state = { ...nativeState(), opaque: ' { "app": [1, 2] }\n' };
  writeCache(graph, {
    snapshot: current,
    baseSnapshot: baseline,
    baseETag: '"accepted"',
    baseUrl: url,
    dirty: true,
    keys: { one: 'private-one', two: 'private-two' }
  });
  const loaded = readCache(roundTrip(graph));
  assert(sameWorkspace(loaded.snapshot, current));
  assert(sameWorkspace(loaded.baseSnapshot, baseline));
  assert.equal(loaded.baseUrl, url);
  assert.equal(loaded.baseETag, '"accepted"');
  assert.equal(loaded.dirty, true);
  assert.equal(loaded.keys.one, 'private-one');
  assert.equal(
    loaded.snapshot.apps[0].state.opaque,
    current.apps[0].state.opaque
  );
  const pod = new StateGraph();
  writeWorkspace(pod, root, loaded.snapshot);
  assert(!pod.write().includes('private-one'));
  assert(!pod.write().includes('baseline'));
  assert.equal(
    readWorkspace(roundTrip(pod), root).apps[0].state.opaque,
    current.apps[0].state.opaque
  );
});

test('app graph updates preserve unknown terms and isolate duplicate app instances', () => {
  const state = new AppState();
  state.restore(nativeState());
  state.set(apps + 'folder', 'https://pod.example/new/', 'iri');
  const value = snapshot();
  value.apps[0].state = state.snapshot();
  const graph = new StateGraph();
  writeWorkspace(graph, root, value);
  const result = readWorkspace(roundTrip(graph), root);
  const first = new AppState(),
    second = new AppState();
  first.restore(result.apps[0].state);
  second.restore(result.apps[1].state);
  assert.equal(first.read(apps + 'folder', 'iri'), 'https://pod.example/new/');
  assert.equal(
    second.read(apps + 'folder', 'iri'),
    'https://pod.example/notes/#item'
  );
  assert.match(first.snapshot().turtle, /https:\/\/example.org\/number/);
  assert.match(first.snapshot().turtle, /"01"/);
});

test('drafts remain separate native form input, including empty and multiline values', () => {
  const state = new AppState();
  const draft = {
    subject: owner,
    values: Object.fromEntries(
      fields.map((field) => [
        field.name,
        field.name === 'email' ? 'one@example.org\ntwo@example.org' : ''
      ])
    )
  };
  writeDraft(state, draft);
  const restored = new AppState();
  restored.restore(state.snapshot());
  assert.deepEqual(readDraft(restored), draft);
  assert(!restored.graph.quads.some((q) => q.subject.id === owner));
  writeDraft(restored, null);
  assert.equal(readDraft(restored), null);
});

test('graph equality ignores prefixes, ordering and blank labels but detects real edits', () => {
  const a =
    '<urn:root> <urn:edge> _:a. _:a <urn:edge> _:b. _:b <urn:edge> _:a.';
  const b =
    '_:y <urn:edge> _:x. _:x <urn:edge> _:y. <urn:root> <urn:edge> _:x.';
  assert(sameGraph(a, b));
  assert(!sameGraph(a, b.replace('_:y <urn:edge> _:x', '_:y <urn:other> _:x')));
  const cycle =
    '_:a <urn:edge> _:b. _:b <urn:edge> _:c. _:c <urn:edge> _:d. _:d <urn:edge> _:a.';
  const pairs =
    '_:a <urn:edge> _:b. _:b <urn:edge> _:a. _:c <urn:edge> _:d. _:d <urn:edge> _:c.';
  assert(
    !sameGraph(cycle, pairs),
    'Equal degrees do not imply graph isomorphism.'
  );
});

test('unsupported app object state, external subjects and orphan blank nodes are refused', () => {
  for (const state of [
    { folder: 'https://pod.example/' },
    { turtle: '<https://pod.example/> <urn:p> "attempted overwrite".' },
    { turtle: `<${stateRoot}> <urn:p> "root". _:orphan <urn:p> "orphan".` },
    { turtle: `<${stateRoot}> <urn:p> "root".`, opaque: {} },
    { turtle: 'broken' }
  ]) {
    assert.throws(() => validateAppState(state), /state-rdf:/);
  }
});

test('native scalar multiplicity, datatype and ordering corruption fail before writes', () => {
  for (const corrupt of [
    (graph) =>
      graph.add(
        named(root),
        apps + 'formatVersion',
        literal(3, xsd + 'integer')
      ),
    (graph) =>
      graph.set(named(root), apps + 'formatVersion', named('urn:structured')),
    (graph) => {
      const list = graph.list(named(root), apps + 'instances');
      graph.set(list.nodes[1], rdf + 'rest', list.nodes[0]);
    },
    (graph) => {
      const [entry] = graph.list(named(root), apps + 'instances').values;
      graph.set(entry, apps + 'allowBrowse', literal('maybe', xsd + 'boolean'));
    }
  ]) {
    const graph = new StateGraph();
    writeWorkspace(graph, root, snapshot());
    corrupt(graph);
    assert.throws(() => readWorkspace(graph, root), /state-rdf:/);
  }
});

test('state sharing blank nodes with other subjects is preserved unchanged or refused', () => {
  const graph = new StateGraph();
  const value = snapshot();
  writeWorkspace(graph, root, value);
  const [entry] = graph.list(named(root), apps + 'instances').values;
  const shared = graph.one(
    named(entry.id + '/state/root'),
    'https://example.org/shared',
    'node'
  );
  graph.set(named(url + '#unrelated'), 'https://example.org/shared', shared);
  const before = graph.write();
  writeWorkspace(graph, root, value);
  assert.equal(graph.write(), before);
  value.apps[0].state = { turtle: `<${stateRoot}> <urn:new> "changed".` };
  assert.throws(
    () => writeWorkspace(graph, root, value),
    /sharing blank nodes/
  );
});

test('local unknown terms survive checkpointing; malformed state retains the last cache', async () => {
  const unknown = '<urn:local> <urn:extension> "keep".';
  let cached = unknown;
  const source = {
    load: async () => cached,
    save: async (text) => {
      cached = text;
    }
  };
  const state = new WorkspaceState({ owner, source });
  await state.open();
  await state.stage(snapshot(), { one: 'private' });
  assert.match(cached, /keep/);
  const previous = cached;
  const invalid = snapshot();
  invalid.apps[0].state = { turtle: 'not Turtle' };
  assert.throws(() => state.stage(invalid), /Invalid Turtle/);
  assert.equal(cached, previous);
  const restored = new WorkspaceState({ owner, source });
  await restored.open();
  assert.equal(restored.keys.one, 'private');
  assert(sameWorkspace(restored.snapshot, snapshot()));
});

test('retired snapshot is ignored on load and discarded only by an explicit conditional save', async () => {
  // Plain placeholder input exercises the retired predicate without creating
  // a forbidden JSON-in-Turtle fixture. Parsed RDF JSON terms are tested below.
  const legacy = `<#workspace> <${apps}snapshot> "retired";
      <urn:unknown> "future"^^<urn:future:datatype>.
    <#other> <${apps}snapshot> "keep this other subject".`;
  const state = new WorkspaceState({
    owner,
    source: {
      load: async () => '',
      save: async () => {}
    }
  });
  await state.open();
  let written;
  const session = {
    webId: owner,
    perform: (operation) => operation(),
    client: {
      get: async () => new Response(legacy, { headers: { ETag: '"old"' } }),
      put: async (_url, options) => {
        written = options;
        return new Response(null, {
          status: 204,
          headers: { ETag: '"native"' }
        });
      }
    }
  };
  await state.bind(session, url);
  assert.equal(written, undefined, 'Reading cannot alter the Pod.');
  await state.stage(snapshot());
  assert.equal(written, undefined, 'Local changes cannot discard Pod data.');
  state.attemptExit(session, url);
  assert.equal(
    written,
    undefined,
    'Closing cannot perform this one-time discard.'
  );
  assert.equal(
    state.document.graph.one(named(root), apps + 'snapshot', 'string').value,
    'retired',
    'Preparation leaves the source graph untouched.'
  );
  assert.equal(await state.save(session, url), true);
  assert.equal(written.headers['If-Match'], '"old"');
  const saved = new StateGraph(written.body, url);
  assert.equal(saved.values(named(root), apps + 'snapshot').length, 0);
  assert.equal(
    saved.one(named(url + '#other'), apps + 'snapshot', 'string').value,
    'keep this other subject'
  );
  assert.equal(
    saved.values(named(root), 'urn:unknown')[0].datatype.id,
    'urn:future:datatype'
  );
  assert(sameWorkspace(readWorkspace(saved, root), snapshot()));
});

test('parsed retired RDF JSON is discarded without decoding or serializing it', async () => {
  // Construct parsed terms in memory; never emit a legacy JSON Turtle fixture.
  const source = new StateGraph('<#workspace> <urn:unknown> "retain".', url);
  source.set(
    named(root),
    apps + 'snapshot',
    literal('never decoded', rdf + 'JSON')
  );
  assert.equal(readWorkspace(source, root), null);
  const state = new WorkspaceState({
    owner,
    source: {
      load: async () => '',
      save: async () => {}
    }
  });
  await state.open();
  await state.stage(snapshot());
  state.url = url;
  state.document = { url, graph: source, missing: false, etag: '"old"' };
  await state.prepare();
  const output = state.prepared.body;
  assert(!output.includes('never decoded'));
  assert(!output.includes(rdf + 'JSON'));
  assert.match(output, /retain/);
  assert.equal(source.values(named(root), apps + 'snapshot').length, 1);
  assert.throws(() => source.write(), /Cannot write RDF JSON/);
});

test('native state wins when retired state coexists; unrelated JSON is preserved and refuses output', async () => {
  const source = new StateGraph();
  const value = snapshot();
  writeWorkspace(source, root, value);
  source.set(named(root), apps + 'snapshot', literal('obsolete', rdf + 'JSON'));
  const other = named(url + '#other');
  source.set(other, 'urn:unknown', literal('opaque unknown', rdf + 'JSON'));
  assert(sameWorkspace(readWorkspace(source, root), value));
  const state = new WorkspaceState({
    owner,
    source: {
      load: async () => '',
      save: async () => {}
    }
  });
  await state.open();
  await state.stage(value);
  state.url = url;
  state.document = { url, graph: source, missing: false, etag: '"old"' };
  await assert.rejects(state.prepare(), /Cannot write RDF JSON at urn:unknown/);
  assert.equal(state.prepared, null);
  assert.equal(source.values(other, 'urn:unknown')[0].value, 'opaque unknown');
  assert.equal(source.values(named(root), apps + 'snapshot').length, 1);
});

test('custom native instance IRIs and root extensions survive subsequent writes', () => {
  const graph = new StateGraph('<#workspace> <urn:extension> "retained".', url);
  const value = snapshot();
  writeWorkspace(graph, root, value);
  const [entry] = graph.list(named(root), apps + 'instances').values;
  const custom = 'urn:custom:instance:one';
  const remap = (term) =>
    term.termType === 'NamedNode' && term.id.startsWith(entry.id)
      ? named(custom + term.id.slice(entry.id.length))
      : term;
  graph.quads = graph.quads.map((q) => ({
    ...q,
    subject: remap(q.subject),
    object: remap(q.object)
  }));
  value.apps[0].label = 'Renamed';
  writeWorkspace(graph, root, value);
  assert.equal(
    graph.list(named(root), apps + 'instances').values[0].id,
    custom
  );
  assert.equal(
    graph.one(named(root), 'urn:extension', 'string').value,
    'retained'
  );
  assert(sameWorkspace(readWorkspace(roundTrip(graph), root), value));
});

test('Turtle lexical escaping is reversible and the emitter refuses RDF JSON', () => {
  const graph = new StateGraph();
  const original =
    'quotes " and slash \\ and control \u0001 and newline\n and 🐈';
  graph.set(named('urn:root'), 'urn:text', literal(original));
  assert.equal(
    roundTrip(graph).one(named('urn:root'), 'urn:text', 'string').value,
    original
  );
  graph.set(
    named('urn:root'),
    'urn:forbidden',
    literal('not JSON', rdf + 'JSON')
  );
  assert.throws(() => graph.write(), /Cannot write RDF JSON/);
});

test('a conflict during retired-snapshot cleanup retains local state and retries against fresh metadata', async () => {
  let body = `<#workspace> <${apps}snapshot> "retired".
    <#other> <urn:metadata> "original".`;
  let tag = '"old"';
  let fail = true;
  const puts = [];
  const state = new WorkspaceState({
    owner,
    source: {
      load: async () => '',
      save: async () => {}
    }
  });
  await state.open();
  const session = {
    webId: owner,
    client: {
      get: async () => new Response(body, { headers: { ETag: tag } }),
      put: async (_url, options) => {
        puts.push(options);
        if (fail) {
          return new Response(null, { status: 412 });
        }
        body = options.body;
        return new Response(null, {
          status: 204,
          headers: { ETag: '"saved"' }
        });
      }
    }
  };
  await state.bind(session, url);
  await state.stage(snapshot());
  await assert.rejects(
    state.save(session, url),
    (error) => error.code === 'workspace-conflict'
  );
  assert.match(body, /retired/);
  assert.equal(puts[0].headers['If-Match'], '"old"');
  assert(sameWorkspace(state.snapshot, snapshot()));
  assert.equal(state.dirty, true);
  body = body.replace('original', 'updated externally');
  tag = '"fresh"';
  fail = false;
  await state.bind(session, url, { forWrite: true });
  assert.equal(await state.save(session, url), true);
  assert.equal(puts[1].headers['If-Match'], '"fresh"');
  assert.match(body, /updated externally/);
  assert(!body.includes('retired'));
});
