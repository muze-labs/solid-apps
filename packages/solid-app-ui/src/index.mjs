import { app } from '@muze-labs/simplyflow/app';
import { readProfile } from '@muze-labs/solid-profile';
import { connectSession, httpUrl } from '@muze-labs/solid-app-data';
import { defaults, applyPreferences } from '@muze-labs/solid-preferences';
import { preferencesDialog } from '@muze-labs/solid-preferences/dialog.mjs';
import { parseLaunchUrl } from '@muze-labs/solid-app-data/launch.mjs';
import { ManagedApp } from '@muze-labs/solid-app-data/capabilities.mjs';
export function shell({ acceptLaunch = false } = {}) {
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
  let session = null;
  let settings = { ...defaults };
  const host = {
    main: root.querySelector('.app-content'),
    launch,
    launchError,
    get session() {
      return session;
    },
    get preferences() {
      return settings;
    },
    onConnect: null,
    onPreferences: null,
    manage(options) {
      host.managed = new ManagedApp({ name: document.title, ...options,
        getState: async () => {
          await host.ready;
          return options.getState();
        },
        restoreState: async state => {
          await host.ready;
          if (state !== null) {
            return options.restoreState(state);
          }
        },
        onState: message => host.message(message) });
      return host.managed;
    },
    message(text) {
      view.data.message = text;
    },
    async run(operation, { network = false } = {}) {
      try {
        const result = await (network && session
          ? session.perform(operation)
          : operation());
        return result;
      }
      catch (error) {
        view.data.message = error.message || String(error);
        return undefined;
      }
    },
    resource(name) {
      const explicit = settings[name + 'Resource'];
      if (explicit) {
        return httpUrl(explicit);
      }
      if (!session?.storage[0]) {
        throw new Error(
          'solid-app-ui: No storage root found in your profile. Set an app storage location in Preferences.'
        );
      }
      return new URL('apps/solid-apps/' + name + '.ttl', session.storage[0])
        .href;
    },
    requireSession() {
      if (!session) {
        throw new Error('solid-app-ui: Connect to Solid first.');
      }
      return session;
    }
  };
  const preferences = preferencesDialog(
    root.querySelector('.preferences-dialog'),
    {
      getSession: () => session,
      onChange: (values) => {
        settings = values;
        host.onPreferences?.(values);
      }
    }
  );
  const header = root.querySelector('header');
  const dialog = header.querySelector('dialog');
  const menu = header.querySelector('#account-menu');
  const view = app({
    container: header,
    data: {
      accountName: '',
      webId: launch.webId,
      logoutVisibility: { hidden: '' },
      message: launchError,
      connectButton: { disabled: null }
    },
    commands: {
      preferences() {
        menu.hidePopover();
        preferences.show();
      },
      connectDialog() {
        menu.hidePopover();
        dialog.showModal();
      },
      closeConnect() {
        dialog.close();
      },
      logout() {
        host.run(() => {
          session?.logout();
          localStorage.removeItem('solid-apps.webId');
          // Connected workspaces and profile editors retain clients. A reload
          // discards those owners while preserving their IndexedDB replicas.
          window.location.reload();
        });
      },
      async connect(form) {
        view.data.connectButton = { disabled: '' };
        const popup = window.open(
          '',
          'solid-apps-auth',
          'popup,width=520,height=720'
        );
        const webId = form.elements.webId.value;
        view.data.message = 'Reading profile…';
        try {
          const next = await connectSession(webId, popup);
          session = next;
          view.data.webId = session.webId;
          view.data.logoutVisibility = { hidden: null };
          try {
            localStorage.setItem('solid-apps.webId', webId);
          }
          catch {}
          preferences.reset();
          view.data.accountName =
            readProfile(session.profile).name.trim() || 'Connected';
          dialog.close();
          let preferenceError = '';
          await session.perform(async () => {
            try {
              await preferences.load(session);
            }
            catch (error) {
              preferenceError = error.message;
            }
            await host.onConnect?.(session);
          });
          view.data.message = preferenceError || 'Connected to Solid.';
        }
        catch (error) {
          view.data.message = error.message || String(error);
        }
        finally {
          popup?.close();
          view.data.connectButton = { disabled: null };
        }
      }
    }
  });
  applyPreferences(settings);
  let remembered = '';
  try {
    remembered = localStorage.getItem('solid-apps.webId') || '';
    if (remembered) {
      remembered = httpUrl(remembered);
    }
  }
  catch {}
  const differentAccount =
    launch.webId && remembered && launch.webId !== remembered;
  const initialWebId = launch.webId || remembered;
  host.ready = Promise.resolve();
  if (differentAccount) {
    host.message(
      'This link names a different WebID. Use WebID / connection to connect before opening it.'
    );
  }
  else if (initialWebId && !launchError) {
    host.ready = new Promise((resolve) => {
      setTimeout(() => {
        host.run(async () => {
          if (session) {
            return;
          }
          session = await connectSession(initialWebId, null, {
            interactive: false
          });
          view.data.webId = session.webId;
          view.data.logoutVisibility = { hidden: null };
          view.data.accountName =
            readProfile(session.profile).name.trim() || 'Connected';
          await session.perform(
            async () => {
              try {
                await preferences.load(session);
              }
              catch (error) {
                view.data.message = error.message;
              }
              await host.onConnect?.(session);
            },
            { interactive: false }
          );
        }).finally(resolve);
      }, 0);
    });
  }
  window.addEventListener('storage', (event) => {
    if (event.key === 'solid-apps.webId' && event.newValue === null) {
      session?.logout();
      window.location.reload();
    }
  });
  if (acceptLaunch) {
    window.addEventListener('hashchange', () => {
      try {
        const parsed = parseLaunchUrl(location.href);
        const next = parsed.context;
        if (
          !launchError && next.webId === addressLaunch.webId &&
          next.resource === addressLaunch.resource
        ) {
          if (parsed.url !== location.href) {
            history.replaceState(history.state, '', parsed.url);
            addressLaunch = { webId: '', resource: '' };
          }
          return;
        }
      }
      catch {}
      // A new launch restarts the same account/resource checks as a new page.
      window.location.reload();
    });
  }
  return host;
}
