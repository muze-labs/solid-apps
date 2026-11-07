export const profileEditing = {
  commands: {
    profileChanged(element) {
      this.actions.profileUpdateDraft(element.name, element.value);
    },
    editProfile() {
      if (this.actions.profileBeginEdit()) {
        requestAnimationFrame(() =>
          this.container
            .querySelector('.profile-card form')
            .elements.name.focus()
        );
      }
    },
    cancelProfile() {
      this.actions.profileCancelEdit();
    },
    saveProfile(form) {
      const edits = Object.fromEntries(
        this.api.profile.fields.map((field) => [
          field.name,
          form.elements.namedItem(field.name).value
        ])
      );
      return this.actions.profileSaveEdits(edits);
    }
  },
  actions: {
    profileUpdateDraft(name, value) {
      if (this.api.profile.fields.some((field) => field.name === name)) {
        this.runtime.profile.draftValues[name] = value;
        this.data.profile[name] = value;
      }
      this.api.profile.onChange();
    },
    profileBeginEdit() {
      if (
        !this.runtime.profile.subject ||
        !this.runtime.profile.options.editable ||
        this.runtime.profile.saving
      ) {
        return false;
      }
      this.data.profile.formVisibility = { hidden: null };
      this.data.profile.detailsVisibility = { hidden: '' };
      this.api.profile.onChange();
      return true;
    },
    profileCancelEdit() {
      if (this.runtime.profile.saving) {
        return;
      }
      this.runtime.profile.draftValues = { ...this.runtime.profile.values };
      Object.assign(this.data.profile, this.runtime.profile.values, {
        error: '',
        formVisibility: { hidden: '' },
        detailsVisibility: { hidden: null }
      });
      this.api.profile.onChange();
    },
    async profileSaveEdits(edits) {
      const options = this.runtime.profile.options;
      if (!options.editable || !options.onSave || this.runtime.profile.saving) {
        return;
      }
      this.runtime.profile.saving = true;
      this.data.profile.error = '';
      this.data.profile.buttons = { disabled: '' };
      try {
        await options.onSave(edits);
      }
      catch (error) {
        if (error.code !== 'cancelled') {
          this.data.profile.error = error.message || String(error);
        }
      }
      finally {
        this.runtime.profile.saving = false;
        this.data.profile.buttons = { disabled: null };
      }
    },
    profileDraft() {
      if (this.runtime.profile.saving) {
        throw new Error('profile-view: Wait for the profile save to finish.');
      }
      if (
        !this.runtime.profile.subject ||
        this.data.profile.formVisibility.hidden !== null
      ) {
        return null;
      }
      return {
        subject: this.runtime.profile.subject.id,
        values: { ...this.runtime.profile.draftValues }
      };
    },
    profileRestoreDraft(draft) {
      if (!draft) {
        return;
      }
      if (
        draft.subject !== this.runtime.profile.subject?.id ||
        !this.runtime.profile.options.editable ||
        this.api.profile.fields.some(
          (field) => typeof draft.values?.[field.name] !== 'string'
        )
      ) {
        throw new Error('profile-view: Cannot restore this profile draft.');
      }
      const restored = Object.fromEntries(
        this.api.profile.fields.map((field) => [
          field.name,
          draft.values[field.name]
        ])
      );
      this.runtime.profile.draftValues = { ...restored };
      Object.assign(this.data.profile, restored, {
        formVisibility: { hidden: null },
        detailsVisibility: { hidden: '' }
      });
    }
  }
};
