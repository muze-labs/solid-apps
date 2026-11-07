import sourceLauncherResourceSelection from '../resource-selection.html' with { type: 'text' };

export const resourceSelection = {
  templates: { 'launcher-resource-selection': sourceLauncherResourceSelection },
  commands: {
    pickResource(...values) {
      return this.actions.handlePickResource(...values);
    },
    cancelPick(...values) {
      return this.actions.handleCancelPick(...values);
    },
    launchProfile(form) {
      const resource = form.elements.resource.value;
      const anonymous = form.elements.anonymous.checked;
      return this.runtime.host.run(() =>
        this.actions.openProfile(resource, anonymous)
      );
    }
  },
  actions: {
    handlePickResource() {
      if (this.runtime.selection) {
        return;
      }
      this.runtime.host.run(async () => {
        this.runtime.selection = new AbortController();
        this.data.pickState = { disabled: '' };
        this.data.cancelState = { hidden: null };
        this.data.pickerMessage = 'Opening Files…';
        try {
          const target = new URL('../files/', location.href).href;
          const filesUrl = this.runtime.host.session
            ? this.api.launchUrl(target, {
                webId: this.runtime.host.session.webId
              })
            : target;
          const result = await this.api.chooseFiles(
            this.runtime.workspace,
            filesUrl,
            {
              signal: this.runtime.selection.signal,
              onWait: (message) => {
                this.data.pickerMessage = message;
              }
            }
          );
          this.data.resource = this.api.selectionUrl(result);
          this.runtime.workspace.launcherState.resource = this.data.resource;
          await this.runtime.workspace.changed();
          this.data.pickerMessage =
            'Resource selected. Review the URL before opening.';
        } catch (error) {
          this.data.pickerMessage = error.message;
        } finally {
          this.runtime.selection = null;
          this.data.pickState = { disabled: null };
          this.data.cancelState = { hidden: '' };
        }
      });
    },
    handleCancelPick() {
      this.runtime.selection?.abort();
    },
    openProfile(resource, anonymous) {
      const webId = anonymous ? '' : this.runtime.host.requireSession().webId;
      const target = new URL('../profile/', location.href).href;
      return this.actions.openApplication(
        this.api.launchUrl(target, { webId, resource })
      );
    }
  }
};
