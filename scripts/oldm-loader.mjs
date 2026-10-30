import { register } from 'node:module';
import { isMainThread } from 'node:worker_threads';
if (isMainThread) {
  register(import.meta.url);
}
export function resolve(specifier, context, next) {
  return specifier === '@muze-nl/oldm'
    ? {
        url: new URL('../packages/solid-app-data/src/oldm.mjs', import.meta.url)
          .href,
        shortCircuit: true
      }
    : next(specifier, context);
}
