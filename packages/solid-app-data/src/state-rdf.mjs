import { turtleParser } from '@muze-labs/oldm-turtle';

export const rdf = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const xsd = 'http://www.w3.org/2001/XMLSchema#';
export const apps = 'https://vocab.muze.nl/solid-apps#';
export const stateScope = 'urn:muze:solid-apps:state:';
export const stateRoot = stateScope + 'root';
export const named = (id) => ({ termType: 'NamedNode', id });
export const literal = (value, type = xsd + 'string') => ({
  termType: 'Literal',
  value: String(value),
  datatype: named(type),
  language: ''
});
export function rdfError(message) {
  return new Error('state-rdf: ' + message);
}
function quoted(value) {
  return (
    '"' +
    value.replace(/["\\\u0000-\u001f]/g, (character) => {
      if (character === '"' || character === '\\') {
        return '\\' + character;
      }
      return '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0');
    }) +
    '"'
  );
}
export function termText(term) {
  if (term.termType === 'NamedNode') {
    return (
      '<' +
      term.id.replace(
        /[<>"{}|^`\\\u0000-\u0020]/g,
        (character) =>
          '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0')
      ) +
      '>'
    );
  }
  if (term.termType === 'BlankNode') {
    return '_:' + term.id;
  }
  const text = quoted(term.value);
  if (term.language) {
    return text + '@' + term.language;
  }
  return text + '^^' + termText(term.datatype);
}
const tripleText = (quad) =>
  [quad.subject, quad.predicate, quad.object].map(termText).join(' ') + ' .';
export function sameTerm(left, right) {
  return Boolean(left && right && termText(left) === termText(right));
}

// Keep raw triples authoritative: the object-graph writer expands shared blank
// nodes and recurses on cycles. This emitter writes the triple subset of Turtle.
export class StateGraph {
  constructor(text = '', base = stateRoot) {
    try {
      this.quads = turtleParser(text, base).quads;
    }
    catch (error) {
      throw rdfError('Invalid Turtle. ' + error.message);
    }
  }
  clone() {
    const graph = new StateGraph();
    graph.quads = structuredClone(this.quads);
    return graph;
  }
  assertWritable() {
    const forbidden = this.quads.find(
      (quad) => quad.object.datatype?.id === rdf + 'JSON'
    );
    if (forbidden) {
      throw rdfError(
        'Cannot write RDF JSON at ' +
          forbidden.predicate.id +
          '. This value is retained; resolve its representation before saving.'
      );
    }
  }
  write() {
    this.assertWritable();
    return [...new Set(this.quads.map(tripleText))].sort().join('\n') + '\n';
  }
  values(subject, predicate) {
    return this.quads
      .filter(
        (quad) =>
          sameTerm(quad.subject, subject) && quad.predicate.id === predicate
      )
      .map((quad) => quad.object)
      .filter(
        (term, index, terms) =>
          terms.findIndex((other) => sameTerm(other, term)) === index
      );
  }
  one(subject, predicate, kind, required = false) {
    const values = this.values(subject, predicate);
    if (!values.length && !required) {
      return undefined;
    }
    const term = values[0];
    const valid =
      kind === 'node'
        ? term && ['NamedNode', 'BlankNode'].includes(term.termType)
        : kind === 'iri'
          ? term?.termType === 'NamedNode'
          : term?.termType === 'Literal' &&
            !term.language &&
            term.datatype.id === xsd + kind;
    if (values.length !== 1 || !valid) {
      throw rdfError('Expected one ' + kind + ' value for ' + predicate + '.');
    }
    return term;
  }
  set(subject, predicate, value) {
    this.quads = this.quads.filter(
      (quad) =>
        !sameTerm(quad.subject, subject) || quad.predicate.id !== predicate
    );
    if (value !== undefined) {
      this.quads.push({ subject, predicate: named(predicate), object: value });
    }
  }
  add(subject, predicate, value) {
    if (
      !this.values(subject, predicate).some((term) => sameTerm(term, value))
    ) {
      this.quads.push({ subject, predicate: named(predicate), object: value });
    }
  }
  list(subject, predicate) {
    let node = this.one(subject, predicate, 'node', true);
    const nodes = [],
      values = [],
      seen = new Set();
    while (!sameTerm(node, named(rdf + 'nil'))) {
      const key = termText(node);
      if (seen.has(key) || seen.size >= 100) {
        throw rdfError('Workspace ordering is cyclic or exceeds 100 apps.');
      }
      seen.add(key);
      nodes.push(node);
      values.push(this.one(node, rdf + 'first', 'iri', true));
      node = this.one(node, rdf + 'rest', 'node', true);
    }
    return { nodes, values };
  }
}

// Exact isomorphism; blank labels and triple order are not graph identity.
// Bound ambiguous searches conservatively: inequality may cause review, never
// incorrectly acknowledge a remote change as our own accepted baseline.
export function sameGraph(left, right) {
  if (left === right) {
    return true;
  }
  const a = new StateGraph(left).quads,
    b = new StateGraph(right).quads;
  const unique = (quads) => [
    ...new Map(quads.map((q) => [tripleText(q), q])).values()
  ];
  const source = unique(a),
    target = unique(b);
  if (source.length !== target.length) {
    return false;
  }
  const blanks = (quads) => [
    ...new Set(
      quads
        .flatMap((q) => [q.subject, q.object])
        .filter((term) => term.termType === 'BlankNode')
        .map((term) => term.id)
    )
  ];
  const first = blanks(source),
    second = blanks(target);
  if (first.length !== second.length) {
    return false;
  }
  const targetSet = new Set(target.map(tripleText));
  if (source.every((q) => targetSet.has(tripleText(q)))) {
    return true;
  }
  if (!first.length) {
    return source.every((q) => targetSet.has(tripleText(q)));
  }
  const signature = (quads, id) =>
    quads
      .filter(
        (q) =>
          (q.subject.termType === 'BlankNode' && q.subject.id === id) ||
          (q.object.termType === 'BlankNode' && q.object.id === id)
      )
      .map((q) =>
        [q.subject, q.predicate, q.object]
          .map((term) => {
            if (term.termType !== 'BlankNode') {
              return termText(term);
            }
            return term.id === id ? 'self' : 'blank';
          })
          .join(' ')
      )
      .sort()
      .join('\n');
  const groups = new Map();
  for (const id of second) {
    const key = signature(target, id);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(id);
  }
  const candidates = new Map(
    first.map((id) => [id, groups.get(signature(source, id)) || []])
  );
  first.sort((a, b) => candidates.get(a).length - candidates.get(b).length);
  const mapping = new Map(),
    used = new Set();
  let budget = 1000000;
  function search(index) {
    if (--budget < 0) {
      return false;
    }
    if (index === first.length) {
      return true;
    }
    const id = first[index];
    for (const candidate of candidates.get(id)) {
      if (used.has(candidate)) {
        continue;
      }
      mapping.set(id, candidate);
      used.add(candidate);
      const possible = source.every((q) => {
        if (--budget < 0) {
          return false;
        }
        if (
          [q.subject, q.object].some(
            (term) => term.termType === 'BlankNode' && !mapping.has(term.id)
          )
        ) {
          return true;
        }
        const mapped = (term) =>
          term.termType === 'BlankNode'
            ? { termType: 'BlankNode', id: mapping.get(term.id) }
            : term;
        return targetSet.has(
          tripleText({
            ...q,
            subject: mapped(q.subject),
            object: mapped(q.object)
          })
        );
      });
      if (possible && search(index + 1)) {
        return true;
      }
      mapping.delete(id);
      used.delete(candidate);
    }
    return false;
  }
  return search(0);
}

export function ownedQuads(graph, scope) {
  const included = new Set(
    graph.quads.filter(
      (q) =>
        q.subject.termType === 'NamedNode' && q.subject.id.startsWith(scope)
    )
  );
  let size;
  do {
    size = included.size;
    const blanks = new Set(
      [...included]
        .filter((q) => q.object.termType === 'BlankNode')
        .map((q) => q.object.id)
    );
    for (const quad of graph.quads) {
      if (
        quad.subject.termType === 'BlankNode' &&
        blanks.has(quad.subject.id)
      ) {
        included.add(quad);
      }
    }
  } while (included.size !== size);
  return included;
}
