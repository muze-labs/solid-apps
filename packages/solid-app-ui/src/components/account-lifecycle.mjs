export const accountLifecycle = {
  actions: {
    initialize() {
      this.runtime.preferences = this.api.preferencesDialog(
        this.runtime.root.querySelector('.preferences-dialog'),
        {
          getSession: () => this.runtime.session,
          template: this.runtime.templates.preferences,
          onChange: (values) => {
            this.runtime.settings = values;
            this.runtime.host.onPreferences?.(values);
          }
        }
      );
      this.api.applyPreferences(this.runtime.settings);
      let remembered = '';
      try {
        remembered = localStorage.getItem('solid-apps.webId') || '';
        if (remembered) {
          remembered = this.api.httpUrl(remembered);
        }
      }
      catch {}
      const launch = this.runtime.host.launch;
      const different =
        launch.webId && remembered && launch.webId !== remembered;
      const webId = launch.webId || remembered;
      this.runtime.host.ready = Promise.resolve();
      if (different) {
        this.actions.message(
          'This link names a different WebID. Use WebID / connection to connect before opening it.'
        );
      }
      else if (webId && !this.runtime.host.launchError) {
        this.runtime.host.ready = new Promise((resolve) => {
          setTimeout(
            () =>
              this.actions
                .run(() => this.actions.restoreAccount(webId))
                .finally(resolve),
            0
          );
        });
      }
      this.runtime.accountListener = this.actions.accountRemoved;
      this.runtime.launchListener = this.actions.launchChanged;
      window.addEventListener('storage', this.runtime.accountListener);
      if (this.runtime.acceptLaunch) {
        window.addEventListener('hashchange', this.runtime.launchListener);
      }
    },
    launchChanged() {
      try {
        const parsed = this.api.parseLaunchUrl(location.href);
        const next = parsed.context;
        const address = this.runtime.addressLaunch;
        if (
          !this.runtime.host.launchError &&
          next.webId === address.webId &&
          next.resource === address.resource
        ) {
          if (parsed.url !== location.href) {
            history.replaceState(history.state, '', parsed.url);
            this.runtime.addressLaunch = { webId: '', resource: '' };
          }
          return;
        }
      }
      catch {}
      window.location.reload();
    },
    cleanup() {
      this.actions.muzeSolidUiCleanupCapability();
      window.removeEventListener('storage', this.runtime.accountListener);
      window.removeEventListener('hashchange', this.runtime.launchListener);
      this.runtime.preferences.app.destroy();
    }
  }
};
