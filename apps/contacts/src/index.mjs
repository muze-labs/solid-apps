import accountTemplate from './account-view.html?template' with { type: 'text' };
import preferencesTemplate from './preferences-view.html?template' with { type: 'text' };
import { app } from '@muze-labs/simplyflow/app';
import { model } from '@muze-labs/simplyflow/model';
import { effect, destroy } from '@muze-labs/simplyflow/state';
import { from } from '@muze-nl/jaqt';
import { shell } from '@muze-labs/solid-app-ui';
import {
  openCollection,
  isPerson
} from '@muze-labs/solid-app-data/collection.mjs';
import { prefixes } from '@muze-labs/solid-app-data';
import { AppState } from '@muze-labs/solid-app-data/app-state.mjs';
import { apps } from '@muze-labs/solid-app-data/state-rdf.mjs';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import {
  profileLabel,
  readProfile,
  applyProfileEdits,
  scalarPredicates
} from '@muze-labs/solid-profile';
import {
  profileView,
  profileComponents,
  profileDefaults,
  profileSources
} from '@muze-labs/solid-profile/view.mjs';
import { writeDraft, readDraft } from '@muze-labs/solid-profile/state.mjs';
import { contactList, contactEditing, contactSession } from './features.mjs';
import sources from './features.mjs?entries';

const host = shell({
  templates: { account: accountTemplate, preferences: preferencesTemplate }
});
const definition = {
  container: host.main,
  components: {
    ...profileComponents,
    contactList,
    contactEditing,
    contactSession
  },
  data: {
    profile: profileDefaults(),
    people: [],
    empty: '',
    search: '',
    visibility: { hidden: '' }
  },
  api: {
    app,
    model,
    effect,
    destroy,
    from,
    openCollection,
    isPerson,
    prefixes,
    AppState,
    apps,
    profileLabel,
    readProfile,
    applyProfileEdits,
    scalarPredicates,
    profileView,
    writeDraft,
    readDraft
  },
  runtime: { host, selected: null }
};
const ui = app(definition);
exposeDefinition(ui, definition, { ...profileSources, ...sources });
await ui.actions.initialize();
ui.definition.instances = {
  account: host.view,
  preferences: host.preferenceView
};
window.solidContacts = {
  host,
  ui,
  get store() {
    return ui.runtime.store;
  }
};
globalThis.contactsApp = ui;
