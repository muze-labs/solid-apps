export const account = {
  commands: {
    preferences() {
      this.runtime.menu.hidePopover();
      this.runtime.preferences.show();
    },
    connectDialog() {
      this.runtime.menu.hidePopover();
      this.runtime.dialog.showModal();
    },
    closeConnect() {
      this.runtime.dialog.close();
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
          this.runtime.dialog.close();
        }
      }
      finally {
        popup?.close();
      }
    }
  },
  actions: {
    async connectAccount(webId, popup) {
      this.data.connectButton = { disabled: '' };
      this.data.message = 'Reading profile…';
      try {
        const session = await this.api.connectSession(webId, popup);
        this.runtime.session = session;
        this.data.webId = session.webId;
        this.data.logoutVisibility = { hidden: null };
        try {
          localStorage.setItem('solid-apps.webId', webId);
        }
        catch {}
        this.runtime.preferences.reset();
        this.data.accountName =
          this.api.readProfile(session.profile).name.trim() || 'Connected';
        let preferenceError = '';
        await session.perform(async () => {
          try {
            await this.runtime.preferences.load(session);
          }
          catch (error) {
            preferenceError = error.message;
          }
          await this.runtime.host.onConnect?.(session);
        });
        this.data.message = preferenceError || 'Connected to Solid.';
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
        interactive: false
      });
      this.runtime.session = session;
      this.data.webId = session.webId;
      this.data.logoutVisibility = { hidden: null };
      this.data.accountName =
        this.api.readProfile(session.profile).name.trim() || 'Connected';
      await session.perform(
        async () => {
          try {
            await this.runtime.preferences.load(session);
          }
          catch (error) {
            this.data.message = error.message;
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
      }
    }
  }
};
