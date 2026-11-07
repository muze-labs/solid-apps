import { from } from '@muze-nl/jaqt';
import {
  browseCapability,
  browseInput
} from '@muze-labs/solid-app-data/capabilities.mjs';

export async function chooseFiles(
  workspace,
  filesUrl,
  { signal, onWait = () => {}, timeout = 30000 } = {}
) {
  if (signal?.aborted) {
    throw new Error('launcher-picker: Selection cancelled.');
  }
  const instances = [...workspace.instances.values()];
  const live = from(instances)
    .where(
      (record) =>
        record.entry.allowBrowse &&
        record.win &&
        !record.win.closed &&
        (!record.registered || record.capabilities.includes(browseCapability))
    )
    .toArray();
  if (live.length > 1) {
    throw new Error(
      'launcher-picker: More than one provider is available. ' +
        'Allow resource selection for just one instance in the workspace.'
    );
  }
  let provider = live[0];
  if (!provider) {
    const target = new URL(filesUrl);
    const builtIn = from(instances)
      .where((record) => {
        const url = new URL(record.entry.url);
        return url.origin === target.origin && url.pathname === target.pathname;
      })
      .toArray();
    const allowed = from(builtIn)
      .where((record) => record.entry.allowBrowse)
      .toArray();
    if (allowed.length > 1) {
      throw new Error(
        'launcher-picker: Allow resource selection for just one ' +
          'saved Files instance in the workspace.'
      );
    }
    if (!allowed.length && builtIn.length) {
      throw new Error(
        'launcher-picker: Enable Allow resource selection for ' +
          'a Files instance in the workspace, then retry.'
      );
    }
    provider = allowed[0];
  }
  // Keep window opening/focus in the original click, before awaiting startup.
  provider = provider
    ? workspace.open(provider.entry.url, { id: provider.entry.id })
    : workspace.open(filesUrl, { label: 'Files', allowBrowse: true });
  onWait(provider.ready ? 'Choose a resource in Files.' : 'Opening Files…');
  await workspace.whenReady(provider.entry.id, { signal, timeout });
  if (!provider.capabilities.includes(browseCapability)) {
    throw new Error(
      'launcher-picker: This app does not offer resource selection.'
    );
  }
  onWait('Choose a resource in Files. Switch to its tab if it stays behind.');
  return workspace.request(browseCapability, browseInput, {
    signal,
    providerId: provider.entry.id
  });
}
