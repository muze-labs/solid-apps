import test from 'node:test';
import assert from 'node:assert/strict';
import { rollup } from 'rollup';
import { oidcStore } from '@muze-nl/metro-oidc';

// Replace only client construction so authorization can be triggered without
// exchanging credentials. Discovery, session policy and Metro's popup helper
// remain real. No workspace codec or Pod writes are involved.
const fixtureId = '\0session-client-fixture';
const bundle = await rollup({
  input: 'packages/solid-app-data/src/index.mjs',
  plugins: [{
    name: 'session-client-fixture',
    resolveId(source) {
      if (source === '@muze-labs/jsfs-solid') {
        return fixtureId;
      }
      if (source.startsWith('@') || source.startsWith('file:')) {
        return { id: import.meta.resolve(source), external: true };
      }
    },
    load(id) {
      if (id === fixtureId) {
        return `
          import metro from ${JSON.stringify(import.meta.resolve('@muze-nl/metro'))};
          export { authorizePopup, oidcIdToken, SolidAdapter }
            from ${JSON.stringify(import.meta.resolve('@muze-labs/jsfs-solid'))};
          export function createSolidMetroClient(_url, options) {
            globalThis.sessionPopupOptions = options;
            return metro.client(_url);
          }
        `;
      }
    }
  }]
});
const generated = await bundle.generate({ format: 'es' });
await bundle.close();
const { connectSession } = await import(
  'data:text/javascript;base64,' +
  Buffer.from(generated.output[0].code).toString('base64')
);

test('authorization UI is owned even with a cached identity token', async t => {
  const originals = new Map();
  const keys = ['window', 'location', 'localStorage', 'fetch',
    'addEventListener', 'removeEventListener', 'sessionPopupOptions'];
  for (const key of keys) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  }
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      }
      else {
        delete globalThis[key];
      }
    }
  });
  const values = new Map();
  const listeners = new Set();
  const location = new URL('https://apps.example/files/');
  Object.assign(globalThis, {
    location,
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)
    },
    addEventListener: (_type, handler) => listeners.add(handler),
    removeEventListener: (_type, handler) => listeners.delete(handler)
  });
  const webId = 'https://pod.example/profile#me';
  const issuer = 'https://issuer.example/';
  globalThis.fetch = async () => new Response(
    `<${webId}> <http://www.w3.org/ns/solid/terms#oidcIssuer> <${issuer}>;
      <http://www.w3.org/ns/pim/space#storage> <https://pod.example/storage/>.`,
    { headers: { 'Content-Type': 'text/turtle' } }
  );
  const url = issuer + 'authorize?state=fixture-state&redirect_uri=' +
    encodeURIComponent('https://apps.example/redirect.html');
  for (const outcome of ['success', 'fresh', 'public', 'denied', 'wrong-state',
    'blocked', 'closed', 'background']) {
    await t.test(outcome, async () => {
      values.clear();
      if (outcome !== 'fresh') {
        oidcStore(issuer + '|' + webId).set('id_token', 'cached fixture identity');
      }
      const opened = [];
      globalThis.window = {
        location,
        open(initialUrl) {
          if (outcome === 'blocked') {
            opened.push(null);
            return null;
          }
          const popup = {
            closed: false,
            close() { this.closed = true; },
            location: {
              set href(_url) { queueMicrotask(reply); }
            }
          };
          opened.push(popup);
          function reply() {
            if (outcome === 'closed') {
              popup.close();
              return;
            }
            const data = outcome === 'denied'
              ? { error: 'access_denied', state: 'fixture-state' }
              : { authorization_code: 'fixture-code',
                state: outcome === 'wrong-state' ? 'wrong' : 'fixture-state' };
            for (const handler of listeners) {
              handler({ origin: location.origin, source: popup, data });
            }
          }
          if (initialUrl) { queueMicrotask(reply); }
          return popup;
        }
      };
      const session = await connectSession(webId);
      // Session clients configure Metro lazily with a request-scoped cancel gate.
      await session.client.get(webId);
      if (outcome === 'public') {
        assert.equal(await session.perform(() => 'public data'), 'public data');
        assert.equal(opened.length, 0, 'Public reads need no sign-in window.');
        session.logout();
        return;
      }
      const operation = session.perform(
        () => sessionPopupOptions.authorize_callback(url),
        { interactive: outcome !== 'background' }
      );
      if (outcome === 'success' || outcome === 'fresh') {
        assert.equal((await operation).authorization_code, 'fixture-code');
      }
      else {
        const expected = {
          denied: /access_denied/, 'wrong-state': /state mismatch/,
          blocked: /blocked/i, closed: /closed/i, background: /Sign in again/
        };
        await assert.rejects(operation, expected[outcome]);
      }
      assert.equal(opened.length, outcome === 'background' ? 0 : 1);
      for (const popup of opened) {
        if (popup) {
          assert.equal(popup.closed, true, 'No orphan callback tab may remain.');
        }
      }
      assert.equal(listeners.size, 0, 'Authorization listeners are cleaned up.');
      session.logout();
    });
  }
});
