import {
  StateGraph,
  apps,
  rdf,
  xsd,
  named,
  literal,
  sameTerm,
  sameGraph,
  stateScope,
  rdfError,
  ownedQuads
} from './state-rdf.mjs';
import { validateAppState } from './app-state.mjs';

export const cacheRoot = 'urn:muze:solid-apps:workspace:cache';
const currentRoot = cacheRoot + '/current';
const baselineRoot = cacheRoot + '/baseline';
const text = (g, s, p, required = false) =>
  g.one(s, p, 'string', required)?.value;
const iri = (g, s, p, required = false) => g.one(s, p, 'iri', required)?.id;
function boolean(g, s, p, required = false) {
  const value = g.one(s, p, 'boolean', required)?.value;
  if (value === undefined) {
    return undefined;
  }
  if (!['true', 'false', '1', '0'].includes(value)) {
    throw rdfError('Invalid boolean for ' + p);
  }
  return value === 'true' || value === '1';
}
function scopeFor(node) {
  return node.id + '/state/';
}
function mapScope(term, from, to) {
  return term.termType === 'NamedNode' && term.id.startsWith(from)
    ? named(to + term.id.slice(from.length))
    : term;
}
function exportState(graph, entry) {
  const root = iri(graph, entry, apps + 'state');
  const opaque = text(graph, entry, apps + 'opaqueState');
  if (!root) {
    if (opaque !== undefined) {
      throw rdfError('Opaque state needs an RDF state graph.');
    }
    return null;
  }
  const scope = scopeFor(entry);
  if (root !== scope + 'root') {
    throw rdfError('Unsupported state root.');
  }
  const resultGraph = new StateGraph();
  resultGraph.quads = [...ownedQuads(graph, scope)].map((q) => ({
    ...q,
    subject: mapScope(q.subject, scope, stateScope),
    object: mapScope(q.object, scope, stateScope)
  }));
  const result = { turtle: resultGraph.write() };
  if (opaque !== undefined) {
    result.opaque = opaque;
  }
  return validateAppState(result);
}
function importState(graph, entry, state) {
  validateAppState(state);
  const previous = exportState(graph, entry);
  if (sameState(previous, state)) {
    return;
  }
  if (previous && state && sameGraph(previous.turtle, state.turtle)) {
    graph.set(
      entry,
      apps + 'opaqueState',
      state.opaque === undefined ? undefined : literal(state.opaque)
    );
    return;
  }
  const scope = scopeFor(entry);
  const owned = ownedQuads(graph, scope);
  const blanks = new Set(
    [...owned]
      .flatMap((q) => [q.subject, q.object])
      .filter((t) => t.termType === 'BlankNode')
      .map((t) => t.id)
  );
  if (
    graph.quads.some(
      (q) =>
        !owned.has(q) &&
        q.object.termType === 'BlankNode' &&
        blanks.has(q.object.id)
    )
  ) {
    throw rdfError(
      'Cannot replace state sharing blank nodes with unrelated data.'
    );
  }
  graph.quads = graph.quads.filter((q) => !owned.has(q));
  graph.set(entry, apps + 'state', state ? named(scope + 'root') : undefined);
  graph.set(
    entry,
    apps + 'opaqueState',
    state?.opaque === undefined ? undefined : literal(state.opaque)
  );
  if (!state) {
    return;
  }
  const remapped = new Map();
  const occupied = new Set(
    graph.quads
      .flatMap((q) => [q.subject, q.object])
      .filter((t) => t.termType === 'BlankNode')
      .map((t) => t.id)
  );
  let next = 0;
  function map(term) {
    if (term.termType !== 'BlankNode') {
      return mapScope(term, stateScope, scope);
    }
    if (!remapped.has(term.id)) {
      while (occupied.has('state' + ++next)) {
        /* Find an unused local label. */
      }
      const id = 'state' + next;
      occupied.add(id);
      remapped.set(term.id, { termType: 'BlankNode', id });
    }
    return remapped.get(term.id);
  }
  graph.quads.push(
    ...new StateGraph(state.turtle).quads.map((q) => ({
      ...q,
      subject: map(q.subject),
      object: map(q.object)
    }))
  );
}
export function sameState(a, b) {
  if (a === null || b === null) {
    return a === b;
  }
  return a.opaque === b.opaque && sameGraph(a.turtle, b.turtle);
}
export function sameWorkspace(a, b) {
  if (!a || !b) {
    return a === b;
  }
  return (
    a.version === b.version &&
    (a.owner || '') === (b.owner || '') &&
    (a.launcher.resource || '') === (b.launcher.resource || '') &&
    a.apps.length === b.apps.length &&
    a.apps.every((entry, index) => {
      const other = b.apps[index];
      return (
        entry.id === other.id &&
        entry.url === other.url &&
        (entry.label || '') === (other.label || '') &&
        entry.allowBrowse === other.allowBrowse &&
        sameState(entry.state, other.state)
      );
    })
  );
}
export function readWorkspace(graph, root) {
  const node = named(root);
  const version = graph.one(node, apps + 'formatVersion', 'integer');
  if (!version) {
    if (
      [apps + 'owner', apps + 'instances', apps + 'launcherState'].some(
        (predicate) => graph.values(node, predicate).length
      )
    ) {
      throw rdfError('Workspace has no supported formatVersion.');
    }
    return null;
  }
  if (version.value !== '2') {
    throw rdfError('Unsupported workspace format.');
  }
  const ordering = graph.list(node, apps + 'instances');
  const ids = new Set();
  const entries = ordering.values.map((entry) => {
    const id = text(graph, entry, apps + 'instanceId', true);
    if (ids.has(id)) {
      throw rdfError('Duplicate app instance.');
    }
    ids.add(id);
    const result = {
      id,
      url: iri(graph, entry, apps + 'launchUrl', true),
      allowBrowse: boolean(graph, entry, apps + 'allowBrowse', true),
      state: exportState(graph, entry)
    };
    const label = text(graph, entry, 'http://purl.org/dc/terms/title');
    if (label !== undefined) {
      result.label = label;
    }
    return result;
  });
  const launcher = graph.one(node, apps + 'launcherState', 'iri', true);
  const resource =
    text(graph, launcher, apps + 'resourceInput') ??
    iri(graph, launcher, apps + 'resource');
  const result = {
    version: 2,
    apps: entries,
    launcher: resource === undefined ? {} : { resource }
  };
  const owner = iri(graph, node, apps + 'owner');
  if (owner !== undefined) {
    result.owner = owner;
  }
  return result;
}
export function writeWorkspace(graph, root, snapshot) {
  const node = named(root);
  const existing = readWorkspace(graph, root);
  const previous = existing
    ? graph.list(node, apps + 'instances')
    : { nodes: [], values: [] };
  const byId = new Map(
    previous.values.map((entry) => [
      text(graph, entry, apps + 'instanceId', true),
      entry
    ])
  );
  const launcher =
    graph.one(node, apps + 'launcherState', 'iri') || named(root + '/launcher');
  graph.add(node, rdf + 'type', named(apps + 'Workspace'));
  graph.set(node, apps + 'formatVersion', literal(2, xsd + 'integer'));
  graph.set(
    node,
    apps + 'owner',
    snapshot.owner ? named(snapshot.owner) : undefined
  );
  graph.set(node, apps + 'launcherState', launcher);
  const input = snapshot.launcher.resource;
  graph.set(
    launcher,
    apps + 'resourceInput',
    input === undefined ? undefined : literal(input)
  );
  let resource;
  try {
    const url = new URL(input);
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
    ) {
      resource = named(url.href);
    }
  }
  catch {}
  graph.set(launcher, apps + 'resource', resource);
  const nodes = snapshot.apps.map((entry, index) => {
    const instance =
      byId.get(entry.id) ||
      named(root + '/instance/' + encodeURIComponent(entry.id));
    graph.add(instance, rdf + 'type', named(apps + 'AppInstance'));
    graph.set(instance, apps + 'instanceId', literal(entry.id));
    graph.set(instance, apps + 'launchUrl', named(entry.url));
    graph.set(
      instance,
      apps + 'allowBrowse',
      literal(entry.allowBrowse, xsd + 'boolean')
    );
    graph.set(
      instance,
      'http://purl.org/dc/terms/title',
      entry.label === undefined ? undefined : literal(entry.label)
    );
    importState(graph, instance, entry.state);
    return previous.nodes[index] || named(root + '/order/' + index);
  });
  graph.set(node, apps + 'instances', nodes[0] || named(rdf + 'nil'));
  snapshot.apps.forEach((entry, index) => {
    const instance =
      byId.get(entry.id) ||
      named(root + '/instance/' + encodeURIComponent(entry.id));
    graph.set(nodes[index], rdf + 'first', instance);
    graph.set(
      nodes[index],
      rdf + 'rest',
      nodes[index + 1] || named(rdf + 'nil')
    );
  });
}
export function readCache(graph) {
  const root = named(cacheRoot);
  const current = iri(graph, root, apps + 'current');
  if (!current) {
    return null;
  }
  const baseline = iri(graph, root, apps + 'baseline');
  const keys = {};
  const snapshot = readWorkspace(graph, current);
  for (const entry of graph.list(named(current), apps + 'instances').values) {
    const key = text(graph, entry, apps + 'reconnectKey');
    if (key !== undefined) {
      Object.defineProperty(
        keys,
        text(graph, entry, apps + 'instanceId', true),
        { value: key, enumerable: true, configurable: true, writable: true }
      );
    }
  }
  return {
    snapshot,
    keys,
    baseSnapshot: baseline ? readWorkspace(graph, baseline) : null,
    baseETag: text(graph, root, apps + 'baseETag') || null,
    baseUrl: iri(graph, root, apps + 'baseUrl') || null,
    dirty: boolean(graph, root, apps + 'dirty') || false
  };
}
export function writeCache(graph, saved) {
  writeWorkspace(graph, currentRoot, saved.snapshot);
  const root = named(cacheRoot);
  graph.set(root, apps + 'current', named(currentRoot));
  graph.set(
    root,
    apps + 'baseline',
    saved.baseSnapshot ? named(baselineRoot) : undefined
  );
  if (saved.baseSnapshot) {
    writeWorkspace(graph, baselineRoot, saved.baseSnapshot);
  }
  graph.set(
    root,
    apps + 'baseETag',
    saved.baseETag ? literal(saved.baseETag) : undefined
  );
  graph.set(
    root,
    apps + 'baseUrl',
    saved.baseUrl ? named(saved.baseUrl) : undefined
  );
  graph.set(root, apps + 'dirty', literal(saved.dirty, xsd + 'boolean'));
  for (const entry of graph.list(named(currentRoot), apps + 'instances')
    .values) {
    graph.set(
      entry,
      apps + 'reconnectKey',
      saved.keys[text(graph, entry, apps + 'instanceId')]
        ? literal(saved.keys[text(graph, entry, apps + 'instanceId')])
        : undefined
    );
  }
}
