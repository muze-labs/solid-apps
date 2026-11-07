import sourceFilesEditing from '../editing.html' with { type: 'text' };

export const fileEditing = {
  templates: { 'files-editing': sourceFilesEditing },
  commands: {
    mkdir(form) {
      const name = form.elements.name.value;
      return this.actions.operation(async () => {
        await this.actions.makeFolder(name);
        form.reset();
      });
    },
    upload(input) {
      const files = [...input.files];
      return this.actions.operation(async () => {
        try {
          await this.actions.uploadFiles(files);
        }
        finally {
          input.value = '';
        }
      });
    },
    remove(_element, url) {
      if (
        confirm(
          'Mark this resource deleted? Its contents will be retained; link-metadata-aware clients will hide it.'
        )
      ) {
        return this.actions.operation(() => this.actions.deleteResource(url));
      }
    }
  },
  actions: {
    async makeFolder(name) {
      await this.runtime.host
        .requireSession()
        .solid.createContainer(this.actions.child(name) + '/');
      await this.actions.browse(this.runtime.current);
    },
    async uploadFiles(files) {
      const saved = await this.api.uploadFiles(
        this.runtime.host.requireSession(),
        files,
        this.actions.child
      );
      await this.actions.browse(this.runtime.current);
      this.runtime.host.notify(saved + ' files uploaded.');
    },
    async deleteResource(url) {
      const session = this.runtime.host.requireSession();
      await this.api.markResourceDeleted(
        session.client,
        this.actions.inside(url)
      );
      await this.actions.browse(this.runtime.current);
      this.runtime.host.notify('Marked deleted. Contents retained.');
    }
  }
};
