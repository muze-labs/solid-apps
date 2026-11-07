import sourceContactsDetails from '../details.html' with { type: 'text' };

export const contactEditing = {
  templates: { 'contacts-details': sourceContactsDetails },
  actions: {
    async addContact(name) {
      if (!this.runtime.store) {
        return;
      }
      const node = await this.runtime.store.collection.create({
        id: 'urn:uuid:' + crypto.randomUUID(),
        a: this.api.prefixes.vcard + 'Individual',
        vcard$fn: name,
        dcterms$modified: new Date().toISOString()
      });
      this.actions.refreshPeople();
      this.actions.selectContact(node.id);
    },
    async saveContact(id, edits) {
      const node = this.runtime.store.collection.get(id);
      this.api.applyProfileEdits(node, edits);
      await this.runtime.store.collection.save(node);
      this.actions.refreshPeople();
      this.actions.selectContact(id);
      this.runtime.host.message(
        'Saved on this device. Use Sync with Solid to synchronize.'
      );
    },
    async deleteContact(id) {
      await this.runtime.store.collection.delete(id);
      this.actions.refreshPeople();
      this.actions.selectContact(null);
      this.runtime.host.message('Contact marked deleted.');
    },
    async synchronizeContacts() {
      await this.runtime.store.connect(
        this.runtime.host.requireSession(),
        this.runtime.host.resource('contacts')
      );
      this.actions.refreshPeople();
      if (this.runtime.selected) {
        this.actions.selectContact(this.runtime.selected);
      }
      this.runtime.host.message('Contacts synchronized with Solid.');
    }
  },
  commands: {
    newContact() {
      this.container.querySelector('.new-contact-dialog').showModal();
    },
    cancelNew() {
      this.container.querySelector('.new-contact-dialog').close();
    },
    add(form) {
      const name = form.elements.name.value.trim();
      return this.runtime.host.run(async () => {
        await this.actions.addContact(name);
        form.reset();
        this.container.querySelector('.new-contact-dialog').close();
      });
    },
    remove() {
      const id = this.runtime.selected;
      if (
        id &&
        confirm(
          'Delete this contact? A tombstone will remain in your address book.'
        )
      ) {
        return this.runtime.host.run(() => this.actions.deleteContact(id));
      }
    },
    sync() {
      return this.runtime.host.run(this.actions.synchronizeContacts, {
        network: true
      });
    }
  }
};
