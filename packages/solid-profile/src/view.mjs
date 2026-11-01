import { app } from '@muze-labs/simplyflow/app';
import { fields, readProfile, profileLabel } from './index.mjs';

export function profileView(
  container,
  { emptyText = 'No profile selected.', onChange = () => {} } = {}
) {
  let subject = null,
    options = {},
    values = {},
    saving = false;
  const form = container.querySelector('form');
  const widget = app({
    container,
    data: {
      empty: emptyText,
      visibility: { hidden: '' },
      detailsVisibility: { hidden: null },
      formVisibility: { hidden: '' },
      editVisibility: { hidden: '' },
      buttons: { disabled: null },
      title: '',
      id: '',
      sourceLabel: '',
      details: [],
      noDetails: '',
      error: '',
      ...Object.fromEntries(fields.map((field) => [field.name, '']))
    },
    commands: {
      changed() {
        onChange();
      },
      edit() {
        if (!subject || !options.editable || saving) {
          return;
        }
        widget.data.formVisibility = { hidden: null };
        widget.data.detailsVisibility = { hidden: '' };
        onChange();
        requestAnimationFrame(() => form.elements.name.focus());
      },
      cancel() {
        if (saving) {
          return;
        }
        Object.assign(widget.data, values, {
          error: '',
          formVisibility: { hidden: '' },
          detailsVisibility: { hidden: null }
        });
        onChange();
      },
      async save() {
        if (!options.editable || !options.onSave || saving) {
          return;
        }
        saving = true;
        widget.data.buttons = { disabled: '' };
        try {
          const edits = Object.fromEntries(
            fields.map((field) => [
              field.name,
              form.elements.namedItem(field.name).value
            ])
          );
          await options.onSave(edits);
        }
        catch (error) {
          widget.data.error = error.message || String(error);
        }
        finally {
          saving = false;
          widget.data.buttons = { disabled: null };
        }
      }
    }
  });
  return {
    draft() {
      if (saving) {
        throw new Error('profile-view: Wait for the profile save to finish.');
      }
      if (!subject || widget.data.formVisibility.hidden !== null) {
        return null;
      }
      return { subject: subject.id, values: Object.fromEntries(
        fields.map(field => [field.name, form.elements[field.name].value])
      ) };
    },
    restoreDraft(draft) {
      if (!draft) {
        return;
      }
      if (draft.subject !== subject?.id || !options.editable ||
        fields.some(field => typeof draft.values?.[field.name] !== 'string')) {
        throw new Error('profile-view: Cannot restore this profile draft.');
      }
      const restored = Object.fromEntries(fields.map(field =>
        [field.name, draft.values[field.name]]));
      Object.assign(widget.data, restored, {
        formVisibility: { hidden: null },
        detailsVisibility: { hidden: '' }
      });
    },
    show(next, settings = {}) {
      subject = next;
      options = settings;
      values = subject
        ? readProfile(subject)
        : Object.fromEntries(fields.map((field) => [field.name, '']));
      Object.assign(widget.data, values, {
        visibility: { hidden: subject ? null : '' },
        empty: subject ? '' : emptyText,
        detailsVisibility: { hidden: null },
        formVisibility: { hidden: '' },
        editVisibility: { hidden: subject && options.editable ? null : '' },
        title: subject ? profileLabel(subject) : '',
        id: subject?.id || '',
        sourceLabel: options.sourceLabel || '',
        details: fields
          .filter((field) => values[field.name])
          .map((field) => ({ label: field.label, value: values[field.name] })),
        noDetails: Object.values(values).some(Boolean)
          ? ''
          : 'No profile details yet.',
        error: ''
      });
    },
    destroy() {
      widget.destroy();
    }
  };
}
