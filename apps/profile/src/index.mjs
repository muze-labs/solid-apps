import {
  muzeSolidDesignDialog,
  muzeSolidDesignListDetails
} from '@muze-labs/solid-design';
import accountTemplate from './account-view.html?template' with { type: 'text' };
import preferencesTemplate from './preferences-view.html?template' with { type: 'text' };
import { writeDraft, readDraft } from '@muze-labs/solid-profile/state.mjs';
import { AppState } from '@muze-labs/solid-app-data/app-state.mjs';
import { apps } from '@muze-labs/solid-app-data/state-rdf.mjs';
import { shell } from '@muze-labs/solid-app-ui';
import { openCollection } from '@muze-labs/solid-app-data/collection.mjs';
import { createSolidMetroClient, httpUrl } from '@muze-labs/solid-app-data';
import {
  loadDocument,
  copyDocument,
  saveDocument
} from '@muze-labs/solid-app-data';
import {
  profileView,
  profileComponents,
  profileDefaults,
  profileSources
} from '@muze-labs/solid-profile/view.mjs';
import { scalarPredicates, applyProfileEdits } from '@muze-labs/solid-profile';
import { app } from '@muze-labs/simplyflow/app';
import { editProfileCapability } from '@muze-labs/solid-app-data/capabilities.mjs';
import {
  profileResource,
  lifecycle,
  muzeSolidProfileCapability
} from './features.mjs';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import sources from './features.mjs?entries';
const host = shell({
  acceptLaunch: true,
  templates: { account: accountTemplate, preferences: preferencesTemplate }
});
const definition = {
  container: host.main,
  components: {
    muzeSolidDesignDialog,
    muzeSolidDesignListDetails,
    ...profileComponents,
    profileResource,
    lifecycle,
    muzeSolidProfileCapability
  },
  data: { profile: profileDefaults(), url: '' },
  api: {
    app,
    editProfileCapability,
    writeDraft,
    readDraft,
    AppState,
    apps,
    shell,
    openCollection,
    createSolidMetroClient,
    httpUrl,
    loadDocument,
    copyDocument,
    saveDocument,
    profileView,
    scalarPredicates,
    applyProfileEdits
  },
  runtime: { host }
};
const ui = app(definition);
exposeDefinition(ui, definition, { ...profileSources, ...sources });
await ui.actions.initialize();
ui.definition.instances = {
  account: host.view,
  preferences: host.preferenceView
};
window.solidProfile = { host, ui };
globalThis.muzeSolidProfileApp = ui;
