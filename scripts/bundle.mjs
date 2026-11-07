import path from 'node:path';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const appNames = ['launcher', 'contacts', 'files', 'profile'];

function entryOwners(id, getModuleInfo) {
  const owners = new Set();
  const visited = new Set();
  const pending = [id];
  while (pending.length) {
    const current = pending.pop();
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const info = getModuleInfo(current);
    if (info.isEntry) {
      owners.add(current);
    }
    pending.push(...info.importers, ...info.dynamicImporters);
  }
  return owners;
}

function sharedChunk(id, { getModuleInfo }) {
  if (id.includes('/node_modules/')) {
    if (/\/@muze-labs\/(?:simplyflow(?:-[^/]+)?|simplysolid|oldm-shape)\//
      .test(id)) {
      return 'shared/ui';
    }
    return 'shared/data';
  }
  if (entryOwners(id, getModuleInfo).size < 2) {
    return;
  }
  // Collection wiring belongs with SimplySolid; the lower data layer must
  // remain independent of rendering and the workspace-to-view bridge.
  if (id.includes('/packages/solid-app-data/') &&
    !id.endsWith('/collection.mjs')) {
    return 'shared/data';
  }
  return 'shared/ui';
}

export async function bundleApplications(root) {
  const composition = path.join(root, 'packages/solid-app-data/src/oldm.mjs');
  const input = Object.fromEntries(appNames.map(name =>
    [name + '/src/index', path.join(root, `apps/${name}/src/index.mjs`)]));
  input.redirect = path.join(root, 'packages/solid-app-data/src/redirect.mjs');
  const bundle = await rollup({
    input,
    preserveEntrySignatures: false,
    plugins: [
      {
        name: 'solid-apps-rdf',
        resolveId(source) {
          if (source === '@muze-nl/oldm') {
            return composition;
          }
        },
        load(id) {
          if (/\/node_modules\/(?:n3|@muze-nl\/oldm-n3)\//.test(id)) {
            throw new Error('bundle: N3 must not enter app or callback ' + id);
          }
        }
      },
      nodeResolve({ browser: true })
    ],
    onwarn(warning) {
      // SimplyFlow has internal module cycles. The emitted chunk graph is
      // checked separately so these do not become cycles between bundles.
      if (warning.code === 'CIRCULAR_DEPENDENCY') {
        return;
      }
      throw new Error('bundle: ' + warning.message);
    }
  });
  try {
    const result = await bundle.generate({
      dir: path.join(root, 'www/assets'),
      format: 'es',
      entryFileNames: '[name].js',
      chunkFileNames: '[name].js',
      sourcemap: true,
      onlyExplicitManualChunks: true,
      manualChunks: sharedChunk
    });
    const chunks = new Map(result.output.filter(item => item.type === 'chunk')
      .map(item => [item.fileName, item]));
    const data = chunks.get('shared/data.js');
    const ui = chunks.get('shared/ui.js');
    if (!data || !ui || data.imports.length || data.dynamicImports.length ||
      ui.imports.some(name => name !== data.fileName) ||
      ui.dynamicImports.length) {
      throw new Error('bundle: Shared bundles must depend only UI → data.');
    }
    for (const chunk of chunks.values()) {
      for (const dependency of [...chunk.imports, ...chunk.dynamicImports]) {
        if (!chunks.has(dependency)) {
          throw new Error('bundle: Unresolved output import ' + dependency);
        }
      }
    }
    return result.output;
  }
  finally {
    await bundle.close();
  }
}
