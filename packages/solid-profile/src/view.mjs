import { app } from '@muze-labs/simplyflow/app';
import { model } from '@muze-labs/simplyflow/model';
import { effect, destroy } from '@muze-labs/simplyflow/state';
import { from } from '@muze-nl/jaqt';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import { fields, readProfile, profileLabel } from './index.mjs';
import { profileDetails, profileEditing } from './features.mjs';
import sources from './features.mjs?entries';

export const profileComponents = { profileDetails, profileEditing };
export const profileSources = sources;
export const profileApi = {
  fields,
  readProfile,
  profileLabel,
  model,
  effect,
  destroy,
  from
};
export function profileDefaults(emptyText = 'No profile selected.') {
  return {
    empty: emptyText,
    visibility: { hidden: '' },
    detailsVisibility: { hidden: null },
    formVisibility: { hidden: '' },
    editVisibility: { hidden: '' },
    buttons: { disabled: null },
    title: '',
    id: '',
    sourceLabel: '',
    details: [],
    noDetails: '',
    error: '',
    ...Object.fromEntries(fields.map((field) => [field.name, '']))
  };
}

// The app supplies persistence policy; both Contacts and Profile register the
// same editable datasets in their own SimplyFlow instance.
export function profileView(
  container,
  {
    app: owner,
    emptyText = 'No profile selected.',
    onChange = () => {},
    overrides = {}
  } = {}
) {
  let view = owner;
  if (!view) {
    const definition = {
      container,
      components: profileComponents,
      data: { profile: profileDefaults(emptyText) },
      api: {},
      runtime: {},
      ...overrides
    };
    view = app(definition);
    exposeDefinition(view, definition, sources);
  }
  view.api.profile = { ...profileApi, onChange };
  view.runtime.profile = {
    emptyText,
    subject: null,
    options: {},
    values: {},
    draftValues: {},
    saving: false
  };
  Object.assign(view.data.profile, profileDefaults(emptyText));
  view.actions.initializeProfileDetails();
  return {
    app: view,
    draft: view.actions.profileDraft,
    restoreDraft: view.actions.profileRestoreDraft,
    show: view.actions.showProfile,
    destroy: view.actions.cleanupProfile
  };
}
