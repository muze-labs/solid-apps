import { SolidAdapter, requireOk } from '@muze-labs/solid-app-data';
import { loadContainerMetadata } from '@muze-labs/solid-app-data/link-metadata.mjs';

export async function listFolder(session, root, url) {
  const adapter = new SolidAdapter(root, {
    metroClient: session.client,
    solid: session.solid
  });
  const entries = await adapter.list(url);
  const metadata = await loadContainerMetadata(session.client, url);
  return { entries, metadata };
}

export async function readDownload(session, url) {
  const response = requireOk(await session.client.get(url, {
    headers: { Accept: '*/*' }
  }));
  return response.blob();
}

export async function uploadFiles(session, files, urlFor) {
  let saved = 0;
  try {
    for (const file of files) {
      requireOk(await session.client.put(urlFor(file.name), {
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'If-None-Match': '*'
        }
      }));
      saved++;
    }
  }
  catch (error) {
    throw new Error(
      `files: ${saved} of ${files.length} files uploaded. ${error.message}`);
  }
  return saved;
}
