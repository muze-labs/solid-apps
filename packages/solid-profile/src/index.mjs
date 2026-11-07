import { from } from '@muze-nl/jaqt';
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
function structured(value, field) {
  return (
    (value instanceof oldm.BlankNode && !(value instanceof oldm.NamedNode)) ||
    valueAt(value, v + 'value') !== undefined ||
    valueAt(value, v + 'hasValue') !== undefined ||
    (value instanceof oldm.NamedNode &&
      field?.scheme &&
      field.scheme !== 'http' &&
      !value.id.toLowerCase().startsWith(field.scheme))
  );
}
function text(value, field, visited = new Set()) {
  if (visited.has(value)) {
    return '';
  }
  const nested = valueAt(value, v + 'value') ?? valueAt(value, v + 'hasValue');
  if (nested !== undefined) {
    const path = new Set(visited).add(value);
    return from(many(nested))
      .select((item) => text(item, field, path))
      .where(Boolean)
      .toArray()
      .join('\n');
  }
  // An unresolved contact node is not an email address or telephone number.
  // It stays in the authoritative graph and cannot be flattened by editing.
  if (structured(value, field)) {
    return '';
  }
  const result = idOf(value);
  return field?.scheme &&
    field.scheme !== 'http' &&
    result.toLowerCase().startsWith(field.scheme)
    ? result.slice(field.scheme.length)
    : result;
}
export function readProfile(subject) {
  return Object.fromEntries(
    from(fields)
      .select((field) => [
        field.name,
        from(many(valueAt(subject, present(subject, field))))
          .select((value) => text(value, field))
          .where(Boolean)
          .toArray()
          .join('\n')
      ])
      .toArray()
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
    if (current.some((value) => structured(value, field))) {
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
