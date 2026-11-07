import { app } from '@muze-labs/simplyflow/app';
import {
  defaults,
  loadPreferences,
  savePreferences,
  applyPreferences
} from './index.mjs';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import {
  muzeSolidDesignDialog,
  muzeSolidDesignToast
} from '@muze-labs/solid-design';
import { preferencesForm } from './features.mjs';
import sources from './features.mjs?entries';

export function preferencesDialog(
  dialog,
  { getSession, onChange, overrides = {}, template }
) {
  const component = {
    ...preferencesForm,
    templates: template ? { 'suite-preferences': template } : {}
  };
  const definition = {
    container: dialog,
    components: {
      muzeSolidDesignDialog,
      muzeSolidDesignToast,
      preferencesForm: component
    },
    data: {
      ...defaults,
      message: '',
      source: '',
      buttons: { disabled: null },
      muzeSolidDesignNotice: { text: '', visibility: { hidden: '' } }
    },
    api: {
      defaults,
      loadPreferences,
      savePreferences,
      applyPreferences,
      getSession,
      onChange
    },
    runtime: { loaded: null },
    ...overrides
  };
  const view = app(definition);
  exposeDefinition(view, definition, {
    ...sources,
    preferencesForm: {
      ...sources.preferencesForm,
      templates: {
        'suite-preferences': {
          origin: 'packages/solid-preferences/src/form.html',
          includes: 'the current app preferences.html'
        }
      }
    }
  });
  return {
    app: view,
    load: view.actions.load,
    recover: view.actions.recover,
    show: view.actions.show,
    reset: view.actions.reset,
    destroy: view.destroy.bind(view)
  };
}
