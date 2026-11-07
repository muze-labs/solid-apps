import styles from '../form.css' with { type: 'text' };

export const preferencesForm = {
  styles: { 'swb-preferences-form': styles },
  commands: {
    close() {
      return this.actions.muzeSolidDesignCloseDialog(this.container);
    },
    save(form) {
      return this.actions.saveSettings(
        this.actions.swb_preferences_values(form)
      );
    },
    async swb_preferences_review(button) {
      const settings = this.actions.swb_preferences_values(
        button.closest('form')
      );
      const reviewed = await this.actions.swb_preferences_review(settings);
      if (!reviewed) {
        this.actions.swb_preferences_focus(button);
        return;
      }
      const changes = this.runtime.swb_preferences_changes || {};
      const selector = Object.keys(changes).length
        ? '[data-simply-command="swb_preferences_restore"]'
        : 'footer .ds-button-primary';
      this.actions.swb_preferences_focus(
        this.container.querySelector(selector)
      );
    },
    swb_preferences_restore() {
      this.actions.swb_preferences_restore();
      this.actions.swb_preferences_focus(
        this.container.querySelector('footer .ds-button-primary')
      );
    }
  },
  actions: {
    swb_preferences_focus(button) {
      // SimplyFlow batches attribute updates. Observe native focus readiness
      // rather than assuming that its rendering has finished after one frame.
      this.runtime.swb_preferences_focus?.disconnect();
      const observer = new MutationObserver(focusWhenReady);
      const dialog = this.container;
      function focusWhenReady() {
        if (!dialog.open) {
          observer.disconnect();
        }
        else if (!button.hidden && !button.disabled) {
          observer.disconnect();
          button.focus();
        }
      }
      observer.observe(dialog, { attributes: true, subtree: true });
      this.runtime.swb_preferences_focus = observer;
      focusWhenReady();
    },
    swb_preferences_values(form) {
      const keys = Object.keys(this.api.defaults).filter((key) =>
        form.elements.namedItem(key)
      );
      return Object.fromEntries(
        keys.map((key) => [key, form.elements.namedItem(key).value.trim()])
      );
    },
    swb_preferences_busy(busy) {
      if (busy) {
        this.actions.muzeSolidDesignHideToast();
      }
      const disabled = busy ? '' : null;
      this.data.buttons = { disabled };
      this.data.swb_preferences_review.disabled = disabled;
      this.data.swb_preferences_restore.disabled = disabled;
      this.data.swb_preferences_form = { 'aria-busy': String(busy) };
    },
    swb_preferences_error(error) {
      this.runtime.swb_preferences_error = error;
      this.data.swb_preferences_review.hidden = null;
      if (error.code === 'document_conflict' || error.status === 412) {
        return (
          'Preferences changed on your Pod. Your choices are still here. ' +
          'Review Pod settings, then restore your changes if you want to save them.'
        );
      }
      if (error.code === 'validator_missing') {
        return (
          'Your Pod is not providing the version information needed for safe saves. ' +
          'Your choices are still here. Retry saving, or review Pod settings. ' +
          'If this continues, your Pod provider needs to enable version information (ETag).'
        );
      }
      if (error.code === 'save_unconfirmed') {
        return (
          'We could not confirm whether your Pod saved these changes. ' +
          'Your choices are still here. Retry safely or review Pod settings.'
        );
      }
      if (error.status === 401 || error.code === 'sign_in_required') {
        return 'Sign in again to save preferences. Your choices are still here.';
      }
      if (error.status === 403) {
        return (
          'Your Pod refused access to these preferences. Your choices are still here. ' +
          'Check permission for the preferences file before retrying.'
        );
      }
      if (error.message?.startsWith('solid-preferences:')) {
        return error.message.slice('solid-preferences:'.length).trim();
      }
      return (
        'We could not complete this request. Your choices are still here. ' +
        'Retry saving or review Pod settings when the connection is available.'
      );
    },
    async saveSettings(settings) {
      const session = this.api.getSession();
      if (!session) {
        this.data.message = 'Connect to Solid before saving preferences.';
        return;
      }
      this.actions.swb_preferences_busy(true);
      try {
        await session.perform(async () => {
          await this.actions.recover(session);
          this.runtime.loaded = await this.api.savePreferences(
            session,
            this.runtime.loaded.document,
            settings
          );
        });
        this.api.applyPreferences(this.runtime.loaded.settings);
        this.api.onChange(this.runtime.loaded.settings);
        this.runtime.swb_preferences_changes = null;
        this.data.swb_preferences_review.hidden = '';
        this.data.swb_preferences_restore.hidden = '';
        this.data.message = '';
        this.actions.muzeSolidDesignNotify('Preferences saved to your Pod.');
      }
      catch (error) {
        if (error.code !== 'cancelled') {
          this.data.message = this.actions.swb_preferences_error(error);
        }
      }
      finally {
        this.actions.swb_preferences_busy(false);
      }
    },
    async swb_preferences_review(settings) {
      const session = this.api.getSession();
      if (!session) {
        this.data.message = 'Connect to Solid to review Pod settings.';
        return false;
      }
      this.actions.swb_preferences_busy(true);
      try {
        const latest = await session.perform(() =>
          this.api.loadPreferences(session)
        );
        const previous = this.runtime.loaded?.settings || this.api.defaults;
        const changes = { ...(this.runtime.swb_preferences_changes || {}) };
        for (const [key, value] of Object.entries(settings)) {
          if (value !== previous[key]) {
            changes[key] = value;
          }
        }
        this.runtime.swb_preferences_changes = changes;
        this.runtime.loaded = latest;
        Object.assign(this.data, latest.settings);
        this.data.swb_preferences_review.hidden = '';
        this.data.swb_preferences_restore.hidden = Object.keys(changes).length
          ? null
          : '';
        this.data.message = Object.keys(changes).length
          ? 'Showing current Pod settings. Your unsaved changes are kept. ' +
            'Use Restore my changes to continue editing them.'
          : 'Showing current Pod settings.';
        return true;
      }
      catch (error) {
        if (error.code !== 'cancelled') {
          this.data.message = this.actions.swb_preferences_error(error);
        }
        return false;
      }
      finally {
        this.actions.swb_preferences_busy(false);
      }
    },
    swb_preferences_restore() {
      Object.assign(this.data, this.runtime.swb_preferences_changes);
      this.runtime.swb_preferences_changes = null;
      this.data.swb_preferences_restore.hidden = '';
      this.data.message =
        'Your changes are restored. Save preferences to update your Pod.';
    },
    async recover(session) {
      if (this.runtime.loaded) {
        return;
      }
      const loaded = await this.api.loadPreferences(session);
      this.runtime.loaded = loaded;
      this.data.message = '';
      // An open form may contain edits even after its initial read failed.
      if (!this.container.open) {
        Object.assign(this.data, loaded.settings);
        this.api.applyPreferences(loaded.settings);
        this.api.onChange(loaded.settings);
      }
    },
    async load(session) {
      const loaded = await this.api.loadPreferences(session);
      this.runtime.loaded = loaded;
      Object.assign(this.data, loaded.settings, { message: '' });
      this.api.applyPreferences(loaded.settings);
      this.api.onChange(loaded.settings);
      return loaded.settings;
    },
    show() {
      this.actions.muzeSolidDesignOpenDialog(this.container);
      if (!this.runtime.loaded) {
        this.data.message = 'Connect to Solid to load your preferences.';
      }
    },
    reset() {
      this.runtime.loaded = null;
      this.runtime.swb_preferences_changes = null;
      Object.assign(this.data, this.api.defaults, { message: '' });
      this.data.swb_preferences_review.hidden = '';
      this.data.swb_preferences_restore.hidden = '';
      this.api.applyPreferences(this.api.defaults);
      this.api.onChange({ ...this.api.defaults });
    }
  }
};
