import { bundleApplications } from './bundle.mjs';
import { mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
const root = fileURLToPath(new URL('../', import.meta.url));
const bundles = await bundleApplications(root);
// Everything in assets is generated. Drop retired hashed chunks as well as
// current outputs so deployment contains only this build's import graph.
await rm(path.join(root, 'www/assets'), { recursive: true, force: true });
await mkdir(path.join(root, 'www/assets'), { recursive: true });
await copyFile(
  path.join(root, 'node_modules/@muze-nl/theds/dist/theds.css'),
  path.join(root, 'www/assets/theds.css')
);
await copyFile(
  path.join(root, 'packages/solid-app-ui/src/style.css'),
  path.join(root, 'www/assets/apps.css')
);
await copyFile(
  path.join(root, 'packages/solid-app-ui/src/icons.svg'),
  path.join(root, 'www/assets/icons.svg')
);
for (const output of bundles) {
  const destination = path.join(root, 'www/assets', output.fileName);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination,
    output.type === 'chunk' ? output.code : output.source);
}
const shell = await readFile(
  path.join(root, 'packages/solid-app-ui/src/shell.html'),
  'utf8'
);
const profile = await readFile(
  path.join(root, 'packages/solid-profile/src/profile.html'),
  'utf8'
);
const preferences = await readFile(
  path.join(root, 'packages/solid-preferences/src/dialog.html'),
  'utf8'
);
for (const name of ['launcher', 'contacts', 'files', 'profile']) {
  const title = name[0].toUpperCase() + name.slice(1);
  const content = (
    await readFile(path.join(root, `apps/${name}/src/index.html`), 'utf8')
  ).replace('{{profile}}', profile);
  let appPreferences = '';
  if (name !== 'profile') {
    appPreferences = await readFile(
      path.join(root, `apps/${name}/src/preferences.html`), 'utf8'
    );
  }
  let body = shell
    .replace('{{title}}', title)
    .replace('{{content}}', content)
    .replace('{{preferences}}',
      preferences.replace('{{appPreferences}}', appPreferences));
  await mkdir(path.join(root, `www/${name}`), { recursive: true });
  await writeFile(
    path.join(root, `www/${name}/index.html`),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name[0].toUpperCase() + name.slice(1)} · Solid Apps</title><link rel="stylesheet" href="../assets/theds.css"><link rel="stylesheet" href="../assets/apps.css"></head><body class="ds-darkmode-auto"><div id="app">${body}</div><script type="module" src="../assets/${name}/src/index.js"></script></body></html>`
  );
}
await writeFile(
  path.join(root, 'www/redirect.html'),
  '<!doctype html><meta charset="utf-8"><title>Solid connection</title><p>Completing sign-in…</p><script type="module" src="assets/redirect.js"></script>'
);
await writeFile(
  path.join(root, 'www/index.html'),
  '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=launcher/"><a href="launcher/">Open Solid Apps</a>'
);
console.log('Built all four apps in www/');
const outputs = Object.fromEntries(bundles.filter(item => item.type === 'chunk')
  .map(item => ['www/assets/' + item.fileName, item]));
const gzipSizes = new Map();
for (const [name, output] of Object.entries(outputs)) {
  gzipSizes.set(name, gzipSync(output.code, { level: 6 }).byteLength);
}
function importGraph(name, seen = new Set()) {
  if (seen.has(name)) {
    return seen;
  }
  seen.add(name);
  for (const dependency of [...outputs[name].imports,
    ...outputs[name].dynamicImports]) {
    importGraph('www/assets/' + dependency, seen);
  }
  return seen;
}
const sizes = {};
for (const name of ['launcher', 'contacts', 'files', 'profile']) {
  const files = importGraph(`www/assets/${name}/src/index.js`);
  importGraph('www/assets/redirect.js', files);
  const total = [...files].reduce((sum, file) => sum + gzipSizes.get(file), 0);
  sizes[name] = { gzipBytes: total, scripts: [...files] };
  if (total >= 200000) {
    throw new Error(`build: ${name} exceeds the 200 KB gzip JavaScript budget.`);
  }
}
await writeFile(path.join(root, 'www/size-report.json'), JSON.stringify({
  gzipLevel: 6, node: process.versions.node, apps: sizes
}, null, 2));
await writeFile(path.join(root, 'www/bundle-report.json'), JSON.stringify(
  Object.fromEntries(Object.entries(outputs).map(([name, output]) => [name, {
    gzipBytes: gzipSizes.get(name),
    imports: output.imports,
    modules: Object.keys(output.modules).map(id => path.relative(root, id))
  }])), null, 2));
console.log('Gzip JS including auth callback: ' + Object.entries(sizes)
  .map(([name, size]) => `${name} ${size.gzipBytes} B`).join(', '));
