import { app } from '@muze-labs/simplyflow/app';
import { readProfile } from '@muze-labs/solid-profile';
import { connectSession, httpUrl } from '@muze-labs/solid-app-data';
import { defaults, applyPreferences } from '@muze-labs/solid-preferences';
import { preferencesDialog } from '@muze-labs/solid-preferences/dialog.mjs';
import { parseLaunchUrl } from '@muze-labs/solid-app-data/launch.mjs';
import { ManagedApp } from '@muze-labs/solid-app-data/capabilities.mjs';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import {
  account,
  sessionServices,
  accountLifecycle,
  suiteAppearance
} from './features.mjs';
import sources from './features.mjs?entries';

export function shell({
  acceptLaunch = false,
  overrides = {},
  templates = {}
} = {}) {
  const root = document.querySelector('#app');
  let launch = { webId: '', resource: '' };
  let addressLaunch = launch;
  let launchError = '';
  if (acceptLaunch) {
    try {
      const parsed = parseLaunchUrl(location.href);
      launch = parsed.context;
      addressLaunch = launch;
      if (parsed.url !== location.href) {
        history.replaceState(history.state, '', parsed.url);
        addressLaunch = { webId: '', resource: '' };
      }
    }
    catch (error) {
      launchError = error.message;
    }
  }
  const runtime = {
    root,
    acceptLaunch,
    addressLaunch,
    session: null,
    settings: { ...defaults },
    templates
  };
  const host = {
    main: root.querySelector('.app-content'),
    launch,
    launchError,
    get session() {
      return runtime.session;
    },
    get preferences() {
      return runtime.settings;
    },
    onConnect: null,
    onPreferences: null
  };
  runtime.host = host;
  const definition = {
    container: root.querySelector('.suite-account-owner'),
    components: {
      account: {
        ...account,
        templates: { 'suite-account': templates.account }
      },
      sessionServices,
      accountLifecycle,
      suiteAppearance
    },
    data: {
      accountName: '',
      webId: launch.webId,
      logoutVisibility: { hidden: '' },
      message: launchError,
      connectButton: { disabled: null }
    },
    api: {
      readProfile,
      connectSession,
      httpUrl,
      applyPreferences,
      preferencesDialog,
      parseLaunchUrl,
      ManagedApp
    },
    runtime,
    ...overrides
  };
  const view = app(definition);
  exposeDefinition(view, definition, {
    ...sources,
    account: {
      ...sources.account,
      templates: {
        'suite-account': { origin: 'packages/solid-app-ui/src/account.html' }
      }
    }
  });
  for (const name of [
    'manage',
    'message',
    'run',
    'resource',
    'requireSession'
  ]) {
    host[name] = view.actions[name];
  }
  host.view = view;
  runtime.dialog = root.querySelector('.connect-dialog');
  runtime.menu = root.querySelector('#account-menu');
  view.actions.initialize();
  host.preferenceView = runtime.preferences.app;
  return host;
}
