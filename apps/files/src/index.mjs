import { app } from '@muze-labs/simplyflow/app';
import { shell } from '@muze-labs/solid-app-ui';
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
  ui.data.empty = visible.length ? '' : 'This folder is empty.';
  host.message(
    metadata
      ? 'Folder loaded.'
      : 'Folder loaded. This server did not advertise link metadata; deletion is unavailable.'
  );
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
  host.run(fn, { network: true }).finally(() => (busy = false));
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
  data: { entries: [], url: '', empty: '' },
  commands: {
    browse(form) {
      operation(() => browse(form.elements.url.value));
    },
    open(element, url) {
      const entry = ui.data.entries.find((entry) => entry.url === url);
      if (entry?.type === 'folder') {
        operation(() => browse(url));
      }
      else {
        download(url);
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
  const url = locationValue();
  if (url) {
    await browse(url);
  }
};
window.solidFiles = { host, ui };
