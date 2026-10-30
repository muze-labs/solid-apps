import { build } from 'esbuild';
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
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
const applicationBuild = await build({
  metafile: true,
  entryPoints: ['launcher', 'contacts', 'files', 'profile'].map(
    (name) => `apps/${name}/src/index.mjs`
  ),
  absWorkingDir: root,
  outdir: 'www/assets',
  entryNames: '[dir]/[name]',
  outbase: 'apps',
  bundle: true,
  format: 'esm',
  splitting: true,
  sourcemap: true,
  alias: {
    '@muze-nl/oldm': path.join(root, 'packages/solid-app-data/src/oldm.mjs')
  }
});
if (
  Object.keys(applicationBuild.metafile.inputs).some((input) =>
    /node_modules\/(?:n3|@muze-nl\/oldm-n3)\//.test(input)
  )
) {
  throw new Error('build: N3 must not enter the application bundle.');
}
await build({
  entryPoints: ['packages/solid-app-data/src/redirect.mjs'],
  absWorkingDir: root,
  outfile: 'www/assets/redirect.js',
  bundle: true,
  format: 'esm'
});
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
  let body = shell
    .replace('{{title}}', title)
    .replace('{{content}}', content)
    .replace('{{preferences}}', preferences);
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
