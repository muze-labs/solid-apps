export const lifecycle = {
  actions: {
    async initialize() {
      this.actions.initializeShortcuts();
      this.runtime.store = undefined;
      this.runtime.selection = undefined;
      this.runtime.workspace = undefined;
      this.runtime.persistence = undefined;
      this.runtime.workspaceBusy = false;
      this.runtime.container = this.runtime.host.main;
      this.runtime.host.onConnect = async () => {
        this.actions.renderLinks();
        if (this.runtime.store) {
          this.actions.render();
        }
        if (this.runtime.persistence) {
          try {
            await this.actions.preparePod();
          }
          catch (error) {
            this.actions.workspaceFailure(error);
          }
        }
      };
      this.actions.renderLinks();
      await this.runtime.host.run(async () => {
        this.runtime.store = await this.api.openCollection('launcher', {
          scalarPredicates: [
            this.api.prefixes.schema + 'name',
            this.api.prefixes.schema + 'url',
            this.api.overridePredicate,
            this.api.anonymousPredicate
          ]
        });
        this.actions.render();
      });
      await this.runtime.host.ready;
      await this.runtime.host.run(async () => {
        this.runtime.persistence = new this.api.WorkspaceState({
          owner: this.runtime.host.session?.webId || '',
          onStatus: (message) =>
            this.actions.workspaceFailure(new Error(message))
        });
        await this.runtime.persistence.open();
        this.actions.createWorkspace();
        this.actions.workspaceMessage(
          'App state is saved locally. Pod saves happen at checkpoints and closure.'
        );
        try {
          const previous = JSON.parse(
            sessionStorage.getItem('solid-apps.workspace-message')
          );
          if (previous?.owner === (this.runtime.host.session?.webId || '')) {
            this.actions.workspaceMessage(
              'Previous attempt: ' + previous.message
            );
          }
        }
        catch {}
        if (this.runtime.host.session) {
          try {
            await this.actions.preparePod();
          }
          catch (error) {
            this.actions.workspaceFailure(error);
          }
        }
        this.runtime.restoreTimer = setTimeout(
          () => this.runtime.workspace.restore(),
          900
        );
      });
      this.runtime.host.onPreferences = (values) => {
        if (this.runtime.workspace) {
          this.runtime.workspace.presentation = values.launchTarget;
        }
      };
      this.runtime.exitAttempted = false;
      this.runtime.exitListener = (event) => this.actions.attemptExit(event);
      window.addEventListener('beforeunload', this.runtime.exitListener);
      window.addEventListener('pagehide', this.runtime.exitListener);
    },
    cleanup() {
      window.removeEventListener('beforeunload', this.runtime.exitListener);
      window.removeEventListener('pagehide', this.runtime.exitListener);
      clearTimeout(this.runtime.restoreTimer);
      this.runtime.selection?.abort();
      this.runtime.workspace?.dispose();
      this.api.destroy(this.runtime.shortcutEffect);
      for (const signal of this.runtime.shortcuts.effects.slice(1)) {
        this.api.destroy(signal);
      }
    }
  }
};
