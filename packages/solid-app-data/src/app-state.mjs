import {
  StateGraph,
  apps,
  xsd,
  stateRoot,
  stateScope,
  named,
  literal,
  rdfError,
  sameTerm,
  ownedQuads
} from './state-rdf.mjs';
export { stateRoot, stateScope };

export function validateAppState(state) {
  if (state === null) {
    return state;
  }
  if (
    !state ||
    typeof state.turtle !== 'string' ||
    Object.keys(state).some((key) => !['turtle', 'opaque'].includes(key)) ||
    (state.opaque !== undefined && typeof state.opaque !== 'string')
  ) {
    throw rdfError(
      'App state must contain Turtle and an optional opaque string.'
    );
  }
  if (
    new TextEncoder().encode(state.turtle + (state.opaque || '')).length > 65536
  ) {
    throw rdfError('App state exceeds 64 KB.');
  }
  const graph = new StateGraph(state.turtle);
  graph.assertWritable();
  for (const quad of graph.quads) {
    if (
      quad.subject.termType === 'NamedNode' &&
      !quad.subject.id.startsWith(stateScope)
    ) {
      throw rdfError('App state subjects must stay in ' + stateScope);
    }
  }
  if (ownedQuads(graph, stateScope).size !== graph.quads.length) {
    throw rdfError('App state contains unattached blank-node statements.');
  }
  if (!graph.quads.some((quad) => sameTerm(quad.subject, named(stateRoot)))) {
    throw rdfError('App state must describe its root.');
  }
  return state;
}

// App-local native graph owner. Views read projections; updates touch only
// explicitly owned predicates and retain all unknown native statements.
export class AppState {
  constructor() {
    this.graph = new StateGraph();
  }
  restore(state) {
    validateAppState(state);
    this.graph = new StateGraph(state?.turtle || '');
    this.opaque = state?.opaque;
  }
  read(predicate, kind = 'string', subject = named(stateRoot)) {
    const term = this.graph.one(subject, predicate, kind);
    if (term) {
      return kind === 'iri' ? term.id : term.value;
    }
    return '';
  }
  set(predicate, value, kind = 'string', subject = named(stateRoot)) {
    let term;
    if (value !== undefined && value !== null && value !== '') {
      term = kind === 'iri' ? named(value) : literal(value, xsd + kind);
    }
    this.graph.set(subject, predicate, term);
  }
  snapshot() {
    this.graph.set(
      named(stateRoot),
      apps + 'stateVersion',
      literal(1, xsd + 'integer')
    );
    const result = { turtle: this.graph.write() };
    if (this.opaque !== undefined) {
      result.opaque = this.opaque;
    }
    return validateAppState(result);
  }
}
