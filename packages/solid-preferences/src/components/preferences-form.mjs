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
      if (!session || !this.runtime.loaded) {
        this.data.message =
          'Connect to Solid and load your preferences before saving.';
        return;
      }
      this.data.buttons = { disabled: '' };
      try {
        this.runtime.loaded = await session.perform(() =>
          this.api.savePreferences(
            session,
            this.runtime.loaded.document,
            settings
          )
        );
        this.api.applyPreferences(this.runtime.loaded.settings);
        this.api.onChange(this.runtime.loaded.settings);
        this.data.message = '';
        this.actions.muzeSolidDesignNotify('Preferences saved to your Pod.');
      }
      catch (error) {
        this.data.message = error.message || String(error);
      }
      finally {
        this.data.buttons = { disabled: null };
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
