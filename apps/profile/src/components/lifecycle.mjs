export const lifecycle = {
  actions: {
    async initialize() {
      this.runtime.container =
        this.runtime.host.main.querySelector('.profile-content');
      this.runtime.widget = this.api.profileView(this.runtime.container, {
        app: this,
        emptyText: 'Enter a profile URL or connect to view your own profile.',
        onChange: () =>
          this.runtime.host.managed
            ?.publish()
            .catch((error) => this.runtime.host.message(error.message))
      });
      this.runtime.launchPending =
        Boolean(this.runtime.host.launch.resource) && !this.runtime.host.task;
      this.runtime.launchAttempted = false;
      this.runtime.contactId = new URL(location.href).searchParams.get(
        'contact'
      );
      if (this.runtime.contactId && this.runtime.launchPending) {
        this.runtime.launchPending = false;
        this.runtime.host.message(
          'profile: This link mixes a local contact with a Pod resource.'
        );
      }
      else if (this.runtime.contactId && !this.runtime.host.launchError) {
        await this.runtime.host.run(async () => {
          this.runtime.store = await this.api.openCollection('contacts', {
            scalarPredicates: this.api.scalarPredicates
          });
          this.actions.showLocalContact();
        });
      }
      this.runtime.host.onConnect = async () => {
        await this.actions.openLaunch();
        await this.actions.muzeSolidProfileOpen();
      };
      await this.runtime.host.ready;
      if (!this.runtime.launchAttempted) {
        await this.runtime.host.run(this.actions.openLaunch, { network: true });
      }
      this.runtime.appState = new this.api.AppState();
      this.runtime.host.manage({
        capabilities: [this.api.editProfileCapability],
        waitForPresentation: true,
        onRequest: (...args) => this.actions.muzeSolidProfileReceive(...args),
        onCancel: (...args) => this.actions.muzeSolidProfileCancel(...args),
        canClose: (...args) => this.actions.muzeSolidProfileCanClose(...args),
        getState: (...args) => this.actions.captureState(...args),
        restoreState: (...args) => this.actions.restoreState(...args)
      });
    },
    cleanup() {
      this.runtime.widget.destroy();
    },
    captureState() {
      this.runtime.appState.set(this.api.apps + 'resourceInput', this.data.url);
      let resource;
      try {
        resource = this.api.httpUrl(this.data.url);
      }
      catch {}
      this.runtime.appState.set(this.api.apps + 'resource', resource, 'iri');
      this.runtime.appState.set(
        this.api.apps + 'contact',
        this.runtime.contactId,
        'iri'
      );
      this.api.writeDraft(this.runtime.appState, this.runtime.widget.draft());
      return this.runtime.appState.snapshot();
    },
    async restoreState(state) {
      this.runtime.appState.restore(state);
      const url = this.runtime.appState.read(this.api.apps + 'resourceInput');
      if (url && !this.runtime.contactId) {
        this.runtime.launchPending = false;
        await this.actions.showRemote(url);
      }
      this.runtime.widget.restoreDraft(
        this.api.readDraft(this.runtime.appState)
      );
    }
  }
};
