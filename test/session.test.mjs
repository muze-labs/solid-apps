import test from 'node:test';
import assert from 'node:assert/strict';
import { oidcStore, idToken } from '@muze-nl/metro-oidc';
import { tokenStore } from '@muze-nl/metro-oauth2/tokenstore';
import { connectSession } from '../packages/solid-app-data/src/index.mjs';

test('logout clears only this account, closes its popup and rejects retained clients', async (t) => {
  const values = new Map();
  const originals = new Map();
  for (const key of ['fetch', 'location', 'localStorage']) {
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
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key)
    }
  });
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { href: 'https://apps.example/contacts/' }
  });
  const issuer = 'https://issuer.example/';
  const webId = 'https://pod.example/profile#me';
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response(
      `<${webId}> <http://www.w3.org/ns/solid/terms#oidcIssuer> <${issuer}>; <http://www.w3.org/ns/pim/space#storage> <https://pod.example/storage/>.`,
      { headers: { 'Content-Type': 'text/turtle' } }
    );
  };
  const popup = {
    closed: false,
    close() {
      this.closed = true;
    }
  };
  const session = await connectSession(webId, popup, { interactive: false });
  const account = issuer + '|' + webId;
  const oauth = tokenStore(account);
  const identity = oidcStore(account);
  for (const key of [
    'access_token',
    'refresh_token',
    'authorization_code',
    'code_verifier'
  ]) {
    oauth.tokens.set(key, { value: 'credential' });
  }
  oauth.state.set('pending authorization');
  identity.set('id_token', 'signed token');
  identity.set('id_token_claims', { sub: webId });
  identity.set('pending_nonce', 'nonce');
  const otherAccount = issuer + '|https://other.example/#me';
  tokenStore(otherAccount).tokens.set('access_token', { value: 'other token' });
  oidcStore(otherAccount).set('id_token', 'other ID token');
  oidcStore(issuer).set('client_info', { client_id: 'registered client' });

  session.logout();
  session.logout();
  assert.equal(popup.closed, true);
  for (const key of [
    'access_token',
    'refresh_token',
    'authorization_code',
    'code_verifier'
  ]) {
    assert.equal(oauth.tokens.get(key), null);
  }
  assert.equal(oauth.state.get(), null);
  assert.equal(idToken({ issuer, webid: webId }), null);
  assert.equal(identity.get('id_token_claims'), null);
  assert.equal(identity.get('pending_nonce'), null);
  assert.equal(
    tokenStore(otherAccount).tokens.get('access_token').value,
    'other token'
  );
  assert.equal(oidcStore(otherAccount).get('id_token'), 'other ID token');
  assert.equal(
    oidcStore(issuer).get('client_info').client_id,
    'registered client'
  );
  const before = requests;
  await assert.rejects(
    session.perform(() => assert.fail('Must not run')),
    /logged out/
  );
  await assert.rejects(
    session.client.get('https://pod.example/storage/'),
    /logged out/
  );
  await assert.rejects(
    session.solid.get('https://pod.example/storage/'),
    /logged out/
  );
  assert.equal(requests, before);
});
