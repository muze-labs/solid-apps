import { app } from '@muze-labs/simplyflow/app';
import { shell } from '@muze-labs/solid-app-ui';
import { browseCapability } from '@muze-labs/solid-app-data/capabilities.mjs';
import { SolidAdapter, requireOk, httpUrl } from '@muze-labs/solid-app-data';
import {
  loadContainerMetadata,
  linkState,
  markResourceDeleted,
  parentContainer
} from '@muze-labs/solid-app-data/link-metadata.mjs';
const host = shell();
const container = host.main.querySelector('.file-controls');
let current = '',
  root = '',
  busy = false;
let pending = null;
let selecting = false;
let restoredFolder = '';
function renderPicker() {
  ui.data.picker = { hidden: pending ? null : '' };
  ui.data.editing = { hidden: pending ? '' : null };
  ui.data.requester = pending
    ? pending.requester.application + ' (' + pending.requester.origin + ')' : '';
  ui.data.entries = ui.data.entries.map(entry => ({ ...entry,
    pick: { hidden: pending ? null : '' },
    edit: { hidden: pending ? '' : null }
  }));
}
const managedOptions = {
  capabilities: [browseCapability],
  onRequest(event) {
    let error;
    if (pending || selecting) {
      error = { code: 'busy', message: 'Files is handling another selection.' };
    }
    else if (!host.session) {
      error = { code: 'denied', message: 'Connect Files to Solid first.' };
    }
    else if (event.capability !== browseCapability ||
      Object.keys(event.input).some(key => key !== '@context')) {
      error = { code: 'invalid', message: 'Unsupported selection request.' };
    }
    if (error) {
      host.message(error.message);
      host.run(() => host.managed.respond(event.id, { error }));
      return;
    }
    pending = event;
    renderPicker();
    host.message('A resource selection is waiting in Files.');
  },
  onCancel(event) {
    if (pending?.id === event.id) {
      pending = null;
      renderPicker();
      host.message(event.error?.message || 'Selection cancelled.');
    }
  }
};
async function finishSelection(response) {
  if (!pending || selecting) {
    return;
  }
  const id = pending.id;
  selecting = true;
  try {
    await host.managed.respond(id, response);
    host.message((response.error ? 'Selection cancelled.' : 'Resource URL returned.') +
      ' Return to Launcher if your browser did not switch tabs.');
  }
  finally {
    selecting = false;
    if (pending?.id === id) {
      pending = null;
      renderPicker();
    }
  }
}
function locationValue() {
  return host.preferences.filesRoot || host.session?.storage[0] || '';
}
function inside(url) {
  const normalized = httpUrl(url);
  if (!root || !normalized.startsWith(root)) {
    throw new Error('files: Choose a folder within the configured files root.');
  }
  return normalized;
}
async function browse(url) {
  const session = host.requireSession();
  root = locationValue();
  if (!root) {
    throw new Error('files: Set the files root in Preferences.');
  }
  url = inside(url);
  if (!new URL(url).pathname.endsWith('/')) {
    throw new Error('files: Folder URLs must end with /.');
  }
  const adapter = new SolidAdapter(root, {
    metroClient: session.client,
    solid: session.solid
  });
  const entries = await adapter.list(url);
  const metadata = await loadContainerMetadata(session.client, url);
  current = url;
  ui.data.url = url;
  const visible = entries.filter(
    (entry) => !linkState(metadata, entry.url).deleted
  );
  ui.data.entries = visible.map((entry) => ({
    url: entry.url,
    name: decodeName(entry.url),
    type: entry.type
  }));
  renderPicker();
  ui.data.empty = visible.length ? '' : 'This folder is empty.';
  host.message(
    metadata
      ? 'Folder loaded.'
      : 'Folder loaded. This server did not advertise link metadata; deletion is unavailable.'
  );
  host.managed?.publish().catch(error => host.message(error.message));
}
function decodeName(url) {
  try {
    return decodeURIComponent(
      new URL(url).pathname.replace(/\/$/, '').split('/').pop()
    );
  }
  catch {
    return url;
  }
}
function child(name) {
  if (!current) {
    throw new Error('files: Open a folder first.');
  }
  if (!name.trim() || /[\/\\]/.test(name) || ['.', '..'].includes(name)) {
    throw new Error('files: Use a filename without path separators.');
  }
  return new URL(encodeURIComponent(name), current).href;
}
function operation(fn) {
  if (busy) {
    return;
  }
  busy = true;
  host.run(async () => {
    try {
      return await fn();
    }
    catch (error) {
      if (pending) {
        await finishSelection({ error: { code: 'failed',
          message: 'Files could not complete selection. ' + error.message
        } }).catch(() => {});
      }
      throw error;
    }
  }, { network: true }).finally(() => (busy = false));
}
function download(url) {
  operation(async () => {
    const session = host.requireSession();
    const response = requireOk(
      await session.client.get(inside(url), { headers: { Accept: '*/*' } })
    );
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = decodeName(url);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  });
}
const ui = app({
  container,
  data: { entries: [], url: '', empty: '', picker: { hidden: '' },
    editing: { hidden: null }, requester: '' },
  commands: {
    selectResource(_element, url) {
      host.run(() => {
        if (!ui.data.entries.some(entry => entry.url === url)) {
          throw new Error('files: Select a resource from the current folder.');
        }
        return finishSelection({ result: { '@id': inside(url) } });
      });
    },
    selectFolder() {
      host.run(() => finishSelection({ result: { '@id': inside(current) } }));
    },
    cancelSelection() {
      host.run(() => finishSelection({ error: {
        code: 'cancelled', message: 'Selection cancelled in Files.'
      } }));
    },
    browse(form) {
      operation(() => browse(form.elements.url.value));
    },
    open(element, url) {
      const entry = ui.data.entries.find((entry) => entry.url === url);
      if (entry?.type === 'folder') {
        operation(() => browse(url));
      }
      else {
        if (pending) {
          host.run(() => finishSelection({ result: { '@id': inside(url) } }));
        }
        else {
          download(url);
        }
      }
    },
    up() {
      operation(() => browse(inside(parentContainer(current))));
    },
    mkdir(form) {
      operation(async () => {
        const session = host.requireSession();
        await session.solid.createContainer(
          child(form.elements.name.value) + '/'
        );
        form.reset();
        await browse(current);
      });
    },
    upload(input) {
      const files = [...input.files];
      operation(async () => {
        const session = host.requireSession();
        let saved = 0;
        try {
          for (const file of files) {
            requireOk(
              await session.client.put(child(file.name), {
                body: file,
                headers: {
                  'Content-Type': file.type || 'application/octet-stream',
                  'If-None-Match': '*'
                }
              })
            );
            saved++;
          }
        }
        catch (error) {
          throw new Error(
            `files: ${saved} of ${files.length} files uploaded. ${error.message}`
          );
        }
        finally {
          input.value = '';
        }
        await browse(current);
        host.message(`${saved} files uploaded.`);
      });
    },

    remove(_element, url) {
      operation(async () => {
        const session = host.requireSession();
        if (
          !confirm(
            'Mark this resource deleted? Its contents will be retained; link-metadata-aware clients will hide it.'
          )
        ) {
          return;
        }
        await markResourceDeleted(session.client, inside(url));
        await browse(current);
        host.message('Marked deleted. Contents retained.');
      });
    }
  }
});
host.onConnect = async () => {
  const url = restoredFolder || locationValue();
  if (url) {
    await browse(url);
  }
};
host.manage({ ...managedOptions,
  getState: () => ({ folder: current || restoredFolder }),
  restoreState: async state => {
    restoredFolder = state?.folder || '';
    if (host.session && restoredFolder) {
      await browse(restoredFolder);
    }
  }
});
window.solidFiles = { host, ui };
