import {
  editProfileCapability,
  capabilityError
} from '@muze-labs/solid-app-data/capabilities.mjs';
import { launchUrl } from '@muze-labs/solid-app-data/launch.mjs';
import { loadDocument } from '@muze-labs/solid-app-data';
import { app } from '@muze-labs/simplyflow/app';
import { readProfile } from '@muze-labs/solid-profile';
import { connectSession, httpUrl } from '@muze-labs/solid-app-data';
import { defaults, applyPreferences } from '@muze-labs/solid-preferences';
import { preferencesDialog } from '@muze-labs/solid-preferences/dialog.mjs';
import { parseLaunchUrl } from '@muze-labs/solid-app-data/launch.mjs';
import { ManagedApp } from '@muze-labs/solid-app-data/capabilities.mjs';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import {
  muzeSolidDesignDialog,
  muzeSolidDesignDropdown,
  muzeSolidDesignToast,
  account,
  muzeSolidUiCapabilityDialog,
  sessionServices,
  sessionRecovery,
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
  const task = new URL(location.href).searchParams.has('solid-apps-task');
  let launch = { webId: '', resource: '' };
  let addressLaunch = launch;
  let launchError = '';
  if (acceptLaunch || task) {
    try {
      const parsed = parseLaunchUrl(location.href);
      launch = parsed.context;
      addressLaunch = launch;
      // Consume task context before Metro examines the URL for OAuth responses.
      // The provider keeps the validated context in host.launch.
      const address = task ? launchUrl(parsed.url) : parsed.url;
      if (address !== location.href) {
        history.replaceState(history.state, '', address);
        addressLaunch = { webId: '', resource: '' };
      }
    }
    catch (error) {
      launchError = error.message;
    }
  }
  const runtime = {
    root,
    acceptLaunch: acceptLaunch || task,
    addressLaunch,
    session: null,
    settings: { ...defaults },
    templates
  };
  const host = {
    main: root.querySelector('.app-content'),
    task,
    embedded: task && window.parent !== window,
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
      muzeSolidDesignDialog,
      muzeSolidDesignDropdown,
      muzeSolidDesignToast,
      account: {
        ...account,
        templates: { 'suite-account': templates.account }
      },
      sessionServices,
      sessionRecovery,
      accountLifecycle,
      muzeSolidUiCapabilityDialog,
      suiteAppearance
    },
    data: {
      muzeSolidDesignNotice: { text: '', visibility: { hidden: '' } },
      muzeSolidUiEmbedded: { hidden: task ? null : '' },
      muzeSolidUiMenuVisibility: { hidden: task ? '' : null },
      muzeSolidUiTaskConnectVisibility: { hidden: task ? null : '' },
      muzeSolidUiDialog: {
        title: '',
        message: '',
        loading: { hidden: '' },
        loadingText: '',
        frame: { src: 'about:blank', hidden: '' },
        fallback: { href: '', hidden: '' },
        discard: { hidden: '' }
      },
      muzeSolidUiRecoveryVisibility: { hidden: '' },
      muzeSolidUiRecoveryButton: { disabled: null },
      muzeSolidUiRecoveryError: '',
      accountName: '',
      muzeSolidUiProfileButton: { 'aria-label': 'View and edit your profile' },
      webId: launch.webId,
      logoutVisibility: { hidden: '' },
      message: launchError,
      connectButton: { disabled: null }
    },
    api: {
      readProfile,
      editProfileCapability,
      capabilityError,
      launchUrl,
      loadDocument,
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
    'notify',
    'run',
    'resource',
    'requireSession'
  ]) {
    host[name] = (...args) => view.actions[name](...args);
  }
  host.view = view;
  runtime.dialog = root.querySelector('.connect-dialog');
  runtime.menu = root.querySelector('#muze-solid-ui-account-menu');
  view.actions.muzeSolidUiInitializeCapability();
  host.muzeSolidUiInvoke = (...args) =>
    view.actions.muzeSolidUiInvokeCapability(...args);
  view.actions.initialize();
  host.preferenceView = runtime.preferences.app;
  return host;
}
