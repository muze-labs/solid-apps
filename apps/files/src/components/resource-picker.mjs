import sourceFilesPicker from '../picker.html' with { type: 'text' };

export const resourcePicker = {
  templates: { 'files-picker': sourceFilesPicker },
  commands: {
    selectResource(_element, url) {
      return this.runtime.host.run(() => this.actions.selectFile(url));
    },
    selectFolder() {
      this.runtime.host.run(() =>
        this.actions.finishSelection({
          result: { '@id': this.actions.inside(this.runtime.current) }
        })
      );
    },
    cancelSelection() {
      this.runtime.host.run(() =>
        this.actions.finishSelection({
          error: {
            code: 'cancelled',
            message: 'Selection cancelled in Files.'
          }
        })
      );
    }
  },
  actions: {
    renderPicker() {
      const pending = this.runtime.pending;
      this.data.picker = { hidden: pending ? null : '' };
      this.data.editing = { hidden: pending ? '' : null };
      this.data.requester = pending
        ? pending.requester.application + ' (' + pending.requester.origin + ')'
        : '';
      this.runtime.files.state.options.picker = Boolean(pending);
    },
    finishSelection: async function (response) {
      if (!this.runtime.pending || this.runtime.selecting) {
        return;
      }
      const id = this.runtime.pending.id;
      this.runtime.selecting = true;
      try {
        await this.runtime.host.managed.respond(id, response);
        this.runtime.host.message(
          (response.error ? 'Selection cancelled.' : 'Resource URL returned.') +
            ' Return to Launcher if your browser did not switch tabs.'
        );
      } finally {
        this.runtime.selecting = false;
        if (this.runtime.pending?.id === id) {
          this.runtime.pending = null;
          this.actions.renderPicker();
        }
      }
    },
    receiveBrowseRequest(event) {
      let error;
      if (this.runtime.pending || this.runtime.selecting) {
        error = {
          code: 'busy',
          message: 'Files is handling another selection.'
        };
      } else if (!this.runtime.host.session) {
        error = {
          code: 'denied',
          message: 'Connect Files to Solid first.'
        };
      } else if (
        event.capability !== this.api.browseCapability ||
        Object.keys(event.input).some((key) => key !== '@context')
      ) {
        error = {
          code: 'invalid',
          message: 'Unsupported selection request.'
        };
      }
      if (error) {
        this.runtime.host.message(error.message);
        this.runtime.host.run(() =>
          this.runtime.host.managed.respond(event.id, { error })
        );
        return;
      }
      this.runtime.pending = event;
      this.actions.renderPicker();
      this.runtime.host.message('A resource selection is waiting in Files.');
    },
    cancelBrowseRequest(event) {
      if (this.runtime.pending?.id === event.id) {
        this.runtime.pending = null;
        this.actions.renderPicker();
        this.runtime.host.message(
          event.error?.message || 'Selection cancelled.'
        );
      }
    },
    selectFile(url) {
      const selected = this.api
        .from(this.data.entries)
        .where({ url })
        .toArray()[0];
      if (!selected) {
        throw new Error('files: Select a resource from the current folder.');
      }
      return this.actions.finishSelection({
        result: { '@id': this.actions.inside(url) }
      });
    }
  }
};
