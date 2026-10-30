import { app } from '@muze-labs/simplyflow/app';
import { shell } from '@muze-labs/solid-app-ui';
import {
  openCollection,
  isPerson
} from '@muze-labs/solid-app-data/collection.mjs';
import { prefixes } from '@muze-labs/solid-app-data';
import {
  profileLabel,
  readProfile,
  applyProfileEdits,
  scalarPredicates
} from '@muze-labs/solid-profile';
import { profileView } from '@muze-labs/solid-profile/view.mjs';
const host = shell();
let store, selected;
const listRoot = host.main.querySelector('.contacts-list'),
  profileRoot = host.main.querySelector('.contact-profile');
function render(filter = '') {
  const people = store.collection
    .list()
    .filter(isPerson)
    .filter((node) =>
      Object.values(readProfile(node))
        .join(' ')
        .toLowerCase()
        .includes(filter.toLowerCase())
    )
    .sort((a, b) => profileLabel(a).localeCompare(profileLabel(b)));
  ui.data.people = people.map((node) => ({
    id: node.id,
    label: profileLabel(node)
  }));
  ui.data.empty = people.length ? '' : 'No contacts yet.';
}
const widget = profileView(profileRoot, {
  emptyText: 'Select a contact to view their profile.'
});
const newContactDialog = listRoot.querySelector('.new-contact-dialog');
const actions = app({
  container: host.main.querySelector('.contact-actions'),
  data: { visibility: { hidden: '' } },
  commands: {
    remove() {
      host.run(async () => {
        if (
          !selected ||
          !confirm(
            'Delete this contact? A tombstone will remain in your address book.'
          )
        ) {
          return;
        }
        await store.collection.delete(selected);
        render();
        show(null);
        host.message('Contact marked deleted.');
      });
    }
  }
});
function show(id) {
  selected = id;
  const node = id ? store.collection.get(id) : null;
  actions.data.visibility = { hidden: node ? null : '' };
  widget.show(node, {
    editable: true,
    sourceLabel: 'Your private address book',
    onSave: async (edits) => {
      const current = store.collection.get(id);
      applyProfileEdits(current, edits);
      await store.collection.save(current);
      render();
      show(id);
      host.message('Saved on this device. Use Sync with Solid to synchronize.');
    }
  });
}
const ui = app({
  container: listRoot,
  data: { people: [], empty: '' },
  commands: {
    newContact() {
      newContactDialog.showModal();
    },
    cancelNew() {
      newContactDialog.close();
    },
    add(form) {
      host.run(async () => {
        if (!store) {
          return;
        }
        const node = await store.collection.create({
          id: 'urn:uuid:' + crypto.randomUUID(),
          a: prefixes.vcard + 'Individual',
          vcard$fn: form.elements.name.value.trim(),
          dcterms$modified: new Date().toISOString()
        });
        form.reset();
        newContactDialog.close();
        render();
        show(node.id);
      });
    },
    select(_element, id) {
      show(id);
    },
    search(element) {
      if (store) {
        render(element.value);
      }
    },
    sync() {
      host.run(
        async () => {
          const session = host.requireSession();
          await store.connect(session, host.resource('contacts'));
          render();
          if (selected) {
            show(selected);
          }
          host.message('Contacts synchronized with Solid.');
        },
        { network: true }
      );
    }
  }
});
await host.run(async () => {
  store = await openCollection('contacts', { scalarPredicates });
  render();
});
host.onConnect = () => {
  host.message(
    'Connected. Choose Sync with Solid to attach your address book.'
  );
};
window.solidContacts = {
  host,
  ui,
  get store() {
    return store;
  }
};
