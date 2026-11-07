import { from } from '@muze-nl/jaqt';
import { fields } from './index.mjs';
import {
  apps,
  named,
  stateScope,
  stateRoot,
  rdfError
} from '@muze-labs/solid-app-data/state-rdf.mjs';
const draftNode = named(stateScope + 'draft');
const inputPredicate = (field) =>
  apps + 'input' + field.name[0].toUpperCase() + field.name.slice(1);

export function writeDraft(state, draft) {
  state.set(apps + 'draft', draft ? draftNode.id : null, 'iri');
  state.set(apps + 'forResource', draft?.subject, 'iri', draftNode);
  for (const field of fields) {
    state.set(
      inputPredicate(field),
      draft?.values[field.name],
      'string',
      draftNode
    );
  }
}
export function readDraft(state) {
  const root = state.graph.one(named(stateRoot), apps + 'draft', 'iri');
  if (!root) {
    return null;
  }
  if (root.id !== draftNode.id) {
    throw rdfError('Unsupported profile draft identity.');
  }
  return {
    subject: state.read(apps + 'forResource', 'iri', draftNode),
    values: Object.fromEntries(
      from(fields)
        .select((field) => [
          field.name,
          state.read(inputPredicate(field), 'string', draftNode)
        ])
        .toArray()
    )
  };
}
