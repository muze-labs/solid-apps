import sourceFilesLocation from '../location.html' with { type: 'text' };
import sourceFilesNavigation from '../navigation.html' with { type: 'text' };

export const fileNavigation = {
  templates: {
    'files-navigation': sourceFilesNavigation,
    'files-location': sourceFilesLocation
  },
  commands: {
    browse(form) {
      const url = form.elements.url.value;
      return this.actions.operation(() => this.actions.browse(url));
    },
    open(_element, url) {
      const kind = this.actions.resourceKind(url);
      if (kind === 'folder') {
        return this.actions.operation(() => this.actions.browse(url));
      }
      if (kind === 'selection') {
        return this.runtime.host.run(() => this.actions.selectFile(url));
      }
      return this.commands.call('downloadResource', null, url);
    },
    up() {
      this.actions.operation(() =>
        this.actions.browse(
          this.actions.inside(this.api.parentContainer(this.runtime.current))
        )
      );
    },
    downloadResource(_element, url) {
      return this.actions.operation(async () => {
        const blob = await this.api.readDownload(
          this.runtime.host.requireSession(),
          this.actions.inside(url)
        );
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = this.actions.decodeName(url);
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      });
    }
  },
  actions: {
    locationValue: function () {
      return (
        this.runtime.host.preferences.filesRoot ||
        this.runtime.host.session?.storage[0] ||
        ''
      );
    },
    inside: function (url) {
      const normalized = this.api.httpUrl(url);
      if (!this.runtime.root || !normalized.startsWith(this.runtime.root)) {
        throw new Error(
          'files: Choose a folder within the configured files root.'
        );
      }
      return normalized;
    },
    browse: async function (url) {
      const session = this.runtime.host.requireSession();
      this.runtime.root = this.actions.locationValue();
      if (!this.runtime.root) {
        throw new Error('files: Set the files root in Preferences.');
      }
      url = this.actions.inside(url);
      if (!new URL(url).pathname.endsWith('/')) {
        throw new Error('files: Folder URLs must end with /.');
      }
      const { entries, metadata } = await this.api.listFolder(
        session,
        this.runtime.root,
        url
      );
      this.runtime.current = url;
      this.data.url = url;
      this.runtime.files.state.data = this.api
        .from(entries)
        .select((entry) => ({
          url: entry.url,
          name: this.actions.decodeName(entry.url),
          type: entry.type,
          deleted: this.api.linkState(metadata, entry.url).deleted
        }))
        .toArray();
      this.actions.renderPicker();
      this.runtime.host.message(
        metadata
          ? 'Folder loaded.'
          : 'Folder loaded. This server did not advertise link metadata; deletion is unavailable.'
      );
      this.runtime.host.managed
        ?.publish()
        .catch((error) => this.runtime.host.message(error.message));
    },
    decodeName: function (url) {
      try {
        return decodeURIComponent(
          new URL(url).pathname.replace(/\/$/, '').split('/').pop()
        );
      } catch {
        return url;
      }
    },
    child: function (name) {
      if (!this.runtime.current) {
        throw new Error('files: Open a folder first.');
      }
      if (!name.trim() || /[\/\\]/.test(name) || ['.', '..'].includes(name)) {
        throw new Error('files: Use a filename without path separators.');
      }
      return new URL(encodeURIComponent(name), this.runtime.current).href;
    },
    operation: function (fn) {
      if (this.runtime.busy) {
        return;
      }
      this.runtime.busy = true;
      return this.runtime.host
        .run(
          async () => {
            try {
              return await fn();
            } catch (error) {
              if (this.runtime.pending) {
                await this.actions
                  .finishSelection({
                    error: {
                      code: 'failed',
                      message:
                        'Files could not complete selection. ' + error.message
                    }
                  })
                  .catch(() => {});
              }
              throw error;
            }
          },
          { network: true }
        )
        .finally(() => (this.runtime.busy = false));
    },

    initializeFiles() {
      const owner = this;
      const list = this.api.model({ data: [], options: { picker: false } });
      list.addEffect(function () {
        return owner.api.effect(() => this.state.data);
      });
      list.addEffect(function (input) {
        return owner.api.effect(() => {
          const picking = this.state.options.picker;
          return owner.api
            .from(input.current)
            .where(owner.actions.visibleFile)
            .select((entry) => owner.actions.fileRow(entry, picking))
            .toArray();
        });
      });
      this.runtime.files = list;
      this.runtime.listEffect = this.api.effect(() => {
        this.data.entries = list.view.current;
        this.data.empty =
          list.view.current.length || !this.runtime.current
            ? ''
            : 'This folder is empty.';
      });
    },
    visibleFile(entry) {
      return !entry.deleted;
    },
    fileRow(entry, picking) {
      return {
        url: entry.url,
        name: entry.name,
        type: entry.type,
        pick: { hidden: picking ? null : '' },
        edit: { hidden: picking ? '' : null }
      };
    },
    resourceKind(url) {
      const entry = this.api
        .from(this.data.entries)
        .where({ url })
        .toArray()[0];
      return entry?.type === 'folder'
        ? 'folder'
        : this.runtime.pending
          ? 'selection'
          : 'download';
    }
  }
};
