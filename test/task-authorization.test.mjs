import test from 'node:test';
import assert from 'node:assert/strict';
import oauth2mw from '@muze-nl/metro-oauth2/oauth2';
import {
  launchUrl,
  parseLaunchUrl
} from '../packages/solid-app-data/src/launch.mjs';

test('task context survives consumption without becoming an OAuth response', async (t) => {
  const originals = new Map();
  for (const key of ['window', 'history']) {
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
  const context = {
    webId: 'https://pod.example/profile#me',
    resource: 'https://pod.example/profile#me'
  };
  const taskUrl = launchUrl(
    'https://apps.example/profile/?solid-apps-task',
    context
  );
  globalThis.window = { location: new URL(taskUrl) };
  globalThis.history = {
    pushState(_state, _title, url) {
      window.location = new URL(url);
    }
  };
  const middleware = oauth2mw({
    force_authorization: true,
    tokens: new Map([
      ['access_token', { value: 'fixture-token', type: 'Bearer' }]
    ]),
    state: { get: () => 'fixture-state' },
    oauth2_configuration: {
      client_id: 'https://apps.example/client.json',
      authorization_endpoint: 'https://issuer.example/authorize',
      token_endpoint: 'https://issuer.example/token',
      redirect_uri: 'https://apps.example/redirect.html',
      issuer: 'https://issuer.example/',
      authorization_response_iss_parameter_supported: true
    }
  });
  const request = new Request('https://pod.example/private');
  const next = async (req) => {
    assert.equal(req.headers.get('Authorization'), 'Bearer fixture-token');
    return new Response('authorized');
  };
  // Reproduce the installed middleware's misclassification of a launch hash.
  await assert.rejects(middleware(request, next), /missing iss/);
  const parsed = parseLaunchUrl(taskUrl);
  window.location = new URL(launchUrl(parsed.url));
  assert.deepEqual(parsed.context, context);
  assert.equal(window.location.hash, '');
  assert.equal(window.location.searchParams.has('solid-apps-task'), true);
  assert.equal(await (await middleware(request, next)).text(), 'authorized');

  // Real authorization responses still require the issuer; never bypass checks.
  window.location = new URL(
    'https://apps.example/redirect.html?code=x&state=fixture-state'
  );
  await assert.rejects(middleware(request, next), /missing iss/);
  window.location = new URL(
    'https://apps.example/redirect.html?code=x&state=fixture-state&iss=https://wrong.example/'
  );
  await assert.rejects(middleware(request, next), /from issuer/);
});
