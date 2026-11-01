import { app } from '@muze-labs/simplyflow/app';
import { shell } from '@muze-labs/solid-app-ui';
import { appServices } from '@muze-labs/solid-app-ui/capabilities.mjs';
import {
  browseCapability, browseInput, selectionUrl
} from '@muze-labs/solid-app-data/capabilities.mjs';
import { openCollection } from '@muze-labs/solid-app-data/collection.mjs';
import { prefixes, valueAt, idOf, httpUrl } from '@muze-labs/solid-app-data';
import { launchUrl } from '@muze-labs/solid-app-data/launch.mjs';
import {
  shortcutLaunch, applyLaunchOverride, overridePredicate,
  applyAnonymousLaunch, anonymousPredicate
} from './shortcuts.mjs';
const host = shell();
let store;
let selection;
const services = appServices(host);
const container = host.main;
function openApplication(href) {
  const features = host.preferences.launchTarget === 'window'
    ? 'popup,noopener'
    : 'noopener';
  window.open(href, '_blank', features);
}
function renderLinks() {
  for (const name of ['contacts', 'files', 'profile']) {
    const target = new URL('../' + name + '/', location.href).href;
    let href = target;
    if (host.session) {
      href = launchUrl(target, { webId: host.session.webId });
    }
    ui.data[name + 'Link'] = { href };
  }
}
function render() {
  const nodes = store.collection
    .list()
    .filter((node) =>
      [].concat(node.a || []).includes(prefixes.schema + 'SoftwareApplication')
    );
  ui.data.shortcuts = nodes.map((node) => {
    const url = idOf(valueAt(node, prefixes.schema + 'url'));
    let settings = { href: null, override: '', location: '', anonymous: false };
    let problem = '';
    try {
      settings = shortcutLaunch(node, host.session?.webId);
    }
    catch (error) {
      problem = error.message;
    }
    let modeNote = '';
    if (settings.location === 'query') {
      modeNote = 'Query mode sends your WebID and resource URL to the app’s server.';
      if (settings.anonymous) {
        modeNote = 'Query mode sends only a specified resource URL to the app’s server.';
      }
    }
    else if (settings.location === 'fragment') {
      modeNote = 'Uses URL fragment (#).';
    }
    return {
      id: node.id,
      label: String(valueAt(node, prefixes.schema + 'name') || url),
      mode: settings.override,
      anonymous: settings.anonymous,
      modeNote,
      problem,
      link: { href: settings.href, target: '_blank', rel: 'noopener' }
    };
  });
  ui.data.empty = nodes.length
    ? ''
    : 'Add links to other applications you use.';
}
const ui = app({
  container,
  data: {
    shortcuts: [],
    empty: '',
    resource: '',
    pickerMessage: '',
    pickState: { disabled: null },
    cancelState: { hidden: '' },
    contactsLink: { href: '../contacts/' },
    filesLink: { href: '../files/' },
    profileLink: { href: '../profile/' }
  },
  commands: {
    pickResource() {
      if (selection) {
        return;
      }
      host.run(async () => {
        const client = services.client;
        selection = new AbortController();
        ui.data.pickState = { disabled: '' };
        ui.data.cancelState = { hidden: null };
        ui.data.pickerMessage = 'Choose a resource in the connected Files app.';
        try {
          const result = await client.request(browseCapability, browseInput, {
            signal: selection.signal
          });
          ui.data.resource = selectionUrl(result);
          ui.data.pickerMessage = 'Resource selected. Review the URL before opening.';
        }
        catch (error) {
          ui.data.pickerMessage = error.message;
        }
        finally {
          selection = null;
          ui.data.pickState = { disabled: null };
          ui.data.cancelState = { hidden: '' };
        }
      });
    },
    cancelPick() {
      selection?.abort();
    },
    setAnonymous(element, id) {
      host.run(async () => {
        const subject = store.collection.get(id);
        applyAnonymousLaunch(subject, element.checked);
        await store.collection.save(subject);
        render();
        host.message('Launch identity saved on this device.');
      });
    },
    setLaunchMode(element, id) {
      host.run(async () => {
        const subject = store.collection.get(id);
        applyLaunchOverride(subject, element.value);
        await store.collection.save(subject);
        render();
        host.message('Launch mode saved on this device.');
      });
    },
    launchApp(element) {
      host.run(() => {
        if (!element.getAttribute('href')) {
          throw new Error('launcher: Connect to Solid to open this resource.');
        }
        openApplication(element.href);
      });
    },
    launchProfile(form) {
      host.run(() => {
        let webId = '';
        if (!form.elements.anonymous.checked) {
          webId = host.requireSession().webId;
        }
        const target = new URL('../profile/', location.href).href;
        const href = launchUrl(target, {
          webId,
          resource: form.elements.resource.value
        });
        openApplication(href);
      });
    },
    add(form) {
      host.run(async () => {
        const url = httpUrl(form.elements.url.value);
        const mode = form.elements.launchMode.value;
        const anonymous = form.elements.anonymous.checked;
        if (!['', 'fragment', 'query'].includes(mode)) {
          throw new Error('launcher: Choose a supported launch mode.');
        }
        const subject = await store.collection.create({
          id: 'urn:uuid:' + crypto.randomUUID(),
          a: prefixes.schema + 'SoftwareApplication',
          schema$name: form.elements.name.value,
          schema$url: { id: url },
          dcterms$modified: new Date().toISOString()
        });
        if (mode) {
          applyLaunchOverride(subject, mode);
        }
        if (anonymous) {
          applyAnonymousLaunch(subject, true);
        }
        if (mode || anonymous) {
          await store.collection.save(subject);
        }
        form.reset();
        render();
        host.message('Shortcut saved on this device.');
      });
    },
    remove(_element, id) {
      host.run(async () => {
        await store.collection.delete(id);
        render();
        host.message('Shortcut marked deleted.');
      });
    },
    sync() {
      host.run(
        async () => {
          await store.connect(host.requireSession(), host.resource('launcher'));
          render();
          host.message('Shortcuts synchronized with Solid.');
        },
        { network: true }
      );
    }
  }
});
host.onConnect = () => {
  renderLinks();
  if (store) {
    render();
  }
};
renderLinks();
await host.run(async () => {
  store = await openCollection('launcher', {
    scalarPredicates: [
      prefixes.schema + 'name',
      prefixes.schema + 'url',
      overridePredicate,
      anonymousPredicate
    ]
  });
  render();
});
window.solidLauncher = {
  host,
  ui,
  get store() {
    return store;
  }
};
