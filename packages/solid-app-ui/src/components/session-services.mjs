export const sessionServices = {
  actions: {
    notify(text) {
      this.actions.muzeSolidDesignNotify(text);
    },
    message(text) {
      this.data.message = text;
    },
    async run(operation, { network = false } = {}) {
      try {
        const session = this.runtime.session;
        return await (network && session
          ? session.perform(operation)
          : operation());
      }
      catch (error) {
        if (['cancelled', 'sign_in_required'].includes(error.code)) {
          return undefined;
        }
        this.data.message = error.message || String(error);
        return undefined;
      }
    },
    resource(name) {
      const explicit = this.runtime.settings[name + 'Resource'];
      if (explicit) {
        return this.api.httpUrl(explicit);
      }
      const root = this.runtime.session?.storage[0];
      if (!root) {
        throw new Error(
          'solid-app-ui: No storage root found in your profile. Set an app storage location in Preferences.'
        );
      }
      return new URL('apps/solid-apps/' + name + '.ttl', root).href;
    },
    requireSession() {
      if (!this.runtime.session) {
        throw new Error('solid-app-ui: Connect to Solid first.');
      }
      return this.runtime.session;
    },
    manage(options) {
      const host = this.runtime.host;
      host.managed = new this.api.ManagedApp({
        name: document.title,
        ...options,
        getState: async () => {
          await host.ready;
          return options.getState();
        },
        restoreState: async (state) => {
          await host.ready;
          if (state !== null) {
            return options.restoreState(state);
          }
        },
        onState: (...args) => this.actions.message(...args)
      });
      return host.managed;
    }
  }
};
