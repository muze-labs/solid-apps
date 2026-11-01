import { app } from '@muze-labs/simplyflow/app';
import { shell } from '@muze-labs/solid-app-ui';
import { WorkspaceBroker } from '@muze-labs/solid-app-data/workspace-broker.mjs';
import { WorkspaceState } from '@muze-labs/solid-app-data/workspace-state.mjs';
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
let workspace, persistence;
const container = host.main;
function openApplication(href, options) {
  if (!workspace) {
    throw new Error('launcher: Workspace is still loading.');
  }
  return workspace.open(href, options);
}
function renderWorkspace() {
  ui.data.workspaceEntries = [...workspace.instances.values()].map(record => ({
    id: record.entry.id, label: record.entry.label || record.entry.url,
    allowBrowse: record.entry.allowBrowse,
    status: record.registered ? 'Connected' :
      record.win && !record.win.closed ? 'Opening' : 'Saved'
  }));
}
function createWorkspace() {
  workspace?.dispose();
  workspace = new WorkspaceBroker({ snapshot: persistence.snapshot,
    keys: persistence.keys,
    authorize: (requester, entry, capability) => requester === 'launcher' &&
      entry.allowBrowse && capability === browseCapability,
    onMessage: message => { ui.data.workspaceMessage = message; },
    onChange: async (snapshot, keys) => {
      await persistence.stage(snapshot, keys);
      renderWorkspace();
    }
  });
  workspace.presentation = host.preferences.launchTarget;
  ui.data.resource = persistence.snapshot.launcher?.resource || '';
  renderWorkspace();
}
async function preparePod() {
  const session = host.requireSession();
  const url = host.resource('workspace');
  if (persistence.session !== session || persistence.url !== url ||
    !persistence.document) {
    await persistence.bind(session, url);
    if (![...workspace.instances.values()].some(record => record.win)) {
      createWorkspace();
    }
  }
  return { session, url };
}
async function saveWorkspace(close = false) {
  await workspace.checkpoint();
  const { session, url } = await preparePod();
  if (!await persistence.save(session, url)) {
    throw new Error('launcher: State changed during saving. Save again before closing.');
  }
  ui.data.workspaceMessage = 'Workspace saved to your Solid Pod.';
  if (close) {
    persistence.skipExit = true;
    workspace.closeApps();
    renderWorkspace();
    host.message('Workspace saved and managed apps closed.');
    window.close();
  }
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
      link: { href: settings.href, target: '_blank', rel: 'opener' }
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
    workspaceEntries: [],
    workspaceMessage: 'Loading workspace…',
    contactsLink: { href: '../contacts/' },
    filesLink: { href: '../files/' },
    profileLink: { href: '../profile/' }
  },
  commands: {
    workspaceChanged(element) {
      if (workspace) {
        workspace.launcherState.resource = element.value;
        host.run(() => workspace.changed());
      }
    },
    restoreWorkspace() {
      workspace?.restore();
    },
    restoreInstance(_element, id) {
      const record = workspace.instances.get(id);
      workspace.open(record.entry.url, { id });
    },
    allowBrowse(element, id) {
      host.run(() => workspace.allow(id, element.checked));
    },
    closeInstance(_element, id) {
      host.run(() => workspace.remove(id));
    },
    saveWorkspace() {
      host.run(() => saveWorkspace(), { network: true });
    },
    closeWorkspace() {
      host.run(() => saveWorkspace(true), { network: true });
    },
    closeLocally() {
      host.run(async () => {
        await workspace.checkpoint();
        await persistence.work.catch(() => {});
        await persistence.persist();
        persistence.skipExit = true;
        workspace.closeApps();
        renderWorkspace();
        host.message('Locally saved workspace retained; managed apps closed.');
        window.close();
      });
    },
    pickResource() {
      if (selection) {
        return;
      }
      host.run(async () => {
        selection = new AbortController();
        ui.data.pickState = { disabled: '' };
        ui.data.cancelState = { hidden: null };
        ui.data.pickerMessage = 'Choose a resource in the connected Files app.';
        try {
          const result = await workspace.request(browseCapability, browseInput, {
            signal: selection.signal
          });
          ui.data.resource = selectionUrl(result);
          workspace.launcherState.resource = ui.data.resource;
          await workspace.changed();
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
        const isFiles = element.closest('.app-grid') &&
          element === host.main.querySelector('.app-grid a[href*=files]');
        openApplication(element.href, { label: element.textContent.trim(),
          allowBrowse: Boolean(isFiles) });
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
host.onConnect = async () => {
  renderLinks();
  if (store) {
    render();
  }
  if (persistence) {
    await preparePod();
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
await host.ready;
await host.run(async () => {
  persistence = new WorkspaceState({ owner: host.session?.webId || '' });
  await persistence.open();
  createWorkspace();
  if (host.session) {
    await preparePod();
  }
  ui.data.workspaceMessage = 'App state is saved locally. Pod saves happen at checkpoints and closure.';
  setTimeout(() => workspace.restore(), 900);
});
host.onPreferences = values => {
  if (workspace) {
    workspace.presentation = values.launchTarget;
  }
};
let exitAttempted = false;
function attemptExit() {
  if (exitAttempted || !persistence || !host.session) {
    return;
  }
  exitAttempted = true;
  persistence.attemptExit(host.session, host.resource('workspace'));
}
window.addEventListener('beforeunload', attemptExit);
window.addEventListener('pagehide', attemptExit);
window.solidLauncher = {
  host,
  ui,
  get workspace() { return workspace; },
  get persistence() { return persistence; },
  get store() {
    return store;
  }
};
