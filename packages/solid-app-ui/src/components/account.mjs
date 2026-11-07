import styles from './account.css' with { type: 'text' };
export const account = {
  styles: { 'swb-account': styles },
  commands: {
    muzeSolidUiOwnProfile() {
      return this.actions.run(async () => {
        const session = this.actions.requireSession();
        const provider = this.api.launchUrl(
          new URL('../profile/', location.href).href,
          {
            webId: session.webId,
            resource: session.webId
          }
        );
        const result = await this.actions.muzeSolidUiInvokeCapability(
          this.api.editProfileCapability,
          provider,
          { '@id': session.webId },
          'Your profile'
        );
        if (result?.['@id'] !== session.webId) {
          throw new Error(
            'solid-app-ui: The provider returned a different profile.'
          );
        }
        const document = await session.perform(() =>
          this.api.loadDocument(session.client, session.webId)
        );
        session.profile = document.graph.get(session.webId);
        this.actions.muzeSolidUiShowAccount(session);
        this.actions.notify('Profile saved to Solid.');
      });
    },
    preferences() {
      this.runtime.menu.hidePopover();
      this.runtime.preferences.show();
    },
    connectDialog() {
      this.runtime.menu.hidePopover();
      return this.actions.muzeSolidDesignOpenDialog(this.runtime.dialog);
    },
    closeConnect() {
      return this.actions.muzeSolidDesignCloseDialog(this.runtime.dialog);
    },
    logout() {
      return this.actions.run(() => {
        this.runtime.session?.logout();
        localStorage.removeItem('solid-apps.webId');
        window.location.reload();
      });
    },
    async connect(form) {
      const webId = form.elements.webId.value;
      const popup = window.open(
        '',
        'solid-apps-auth',
        'popup,width=520,height=720'
      );
      try {
        if (await this.actions.connectAccount(webId, popup)) {
          await this.actions.muzeSolidDesignCloseDialog(this.runtime.dialog);
        }
      }
      finally {
        popup?.close();
      }
    }
  },
  actions: {
    muzeSolidUiShowAccount(session) {
      this.data.accountName =
        this.api.readProfile(session.profile).name.trim() || 'Connected';
      this.data.muzeSolidUiProfileButton = {
        'aria-label': 'View and edit profile for ' + this.data.accountName
      };
    },
    async connectAccount(webId, popup) {
      this.data.connectButton = { disabled: '' };
      this.data.message = 'Reading profile…';
      try {
        const session = await this.api.connectSession(webId, popup, {
          onAuthenticationRequired: (...args) =>
            this.actions.muzeSolidUiAuthenticationRequired(...args),
          onAuthenticationRestored: (...args) =>
            this.actions.muzeSolidUiAuthenticationRestored(...args)
        });
        this.runtime.session = session;
        this.data.webId = session.webId;
        this.data.logoutVisibility = { hidden: null };
        try {
          localStorage.setItem('solid-apps.webId', webId);
        }
        catch {}
        this.runtime.preferences.reset();
        this.actions.muzeSolidUiShowAccount(session);
        let preferenceError = '';
        await session.perform(async () => {
          try {
            await this.runtime.preferences.load(session);
          }
          catch (error) {
            preferenceError =
              error.code === 'sign_in_required' ? '' : error.message;
          }
          await this.runtime.host.onConnect?.(session);
        });
        this.data.message = preferenceError;
        this.actions.notify('Connected to Solid.');
        return true;
      }
      catch (error) {
        this.data.message = error.message || String(error);
        return false;
      }
      finally {
        this.data.connectButton = { disabled: null };
      }
    },
    async restoreAccount(webId) {
      if (this.runtime.session) {
        return;
      }
      const session = await this.api.connectSession(webId, null, {
        interactive: false,
        onAuthenticationRequired: (...args) =>
          this.actions.muzeSolidUiAuthenticationRequired(...args),
        onAuthenticationRestored: (...args) =>
          this.actions.muzeSolidUiAuthenticationRestored(...args)
      });
      this.runtime.session = session;
      this.data.webId = session.webId;
      this.data.logoutVisibility = { hidden: null };
      this.actions.muzeSolidUiShowAccount(session);
      await session.perform(
        async () => {
          try {
            await this.runtime.preferences.load(session);
          }
          catch (error) {
            if (error.code !== 'sign_in_required') {
              this.data.message = error.message;
            }
          }
          await this.runtime.host.onConnect?.(session);
        },
        { interactive: false }
      );
    },
    accountRemoved(event) {
      if (event.key === 'solid-apps.webId' && event.newValue === null) {
        this.runtime.session?.logout();
        window.location.reload();
        return;
      }
      if (this.runtime.session?.hasUsableAccessToken) {
        this.actions.muzeSolidUiSharedAuthorization();
      }
    }
  }
};
