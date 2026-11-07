import { register } from 'node:module';
import { isMainThread } from 'node:worker_threads';
if (isMainThread) {
  register(import.meta.url);
}
export function resolve(specifier, context, next) {
  if (context.importAttributes?.type === 'text') {
    const url = new URL(specifier, context.parentURL);
    url.searchParams.set('solid-apps-text', '');
    return { url: url.href, shortCircuit: true };
  }
  return specifier === '@muze-nl/oldm'
    ? {
        url: new URL('../packages/solid-app-data/src/oldm.mjs', import.meta.url)
          .href,
        shortCircuit: true
      }
    : next(specifier, context);
}

// Feature tests consume the same authored HTML as the browser build.
export async function load(url, context, next) {
  const target = new URL(url);
  if (target.searchParams.has('solid-apps-text')) {
    const { templateText } = await import('./templates.mjs');
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const compiled = target.searchParams.has('template');
    target.search = '';
    const filename = fileURLToPath(target);
    const source = compiled
      ? await templateText(filename)
      : await readFile(filename, 'utf8');
    return {
      format: 'module',
      source: 'export default ' + JSON.stringify(source),
      shortCircuit: true
    };
  }
  return next(url, context);
}
