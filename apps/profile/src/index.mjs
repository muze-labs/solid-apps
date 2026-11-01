import { writeDraft, readDraft } from '@muze-labs/solid-profile/state.mjs';
import { AppState } from '@muze-labs/solid-app-data/app-state.mjs';
import { apps } from '@muze-labs/solid-app-data/state-rdf.mjs';
import { app } from '@muze-labs/simplyflow/app';
import { shell } from '@muze-labs/solid-app-ui';
import { openCollection } from '@muze-labs/solid-app-data/collection.mjs';
import { createSolidMetroClient, httpUrl } from '@muze-labs/solid-app-data';
import {
  loadDocument,
  copyDocument,
  saveDocument
} from '@muze-labs/solid-app-data';
import { profileView } from '@muze-labs/solid-profile/view.mjs';
import { scalarPredicates, applyProfileEdits } from '@muze-labs/solid-profile';
const host = shell({ acceptLaunch: true });
const container = host.main.querySelector('.profile-content');
const widget = profileView(container, {
  emptyText: 'Enter a profile URL or connect to view your own profile.',
  onChange: () => host.managed?.publish().catch(error => host.message(error.message))
});
async function showRemote(url) {
  url = httpUrl(url);
  ui.data.url = url;
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
  host.managed?.publish().catch(error => host.message(error.message));
}
const ui = app({
  container: host.main.querySelector('.profile-controls'),
  data: { url: '' },
  commands: {
    load(form) {
      launchPending = false;
      host.run(() => showRemote(form.elements.url.value), { network: true });
    },
    mine() {
      launchPending = false;
      host.run(() => showRemote(host.requireSession().webId), {
        network: true
      });
    }
  }
});
let launchPending = Boolean(host.launch.resource);
let launchAttempted = false;
const contactId = new URL(location.href).searchParams.get('contact');
if (contactId && launchPending) {
  launchPending = false;
  host.message('profile: This link mixes a local contact with a Pod resource.');
}
else if (contactId && !host.launchError) {
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
async function openLaunch() {
  if (!launchPending || host.launchError) {
    return;
  }
  launchAttempted = true;
  ui.data.url = host.launch.resource;
  if (host.launch.webId && host.session?.webId !== host.launch.webId) {
    throw new Error(
      'profile: Use WebID / connection to connect as the WebID in this link.'
    );
  }
  await showRemote(host.launch.resource);
  launchPending = false;
}
host.onConnect = openLaunch;
await host.ready;
if (!launchAttempted) {
  await host.run(openLaunch, { network: true });
}
window.solidProfile = { host, ui };
const appState = new AppState();
host.manage({
  getState: () => {
    appState.set(apps + 'resourceInput', ui.data.url);
    let resource;
    try {
      resource = httpUrl(ui.data.url);
    }
    catch {}
    appState.set(apps + 'resource', resource, 'iri');
    appState.set(apps + 'contact', contactId, 'iri');
    writeDraft(appState, widget.draft());
    return appState.snapshot();
  },
  restoreState: async state => {
    appState.restore(state);
    const url = appState.read(apps + 'resourceInput');
    if (url && !contactId) {
      launchPending = false;
      await showRemote(url);
    }
    widget.restoreDraft(readDraft(appState));
  }
});
