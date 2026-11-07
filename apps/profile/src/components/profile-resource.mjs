import sourceProfileResource from '../resource.html' with { type: 'text' };

export const profileResource = {
  templates: { 'profile-resource': sourceProfileResource },
  commands: {
    load(form) {
      const url = form.elements.url.value;
      return this.runtime.host.run(() => this.actions.viewResource(url), {
        network: true
      });
    },
    mine() {
      return this.runtime.host.run(
        () =>
          this.actions.viewResource(this.runtime.host.requireSession().webId),
        { network: true }
      );
    }
  },
  actions: {
    showRemote: async function (url) {
      url = this.api.httpUrl(url);
      this.data.url = url;
      const client =
        this.runtime.host.session?.client ||
        this.api.createSolidMetroClient(url, { oidc: false, oldm: false });
      const document = await this.api.loadDocument(client, url);
      const node = document.graph.get(url);
      if (!node) {
        throw new Error(
          'profile: That subject is not present in the profile document.'
        );
      }

      this.runtime.widget.show(node, {
        editable: Boolean(
          this.runtime.host.session && url === this.runtime.host.session.webId
        ),
        sourceLabel: 'Profile document: ' + document.url,
        onSave: async (edits) => {
          const draft = await this.api.copyDocument(document);
          this.api.applyProfileEdits(draft.graph.get(url), edits);
          await this.runtime.host.session.perform(() =>
            this.api.saveDocument(client, draft)
          );
          await this.actions.showRemote(url);
          this.runtime.host.notify('Profile saved to Solid.');
          await this.actions.muzeSolidProfileComplete(url);
        }
      });
      this.runtime.host.managed
        ?.publish()
        .catch((error) => this.runtime.host.message(error.message));
    },
    openLaunch: async function () {
      if (!this.runtime.launchPending || this.runtime.host.launchError) {
        return;
      }
      this.runtime.launchAttempted = true;
      this.data.url = this.runtime.host.launch.resource;
      if (
        this.runtime.host.launch.webId &&
        this.runtime.host.session?.webId !== this.runtime.host.launch.webId
      ) {
        throw new Error(
          'profile: Use WebID / connection to connect as the WebID in this link.'
        );
      }
      await this.actions.showRemote(this.runtime.host.launch.resource);
      this.runtime.launchPending = false;
    },
    viewResource(url) {
      this.runtime.launchPending = false;
      return this.actions.showRemote(url);
    },
    showLocalContact() {
      const node = this.runtime.store.collection.get(this.runtime.contactId);
      if (!node) {
        throw new Error(
          'profile: Contact not found on this device. Open Contacts and synchronize your address book.'
        );
      }
      this.runtime.widget.show(node, {
        editable: true,
        sourceLabel: 'Your private address book',
        onSave: this.actions.saveLocalContact
      });
    },
    async saveLocalContact(edits) {
      const node = this.runtime.store.collection.get(this.runtime.contactId);
      this.api.applyProfileEdits(node, edits);
      await this.runtime.store.collection.save(node);
      this.actions.showLocalContact();
      this.runtime.host.notify('Contact profile saved on this device.');
    }
  }
};
