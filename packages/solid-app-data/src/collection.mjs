import { simplySolid } from '@muze-labs/simplysolid';
import { oldm, prefixes, valueAt } from './index.mjs';

// One native RDF resource with an IndexedDB replica; shared by both people apps.
export async function openCollection(
  name,
  { scalarPredicates = [], indexedDBFactory } = {}
) {
  const service = simplySolid({
    context: oldm.context({ prefixes }),
    localFirst: true,
    app: { slug: 'solid-apps' },
    data: {
      [name]: {
        kind: 'resource',
        local: { indexedDB: 'solid-apps', key: name, indexedDBFactory },
        prefixes,
        scalarPredicates
      }
    }
  });
  await service.open();
  return {
    service,
    collection: service.data[name],
    async connect(session, url) {
      await service.connect({
        solid: session.solid,
        resources: { [name]: { url } }
      });
      await service.sync(name);
    },
    async sync() {
      return service.sync(name);
    },
    pending() {
      return service.status.resources;
    }
  };
}
export function isPerson(node) {
  return (
    [
      'http://www.w3.org/2006/vcard/ns#Individual',
      'http://xmlns.com/foaf/0.1/Person',
      'https://schema.org/Person',
      'http://schema.org/Person'
    ].some((type) => [].concat(node.a || []).includes(type)) ||
    valueAt(node, prefixes.vcard + 'fn') !== undefined
  );
}
