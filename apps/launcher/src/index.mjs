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
let workspaceBusy = false;
const container = host.main;
function workspaceMessage(message, remember = false) {
  ui.data.workspaceMessage = message;
  ui.data.conflictAction = { hidden: persistence?.conflict ? null : '' };
  if (remember) {
    try {
      sessionStorage.setItem('solid-apps.workspace-message', JSON.stringify({
        owner: host.session?.webId || '', message
      }));
    }
    catch {}
  }
}
function workspaceFailure(error) {
  if (!persistence?.reviewedDocument) {
    ui.data.conflictReview = { hidden: '' };
  }
  workspaceMessage(error.message || String(error), true);
  host.message(error.message || String(error));
}
async function workspaceOperation(operation, {
  network = false, allowConflict = false, message = 'Preparing workspace…'
} = {}) {
  if (workspaceBusy) {
    return;
  }
  workspaceBusy = true;
  ui.data.workspaceButtons = { disabled: '' };
  try {
    if (!workspace || !persistence) {
      throw new Error('launcher: Workspace is still loading.');
    }
    if (network && persistence.conflict && !allowConflict) {
      throw new Error('launcher: Pod conflict. Choose Review Pod conflict below.');
    }
    workspaceMessage(message);
    await (network ? host.requireSession().perform(operation) : operation());
  }
  catch (error) {
    workspaceFailure(error);
  }
  finally {
    workspaceBusy = false;
    ui.data.workspaceButtons = { disabled: null };
  }
}
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
    onMessage: message => workspaceMessage(message),
    onChange: async (snapshot, keys) => {
      if (workspace?.closing) {
        return;
      }
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
    !persistence.document || (!persistence.prepared && !persistence.conflict)) {
    await persistence.bind(session, url);
    if (![...workspace.instances.values()].some(record => record.win)) {
      createWorkspace();
    }
  }
  return { session, url };
}
async function saveWorkspace(close = false) {
  workspaceMessage('Collecting the latest app state…');
  await workspace.checkpoint();
  const { session, url } = await preparePod();
  workspaceMessage('Saving workspace to your Pod… Complete sign-in if requested.');
  if (!await persistence.save(session, url)) {
    throw new Error('launcher: State changed during saving. Save again before closing.');
  }
  workspaceMessage('Workspace saved to your Solid Pod.', true);
  if (close) {
    persistence.skipExit = true;
    workspace.closeApps();
    renderWorkspace();
    host.message('Workspace saved and managed apps closed.');
    workspaceMessage(
      'Workspace saved and managed apps closed. You can close this tab.', true
    );
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
    workspaceButtons: { disabled: null },
    conflictAction: { hidden: '' },
    conflictReview: { hidden: '' },
    localVersion: '',
    podVersion: '',
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
      workspaceOperation(() => saveWorkspace(), { network: true });
    },
    closeWorkspace() {
      workspaceOperation(() => saveWorkspace(true), { network: true });
    },
    reviewConflict() {
      workspaceOperation(async () => {
        const { local, remote } = await persistence.reviewConflict(
          host.requireSession(), host.resource('workspace')
        );
        if (!persistence.conflict) {
          ui.data.conflictReview = { hidden: '' };
          workspaceMessage(
            'Latest Pod version loaded. You can retry Save & close.', true
          );
          return;
        }
        ui.data.localVersion = JSON.stringify(local, null, 2);
        ui.data.podVersion = JSON.stringify(remote, null, 2);
        ui.data.conflictReview = { hidden: null };
        workspaceMessage(
          'Review both versions, then choose which workspace to keep.'
        );
      }, { network: true, allowConflict: true,
        message: 'Reading the latest Pod version…' });
    },
    keepLocalWorkspace() {
      workspaceOperation(async () => {
        await persistence.resolveConflict(host.requireSession(),
          host.resource('workspace'), 'local');
        ui.data.conflictReview = { hidden: '' };
        await saveWorkspace();
      }, { network: true, allowConflict: true });
    },
    usePodWorkspace() {
      workspaceOperation(async () => {
        workspace.closing = true;
        try {
          await persistence.resolveConflict(host.requireSession(),
            host.resource('workspace'), 'pod');
        }
        catch (error) {
          workspace.closing = false;
          throw error;
        }
        workspace.closeApps();
        createWorkspace();
        ui.data.conflictReview = { hidden: '' };
        workspace.restore();
        workspaceMessage(
          'Using the Pod workspace. Restore apps if popups were blocked.', true
        );
      });
    },
    closeLocally() {
      workspaceOperation(async () => {
        await workspace.checkpoint();
        await persistence.work.catch(() => {});
        await persistence.persist();
        persistence.skipExit = true;
        workspace.closeApps();
        renderWorkspace();
        host.message('Locally saved workspace retained; managed apps closed.');
        workspaceMessage(
          'Locally saved workspace retained; managed apps closed. ' +
          'You can close this tab.', true
        );
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
    try {
      await preparePod();
    }
    catch (error) {
      workspaceFailure(error);
    }
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
  persistence = new WorkspaceState({ owner: host.session?.webId || '',
    onStatus: message => workspaceFailure(new Error(message)) });
  await persistence.open();
  createWorkspace();
  workspaceMessage('App state is saved locally. Pod saves happen at checkpoints and closure.');
  try {
    const previous = JSON.parse(sessionStorage.getItem('solid-apps.workspace-message'));
    if (previous?.owner === (host.session?.webId || '')) {
      workspaceMessage('Previous attempt: ' + previous.message);
    }
  }
  catch {}
  if (host.session) {
    try {
      await preparePod();
    }
    catch (error) {
      workspaceFailure(error);
    }
  }
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
