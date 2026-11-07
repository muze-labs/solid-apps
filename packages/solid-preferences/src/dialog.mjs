import { app } from '@muze-labs/simplyflow/app';
import {
  defaults,
  loadPreferences,
  savePreferences,
  applyPreferences
} from './index.mjs';
export function preferencesDialog(dialog, { getSession, onChange }) {
  let loaded = null;
  const view = app({
    container: dialog,
    data: { ...defaults, message: '', source: '', buttons: { disabled: null } },
    commands: {
      close() {
        dialog.close();
      },
      async save(form) {
        const session = getSession();
        if (!session || !loaded) {
          view.data.message =
            'Connect to Solid and load your preferences before saving.';
          return;
        }
        const keys = Object.keys(defaults).filter(key =>
          form.elements.namedItem(key));
        const settings = Object.fromEntries(
          keys.map((key) => [
            key,
            form.elements.namedItem(key).value.trim()
          ])
        );
        view.data.buttons = { disabled: '' };
        try {
          loaded = await session.perform(() =>
            savePreferences(session, loaded.document, settings)
          );
          applyPreferences(loaded.settings);
          onChange(loaded.settings);
          view.data.message = 'Preferences saved to your Pod.';
        }
        catch (error) {
          view.data.message = error.message || String(error);
        }
        finally {
          view.data.buttons = { disabled: null };
        }
      }
    }
  });
  return {
    async load(session) {
      loaded = null;
      Object.assign(view.data, defaults, { message: '', source: '' });
      loaded = await loadPreferences(session);
      Object.assign(view.data, loaded.settings, {
        source: loaded.document.url,
        message: ''
      });
      applyPreferences(loaded.settings);
      onChange(loaded.settings);
      return loaded.settings;
    },
    show() {
      dialog.showModal();
      if (!loaded) {
        view.data.message =
          'Connect to Solid to load the preferences file linked from your profile.';
      }
    },
    reset() {
      loaded = null;
      Object.assign(view.data, defaults, { source: '', message: '' });
      applyPreferences(defaults);
      onChange({ ...defaults });
    },
    destroy() {
      view.destroy();
      dialog.close();
    }
  };
}
