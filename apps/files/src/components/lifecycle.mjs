export const lifecycle = {
  actions: {
    async initialize() {
      this.actions.initializeFiles();
      this.runtime.container =
        this.runtime.host.main.querySelector('.file-controls');
      this.runtime.current = '';
      this.runtime.root = '';
      this.runtime.busy = false;
      this.runtime.pending = null;
      this.runtime.selecting = false;
      this.runtime.restoredFolder = '';
      this.runtime.managedOptions = {
        capabilities: [this.api.browseCapability],
        onRequest: this.actions.receiveBrowseRequest,
        onCancel: this.actions.cancelBrowseRequest
      };
      this.runtime.host.onConnect = async () => {
        const url = this.runtime.restoredFolder || this.actions.locationValue();
        if (url) {
          await this.actions.browse(url);
        }
      };
      this.runtime.appState = new this.api.AppState();
      this.runtime.host.manage({
        ...this.runtime.managedOptions,
        getState: this.actions.captureState,
        restoreState: this.actions.restoreState
      });
    },
    cleanup() {
      this.api.destroy(this.runtime.listEffect);
      for (const signal of this.runtime.files.effects.slice(1)) {
        this.api.destroy(signal);
      }
    },
    captureState() {
      this.runtime.appState.set(
        this.api.apps + 'folder',
        this.runtime.current || this.runtime.restoredFolder,
        'iri'
      );
      return this.runtime.appState.snapshot();
    },
    async restoreState(state) {
      this.runtime.appState.restore(state);
      this.runtime.restoredFolder = this.runtime.appState.read(
        this.api.apps + 'folder',
        'iri'
      );
      if (this.runtime.host.session && this.runtime.restoredFolder) {
        await this.actions.browse(this.runtime.restoredFolder);
      }
    }
  }
};
