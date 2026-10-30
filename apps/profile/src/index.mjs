import { app } from '@muze-labs/simplyflow/app';
import { shell } from '@muze-labs/solid-app-ui';
import { openCollection } from '@muze-labs/solid-app-data/collection.mjs';
import { createSolidMetroClient } from '@muze-labs/solid-app-data';
import {
  loadDocument,
  copyDocument,
  saveDocument
} from '@muze-labs/solid-app-data';
import { profileView } from '@muze-labs/solid-profile/view.mjs';
import { scalarPredicates, applyProfileEdits } from '@muze-labs/solid-profile';
const host = shell();
const container = host.main.querySelector('.profile-content');
const widget = profileView(container, {
  emptyText: 'Enter a profile URL or connect to view your own profile.'
});
async function showRemote(url) {
  const client =
    host.session?.client ||
    createSolidMetroClient(url, { oidc: false, oldm: false });
  const document = await loadDocument(client, url);
  const node = document.graph.get(url);
  if (!node) {
    throw new Error(
      'profile: That subject is not present in the profile document.'
    );
  }

  widget.show(node, {
    editable: Boolean(host.session && url === host.session.webId),
    sourceLabel: 'Profile document: ' + document.url,
    onSave: async (edits) => {
      const draft = await copyDocument(document);
      applyProfileEdits(draft.graph.get(url), edits);
      await host.session.perform(() => saveDocument(client, draft));
      await showRemote(url);
      host.message('Profile saved to Solid.');
    }
  });
}
const ui = app({
  container: host.main.querySelector('.profile-controls'),
  data: {},
  commands: {
    load(form) {
      host.run(() => showRemote(form.elements.url.value), { network: true });
    },
    mine() {
      host.run(() => showRemote(host.requireSession().webId), {
        network: true
      });
    }
  }
});
const contactId = new URL(location.href).searchParams.get('contact');
if (contactId) {
  await host.run(async () => {
    const store = await openCollection('contacts', { scalarPredicates });
    const render = () => {
      const node = store.collection.get(contactId);
      if (!node) {
        throw new Error(
          'profile: Contact not found on this device. Open Contacts and synchronize your address book.'
        );
      }
      widget.show(node, {
        editable: true,
        sourceLabel: 'Your private address book',
        onSave: async (edits) => {
          applyProfileEdits(store.collection.get(contactId), edits);
          await store.collection.save(store.collection.get(contactId));
          render();
          host.message('Contact profile saved on this device.');
        }
      });
    };
    render();
  });
}
host.onConnect = () => {};
window.solidProfile = { host, ui };
