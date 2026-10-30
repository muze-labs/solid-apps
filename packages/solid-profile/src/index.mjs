import { oldm, prefixes, valueAt, many, idOf } from '@muze-labs/solid-app-data';
const v = prefixes.vcard,
  f = prefixes.foaf,
  s = prefixes.schema;
export const fields = [
  {
    name: 'name',
    label: 'Name',
    predicates: [v + 'fn', f + 'name', s + 'name', 'http://schema.org/name']
  },
  {
    name: 'email',
    label: 'Email addresses',
    predicates: [v + 'hasEmail', f + 'mbox', s + 'email'],
    scheme: 'mailto:'
  },
  {
    name: 'phone',
    label: 'Phone numbers',
    predicates: [v + 'hasTelephone', s + 'telephone'],
    scheme: 'tel:'
  },
  {
    name: 'website',
    label: 'Websites',
    predicates: [v + 'url', f + 'homepage', s + 'url'],
    scheme: 'http'
  },
  {
    name: 'webId',
    label: 'WebID / public profile URL',
    predicates: [s + 'sameAs'],
    scheme: 'http'
  },
  { name: 'notes', label: 'Notes', predicates: [v + 'note', s + 'description'] }
];
export const scalarPredicates = fields.flatMap((field) => field.predicates);
function present(subject, field) {
  return (
    field.predicates.find(
      (predicate) => valueAt(subject, predicate) !== undefined
    ) || field.predicates[0]
  );
}
function structured(value) {
  return (
    (value instanceof oldm.BlankNode && !(value instanceof oldm.NamedNode)) ||
    valueAt(value, v + 'value') !== undefined ||
    valueAt(value, v + 'hasValue') !== undefined
  );
}
function text(value) {
  if (structured(value)) {
    return String(
      valueAt(value, v + 'value') ?? valueAt(value, v + 'hasValue') ?? ''
    );
  }
  return idOf(value);
}
export function readProfile(subject) {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      many(valueAt(subject, present(subject, field)))
        .map((value) => {
          let result = text(value);
          if (
            field.scheme &&
            field.scheme !== 'http' &&
            result.startsWith(field.scheme)
          ) {
            result = result.slice(field.scheme.length);
          }
          return result;
        })
        .join('\n')
    ])
  );
}
export function profileLabel(subject) {
  return readProfile(subject).name || subject?.id || 'Unnamed person';
}
export function applyProfileEdits(subject, edits) {
  const previous = readProfile(subject);
  const changes = [];
  for (const field of fields) {
    if (
      edits[field.name] === undefined ||
      edits[field.name] === previous[field.name]
    ) {
      continue;
    }
    const predicate = present(subject, field);
    const current = many(valueAt(subject, predicate));
    // Preserve structured values rather than flattening them into a second model.
    if (current.some(structured)) {
      throw new Error(
        `solid-profile: ${field.label} uses structured RDF. Editing this field is not available yet.`
      );
    }
    const text = String(edits[field.name]);
    const parts = field.name === 'notes' ? [text] : text.split('\n');
    const strings = parts.map((value) => value.trim()).filter(Boolean);
    const values = strings.map((value) => {
      if (field.scheme === 'http') {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('solid-profile: Use HTTP or HTTPS links.');
        }
        return { iri: url.href };
      }
      if (field.scheme) {
        return {
          iri: value.startsWith(field.scheme) ? value : field.scheme + value
        };
      }
      return oldm.literal(value);
    });
    changes.push({ predicate, values });
  }
  for (const { predicate, values: prepared } of changes) {
    const values = prepared.map((value) =>
      value.iri ? subject.graph.addNamedNode(value.iri) : value
    );
    if (values.length) {
      subject.graph.set(
        subject.id,
        predicate,
        values.length === 1 ? values[0] : values
      );
    }
    else {
      subject.graph.delete(subject.id, predicate);
    }
  }
  subject.graph.set(
    subject.id,
    prefixes.dcterms + 'modified',
    new Date().toISOString()
  );
  return subject.graph.get(subject.id);
}
