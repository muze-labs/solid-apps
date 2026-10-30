import {
  loadDocument,
  copyDocument,
  saveDocument,
  prefixes,
  valueAt,
  documentUrl,
  httpUrl,
  requireOk
} from './index.mjs';

export function parentContainer(resourceUrl) {
  const url = new URL(httpUrl(resourceUrl));
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/$/, '').replace(/[^/]*$/, '');
  return url.href;
}
export function descriptionLink(header, base) {
  // Link relation tokens are case-insensitive; relative targets resolve at the response URL.
  for (const match of (header || '').matchAll(/<([^>]+)>\s*((?:;[^,]*)?)/g)) {
    const rel = match[2].match(/;\s*rel\s*=\s*(?:"([^"]*)"|([^;\s]+))/i);
    if (
      rel &&
      (rel[1] || rel[2])
        .split(/\s+/)
        .some((v) => ['describedby', 'describes'].includes(v.toLowerCase()))
    ) {
      return httpUrl(match[1], base);
    }
  }
  return null;
}
export async function loadContainerMetadata(client, container) {
  const response = requireOk(await client.head(container));
  const url = descriptionLink(
    response.headers.get('Link'),
    response.url || container
  );
  return url ? loadDocument(client, url, { allowMissing: true }) : null;
}
export function linkState(document, uri) {
  const node = document?.graph.get(uri);
  return {
    deleted: valueAt(node, prefixes.lm + 'deleted') !== undefined,
    destination: valueAt(node, prefixes.lm + 'redirectPermanent')
  };
}
export async function markResourceDeleted(client, url) {
  url = documentUrl(url);
  const metadata = await loadContainerMetadata(client, parentContainer(url));
  if (!metadata) {
    throw new Error(
      'link-metadata: The parent folder does not advertise a description resource. Deletion was not performed.'
    );
  }
  const draft = await copyDocument(metadata);
  draft.graph.set(url, prefixes.lm + 'deleted', 'Deleted by the user');
  await saveDocument(client, draft);
  // Basic deletion is a durable tombstone, not physical removal. Do not follow
  // a redirected DELETE or remove the only remaining forwarding metadata.
  return { url, status: 'marked-deleted', contentRemoved: false };
}
