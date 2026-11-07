import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { bundleApplications } from '../scripts/bundle.mjs';

test('apps share one data and one UI bundle with isolated app code', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = await bundleApplications(root);
  const chunks = new Map(output.filter(item => item.type === 'chunk')
    .map(item => [item.fileName, item]));
  const apps = ['contacts', 'files', 'launcher', 'profile'];
  assert.deepEqual([...chunks.keys()].sort(), [
    ...apps.map(name => name + '/src/index.js'),
    'redirect.js', 'shared/data.js', 'shared/ui.js'
  ].sort());
  const data = chunks.get('shared/data.js');
  const ui = chunks.get('shared/ui.js');
  assert.deepEqual(data.imports, []);
  assert.deepEqual(ui.imports, [data.fileName]);
  assert.deepEqual(chunks.get('redirect.js').imports, [data.fileName]);
  const dataModules = Object.keys(data.modules).join('\n');
  const uiModules = Object.keys(ui.modules).join('\n');
  for (const library of ['metro-core', 'oldm-core', 'oldm-turtle',
    'solid-workspace']) {
    assert(dataModules.includes('/' + library + '/'), library);
  }
  assert(!/simplyflow|simplysolid/.test(dataModules));
  assert.match(uiModules, /simplyflow-app/);
  assert.match(uiModules, /simplysolid/);
  const moduleOwners = new Map();
  for (const [name, chunk] of chunks) {
    for (const id of Object.keys(chunk.modules)) {
      assert(!moduleOwners.has(id), 'Duplicated module: ' + id);
      moduleOwners.set(id, name);
      assert(!/\/node_modules\/(?:n3|@muze-nl\/oldm-n3)\//.test(id));
      const app = /\/apps\/([^/]+)\//.exec(id)?.[1];
      if (app) {
        assert.equal(name, app + '/src/index.js');
      }
    }
    assert(output.some(item => item.fileName === name + '.map'));
  }
  assert.equal(moduleOwners.get(root +
    'packages/solid-app-data/src/workspace-broker.mjs'),
  'launcher/src/index.js');
  assert.equal(moduleOwners.get(root +
    'packages/solid-app-data/src/link-metadata.mjs'), 'files/src/index.js');
  for (const name of apps) {
    assert.deepEqual([...chunks.get(name + '/src/index.js').imports].sort(),
      [data.fileName, ui.fileName]);
  }
});
