import test from 'node:test';
import assert from 'node:assert/strict';
import { oidcStore } from '@muze-nl/metro-oidc';
import {
  authorizationTransport,
  refreshAuthorizationUrl
} from '../packages/solid-app-data/src/authorization.mjs';

test('refresh recovery does not erase newer credentials or classify other failures', async (t) => {
  const saved = new Map(
    ['fetch', 'localStorage'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key)
    ])
  );
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  };
  t.after(() => {
    for (const [key, descriptor] of saved) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      }
      else {
        delete globalThis[key];
      }
    }
  });
  const issuer = 'https://issuer.example/';
  const endpoint = issuer + 'token';
  oidcStore(issuer).set('openid_configuration', { token_endpoint: endpoint });
  for (const scenario of [
    'expired',
    'rotated elsewhere',
    'provider outage',
    'network',
    'malformed response',
    'empty error',
    'authorization code',
    'resource error'
  ]) {
    await t.test(scenario, async () => {
      const tokens = new Map([
        ['access_token', { value: 'cached' }],
        ['refresh_token', { value: 'old' }]
      ]);
      globalThis.fetch = async () => {
        if (scenario === 'network') {
          throw new TypeError('fixture connection unavailable');
        }
        if (scenario === 'rotated elsewhere') {
          tokens.set('refresh_token', { value: 'newer' });
          tokens.set('access_token', { value: 'newer access' });
        }
        return new Response(
          scenario === 'malformed response'
            ? 'unreadable'
            : JSON.stringify(
                scenario === 'empty error' ? null : { error: 'invalid_grant' }
              ),
          {
            status: scenario === 'provider outage' ? 503 : 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      };
      const request = authorizationTransport(issuer, tokens, issuer).post(
        scenario === 'resource error' ? issuer + 'resource' : endpoint,
        {
          body: new URLSearchParams({
            grant_type:
              scenario === 'authorization code'
                ? 'authorization_code'
                : 'refresh_token',
            refresh_token: 'old'
          })
        }
      );
      if (['expired', 'rotated elsewhere'].includes(scenario)) {
        await assert.rejects(request, { code: 'refresh_rejected' });
      }
      else if (scenario === 'network') {
        await assert.rejects(request, /fixture connection unavailable/);
      }
      else {
        assert.equal(
          (await request).status,
          scenario === 'provider outage' ? 503 : 400
        );
      }
      if (scenario === 'expired') {
        assert.equal(tokens.size, 0);
      }
      else {
        assert.equal(tokens.size, 2);
        assert.equal(
          tokens.get('refresh_token').value,
          scenario === 'rotated elsewhere' ? 'newer' : 'old'
        );
      }
    });
  }
  const original = new URL(
    issuer + 'authorize?scope=openid%20webid&state=state&nonce=nonce'
  );
  assert.equal(refreshAuthorizationUrl(original, issuer).href, original.href);
  oidcStore(issuer).set('openid_configuration', {
    scopes_supported: ['openid', 'webid', 'offline_access']
  });
  const consent = refreshAuthorizationUrl(original, issuer);
  assert.equal(
    consent.searchParams.get('scope'),
    'openid webid offline_access'
  );
  assert.equal(consent.searchParams.get('prompt'), 'consent');
  assert.equal(consent.searchParams.get('state'), 'state');
  assert.equal(consent.searchParams.get('nonce'), 'nonce');
  assert.equal(original.searchParams.has('prompt'), false);
});
