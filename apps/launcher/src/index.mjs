import { app } from '@muze-labs/simplyflow/app';
import { shell } from '@muze-labs/solid-app-ui';
import { openCollection } from '@muze-labs/solid-app-data/collection.mjs';
import { prefixes, valueAt, idOf, httpUrl } from '@muze-labs/solid-app-data';
const host = shell();
let store;
const container = host.main.querySelector('.saved-apps');
function render() {
  const nodes = store.collection
    .list()
    .filter((node) =>
      [].concat(node.a || []).includes(prefixes.schema + 'SoftwareApplication')
    );
  ui.data.shortcuts = nodes.map((node) => {
    const url = idOf(valueAt(node, prefixes.schema + 'url'));
    let safe = null;
    try {
      safe = httpUrl(url);
    }
    catch {}
    return {
      id: node.id,
      label: String(valueAt(node, prefixes.schema + 'name') || url),
      link: { href: safe, target: '_blank', rel: 'noopener' }
    };
  });
  ui.data.empty = nodes.length
    ? ''
    : 'Add links to other applications you use.';
}
const ui = app({
  container,
  data: { shortcuts: [], empty: '' },
  commands: {
    add(form) {
      host.run(async () => {
        const url = httpUrl(form.elements.url.value);
        await store.collection.create({
          id: 'urn:uuid:' + crypto.randomUUID(),
          a: prefixes.schema + 'SoftwareApplication',
          schema$name: form.elements.name.value,
          schema$url: { id: url },
          dcterms$modified: new Date().toISOString()
        });
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
await host.run(async () => {
  store = await openCollection('launcher', {
    scalarPredicates: [prefixes.schema + 'name', prefixes.schema + 'url']
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
