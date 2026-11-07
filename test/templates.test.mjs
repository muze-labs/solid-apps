import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import { editableSources } from '../scripts/templates.mjs';
import raw from '../apps/contacts/src/account-view.html' with { type: 'text' };
import compiled from '../apps/contacts/src/account-view.html?template' with { type: 'text' };

// The Node test loader and browser bundler must agree on the same imports.
// In particular, ordinary text must retain even template-looking characters.
test('text imports preserve source; explicit template imports compose HTML', async () => {
  const filename = fileURLToPath(
    new URL('../apps/contacts/src/account-view.html', import.meta.url)
  );
  assert.equal(raw, await readFile(filename, 'utf8'));
  assert.match(raw, /\{\{include:/);
  assert.doesNotMatch(compiled, /\{\{/);
  assert.match(compiled, /Contacts/);

  const directory = await mkdtemp(path.join(tmpdir(), 'solid-text-import-'));
  const moduleFile = path.join(directory, 'fixture.mjs');
  const moduleSource = 'export default 42;';
  await writeFile(moduleFile, moduleSource);
  const nativeText = await import(moduleFile, { with: { type: 'text' } });
  const executable = await import(moduleFile);
  assert.equal(nativeText.default, moduleSource);
  assert.equal(executable.default, 42);
  const bundle = await rollup({
    input: 'text-fixture',
    plugins: [
      {
        name: 'text-fixture',
        resolveId(id) {
          if (id === 'text-fixture') {
            return id;
          }
        },
        load(id) {
          if (id === 'text-fixture') {
            return `
              import raw from ${JSON.stringify(filename)}
                with { type: 'text' };
              import compiled from ${JSON.stringify(filename + '?template')}
                with { type: 'text' };
              import moduleText from ${JSON.stringify(moduleFile)}
                with { type: 'text' };
              import executable from ${JSON.stringify(moduleFile)};
              export { raw, compiled, moduleText, executable };
            `;
          }
        }
      },
      editableSources()
    ]
  });
  try {
    const { output } = await bundle.generate({ format: 'es' });
    const url =
      'data:text/javascript;base64,' +
      Buffer.from(output[0].code).toString('base64');
    const result = await import(url);
    assert.equal(result.raw, raw);
    assert.equal(result.compiled, compiled);
    assert.equal(result.moduleText, moduleSource);
    assert.equal(result.executable, 42);
  } finally {
    await bundle.close();
    await rm(directory, { recursive: true, force: true });
  }
});
