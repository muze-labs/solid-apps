import {
  muzeSolidDesignDialog,
  muzeSolidDesignListDetails
} from '@muze-labs/solid-design';
import pickerSource from './picker.mjs' with { type: 'text' };
import shortcutSource from './shortcuts.mjs' with { type: 'text' };
import accountTemplate from './account-view.html?template' with { type: 'text' };
import preferencesTemplate from './preferences-view.html?template' with { type: 'text' };
import { model } from '@muze-labs/simplyflow/model';
import { effect, destroy } from '@muze-labs/simplyflow/state';
import { from } from '@muze-nl/jaqt';
import { shell } from '@muze-labs/solid-app-ui';
import { WorkspaceBroker } from '@muze-labs/solid-app-data/workspace-broker.mjs';
import { WorkspaceState } from '@muze-labs/solid-app-data/workspace-state.mjs';
import {
  editProfileCapability,
  browseCapability,
  selectionUrl
} from '@muze-labs/solid-app-data/capabilities.mjs';
import { chooseFiles } from './picker.mjs';
import { openCollection } from '@muze-labs/solid-app-data/collection.mjs';
import { prefixes, valueAt, idOf, httpUrl } from '@muze-labs/solid-app-data';
import { launchUrl } from '@muze-labs/solid-app-data/launch.mjs';
import {
  shortcutLaunch,
  applyLaunchOverride,
  overridePredicate,
  applyAnonymousLaunch,
  anonymousPredicate
} from './shortcuts.mjs';
import { app } from '@muze-labs/simplyflow/app';
import {
  workspaceControls,
  resourceSelection,
  shortcuts,
  lifecycle
} from './features.mjs';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import sources from './features.mjs?entries';
const host = shell({
  templates: { account: accountTemplate, preferences: preferencesTemplate }
});
const definition = {
  container: host.main,
  components: {
    muzeSolidDesignDialog,
    muzeSolidDesignListDetails,
    workspaceControls,
    resourceSelection,
    shortcuts,
    lifecycle
  },
  data: {
    shortcuts: [],
    empty: '',
    resource: '',
    pickerMessage: '',
    pickState: { disabled: null },
    cancelState: { hidden: '' },
    workspaceEntries: [],
    workspaceMessage: 'Loading workspace…',
    workspaceButtons: { disabled: null },
    conflictAction: { hidden: '' },
    conflictReview: { hidden: '' },
    localVersion: '',
    podVersion: '',
    contactsLink: { href: '../contacts/' },
    filesLink: { href: '../files/' },
    profileLink: { href: '../profile/' }
  },
  api: {
    app,
    model,
    effect,
    destroy,
    from,
    shell,
    WorkspaceBroker,
    WorkspaceState,
    editProfileCapability,
    browseCapability,
    selectionUrl,
    chooseFiles,
    openCollection,
    prefixes,
    valueAt,
    idOf,
    httpUrl,
    launchUrl,
    shortcutLaunch,
    applyLaunchOverride,
    overridePredicate,
    applyAnonymousLaunch,
    anonymousPredicate
  },
  runtime: { host }
};
const ui = app(definition);
exposeDefinition(ui, definition, sources);
ui.definition.modules = {
  picker: {
    source: pickerSource,
    origin: 'apps/launcher/src/picker.mjs',
    dependencies: [
      '@muze-nl/jaqt',
      '@muze-labs/solid-app-data/capabilities.mjs'
    ]
  },
  shortcuts: {
    source: shortcutSource,
    origin: 'apps/launcher/src/shortcuts.mjs',
    dependencies: [
      '@muze-labs/solid-app-data',
      '@muze-labs/solid-app-data/launch.mjs'
    ]
  }
};
await ui.actions.initialize();
ui.definition.instances = {
  account: host.view,
  preferences: host.preferenceView
};
window.solidLauncher = {
  host,
  ui,
  get workspace() {
    return ui.runtime.workspace;
  },
  get persistence() {
    return ui.runtime.persistence;
  },
  get store() {
    return ui.runtime.store;
  }
};
globalThis.muzeSolidLauncherApp = ui;
