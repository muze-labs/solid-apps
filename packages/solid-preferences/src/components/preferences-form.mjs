export const preferencesForm = {
  commands: {
    close() {
      return this.actions.muzeSolidDesignCloseDialog(this.container);
    },
    save(form) {
      const keys = Object.keys(this.api.defaults).filter((key) =>
        form.elements.namedItem(key)
      );
      const settings = Object.fromEntries(
        keys.map((key) => [key, form.elements.namedItem(key).value.trim()])
      );
      return this.actions.saveSettings(settings);
    }
  },
  actions: {
    async saveSettings(settings) {
      const session = this.api.getSession();
      if (!session) {
        this.data.message = 'Connect to Solid before saving preferences.';
        return;
      }
      this.data.buttons = { disabled: '' };
      try {
        await session.perform(async () => {
          // A stale startup session may have prevented the initial read.
          // Establish its RDF baseline without replacing the open form's edits.
          await this.actions.recover(session);
          this.runtime.loaded = await this.api.savePreferences(
            session,
            this.runtime.loaded.document,
            settings
          );
        });
        this.api.applyPreferences(this.runtime.loaded.settings);
        this.api.onChange(this.runtime.loaded.settings);
        this.data.message = '';
        this.actions.muzeSolidDesignNotify('Preferences saved to your Pod.');
      }
      catch (error) {
        if (error.code !== 'cancelled') {
          this.data.message = error.message || String(error);
        }
      }
      finally {
        this.data.buttons = { disabled: null };
      }
    },
    async recover(session) {
      if (this.runtime.loaded) {
        return;
      }
      const loaded = await this.api.loadPreferences(session);
      this.runtime.loaded = loaded;
      this.data.source = loaded.document.url;
      this.data.message = '';
      // An open form may already contain edits, even after its first read failed.
      if (!this.container.open) {
        Object.assign(this.data, loaded.settings);
        this.api.applyPreferences(loaded.settings);
        this.api.onChange(loaded.settings);
      }
    },
    async load(session) {
      this.runtime.loaded = null;
      Object.assign(this.data, this.api.defaults, { message: '', source: '' });
      const loaded = await this.api.loadPreferences(session);
      this.runtime.loaded = loaded;
      Object.assign(this.data, loaded.settings, {
        source: loaded.document.url,
        message: ''
      });
      this.api.applyPreferences(loaded.settings);
      this.api.onChange(loaded.settings);
      return loaded.settings;
    },
    show() {
      this.actions.muzeSolidDesignOpenDialog(this.container);
      if (!this.runtime.loaded) {
        this.data.message =
          'Connect to Solid to load the preferences file linked from your profile.';
      }
    },
    reset() {
      this.runtime.loaded = null;
      Object.assign(this.data, this.api.defaults, { source: '', message: '' });
      this.api.applyPreferences(this.api.defaults);
      this.api.onChange({ ...this.api.defaults });
    }
  }
};
