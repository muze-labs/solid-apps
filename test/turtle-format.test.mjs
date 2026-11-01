import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StateGraph,
  apps,
  named,
  literal,
  termText,
  sameGraph
} from '../packages/solid-app-data/src/state-rdf.mjs';
import {
  readWorkspace,
  writeWorkspace,
  sameWorkspace
} from '../packages/solid-app-data/src/workspace-rdf.mjs';
const url = 'https://pod.example/apps/workspace.ttl';
const root = url + '#workspace';
const canonical = (graph) =>
  graph.quads
    .map(
      (quad) =>
        [quad.subject, quad.predicate, quad.object].map(termText).join(' ') +
        ' .'
    )
    .join('\n');

test('workspace output uses its base, vocabulary prefixes and grouped properties without rebasing', () => {
  const graph = new StateGraph('', url);
  const snapshot = {
    version: 2,
    owner: 'https://person.example/profile#me',
    launcher: { resource: 'https://pod.example/notes/file.ttl#section' },
    apps: [
      {
        id: 'one',
        label: 'Files',
        url: 'https://apps.example/files/',
        allowBrowse: true,
        state: null
      }
    ]
  };
  writeWorkspace(graph, root, snapshot);
  const before = canonical(graph);
  const output = graph.write();
  assert.match(
    output,
    /^@base <https:\/\/pod.example\/apps\/workspace.ttl> \./
  );
  assert.match(
    output,
    /@prefix apps: <https:\/\/vocab.muze.nl\/solid-apps#> \./
  );
  assert.match(output, /@prefix dcterms: <http:\/\/purl.org\/dc\/terms\/> \./);
  assert.match(output, /<#workspace> a apps:Workspace ;/);
  assert.match(output, /\n    apps:formatVersion "2"\^\^xsd:integer/);
  assert.match(output, /dcterms:title "Files"/);
  assert.equal(
    output
      .split('\n')
      .filter((line) => line.startsWith('<#workspace/instance/one> ')).length,
    1
  );
  assert(sameGraph(before, output));
  const relocated = new StateGraph(
    output,
    'https://elsewhere.example/copied.ttl'
  );
  assert(sameWorkspace(readWorkspace(relocated, root), snapshot));
});

test('source prefixes survive cloning and collisions get independent aliases', () => {
  const graph = new StateGraph(
    `
    @base <https://other.example/source.ttl> .
    @prefix apps: <https://foreign.example/ns#> .
    @prefix ex: <https://example.org/ns#> .
    @prefix unused: <https://unused.example/ns#> .
    <#other> apps:unknown ex:path\\/part .
  `,
    url
  );
  writeWorkspace(graph, root, { version: 2, apps: [], launcher: {} });
  const before = canonical(graph);
  const clone = graph.clone();
  clone.prefixes.ex = 'https://changed.example/ns#';
  assert.equal(graph.prefixes.ex, 'https://example.org/ns#');
  const output = graph.clone().write();
  assert.match(output, /@prefix apps: <https:\/\/foreign.example\/ns#>/);
  assert.match(output, /@prefix apps1: <https:\/\/vocab.muze.nl\/solid-apps#>/);
  assert.match(output, /@prefix ex: <https:\/\/example.org\/ns#>/);
  assert(!output.includes('@prefix unused:'));
  assert(sameGraph(before, output));
  const parsed = new StateGraph(output, url);
  assert.equal(
    parsed.one(
      named('https://other.example/source.ttl#other'),
      'https://foreign.example/ns#unknown',
      'iri'
    ).id,
    'https://example.org/ns#path/part'
  );
});

test('relative spelling preserves queries, fragments, escapes, Unicode and literal text', () => {
  const base = url + '?view=1';
  const graph = new StateGraph('', base);
  const links = [
    url,
    base,
    base + '#part',
    url + '?view=2#part',
    'https://pod.example/data/a%2Fb#part%2Ftwo',
    'https://pod.example/naïve/😀#café',
    'https://elsewhere.example/path?x=1#part',
    'urn:example:value#part'
  ];
  for (const id of links) {
    graph.add(named(root), 'urn:link', named(id));
  }
  graph.set(named(root), 'urn:literal', literal(base));
  const before = canonical(graph);
  const parsed = new StateGraph(graph.write(), 'https://unrelated.example/');
  assert.deepEqual(
    parsed
      .values(named(root), 'urn:link')
      .map((term) => term.id)
      .sort(),
    links.slice().sort()
  );
  assert.equal(parsed.one(named(root), 'urn:literal', 'string').value, base);
  assert(sameGraph(before, graph.write()));
});
