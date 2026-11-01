import test from 'node:test';
import assert from 'node:assert/strict';
import {
  launchUrl,
  parseLaunchUrl,
  readLaunchContext
} from '../packages/solid-app-data/src/launch.mjs';

const appUrl = 'https://apps.example/profile/?mode=view';
const webId = 'https://alice.example/profile/card#me';
const resource = 'https://pod.example/people.ttl?q=a%2Bb&view=all#alice';

test('launch context preserves complete URLs and separate resource fragments', () => {
  const link = launchUrl(appUrl, { webId, resource });
  const url = new URL(link);
  assert.equal(url.search, '?mode=view');
  assert.deepEqual(readLaunchContext(link), { webId, resource });
  assert.equal(new URL(resource).hash, '#alice');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('resource'), resource);
});

test('current account replaces a saved launch account without changing resource', () => {
  const saved = launchUrl(appUrl, {
    webId: 'https://previous.example/profile#me',
    resource
  });
  const link = launchUrl(saved, { ...readLaunchContext(saved), webId });
  assert.deepEqual(readLaunchContext(link), { webId, resource });
  assert.equal(
    readLaunchContext(saved).webId,
    'https://previous.example/profile#me'
  );
});

test('ordinary anchors remain standalone; public resource links need no WebID', () => {
  assert.deepEqual(readLaunchContext(appUrl + '#section'), {
    webId: '',
    resource: ''
  });
  const publicLink = appUrl + '#' + new URLSearchParams({ resource });
  assert.deepEqual(readLaunchContext(publicLink), { webId: '', resource });
  const anchored = launchUrl(appUrl + '#section', { webId });
  assert.equal(new URL(anchored).hash.startsWith('#section?webid='), true);
  assert.deepEqual(parseLaunchUrl(anchored), {
    context: { webId, resource: '' },
    url: appUrl + '#section'
  });
});

test('fragment query is consumed while app state and nested URLs survive', () => {
  const original = new URL(appUrl + '#foo%3Fbar?' + new URLSearchParams({
    webid: webId, resource
  }));
  const before = original.href;
  assert.deepEqual(parseLaunchUrl(original), {
    context: { webId, resource },
    url: appUrl + '#foo%3Fbar'
  });
  assert.equal(original.href, before);
  assert.deepEqual(readLaunchContext(original), { webId, resource });
  const rewritten = launchUrl(original.href, {
    webId: 'https://current.example/card#me', resource
  });
  assert.deepEqual(parseLaunchUrl(rewritten), {
    context: { webId: 'https://current.example/card#me', resource },
    url: appUrl + '#foo%3Fbar'
  });
});

test('only a literal question mark separates fragment parameters', () => {
  const encoded = appUrl + '#foo%3Fwebid=' + encodeURIComponent(webId);
  assert.deepEqual(parseLaunchUrl(encoded), {
    context: { webId: '', resource: '' }, url: encoded
  });
  const ignoredPrefix = appUrl + '#webid=ignored%ZZ?';
  assert.deepEqual(parseLaunchUrl(ignoredPrefix +
    new URLSearchParams({ resource })), {
    context: { webId: '', resource },
    url: appUrl + '#webid=ignored%ZZ'
  });
  const withQuestion = resource + '?more=1';
  assert.deepEqual(parseLaunchUrl(appUrl + '#foo?' + new URLSearchParams({
    resource: withQuestion
  })), {
    context: { webId: '', resource: withQuestion }, url: appUrl + '#foo'
  });
  assert.deepEqual(parseLaunchUrl(appUrl + '#foo?'), {
    context: { webId: '', resource: '' }, url: appUrl + '#foo'
  });
  assert.deepEqual(parseLaunchUrl(appUrl + '#?'), {
    context: { webId: '', resource: '' }, url: appUrl
  });
});

test('ambiguous or unsafe launch input is rejected before use', () => {
  for (const fragment of [
    'webid=',
    'resource=',
    'webid=' + encodeURIComponent(webId) + '&webid=' + encodeURIComponent(webId),
    new URLSearchParams([
      ['resource', resource], ['resource', resource]
    ]).toString(),
    'resource=javascript%3Aalert(1)',
    'resource=' + encodeURIComponent('https://user:password@pod.example/file'),
    'resource=' + encodeURIComponent('/relative-file'),
    'resource=https%3A%2F%2Fpod.example%2Ffile%ZZ'
  ]) {
    for (const prefix of ['#', '#foo?']) {
      assert.throws(
        () => readLaunchContext(appUrl + prefix + fragment),
        /solid-app-data\/launch:/
      );
    }
  }
  for (const invalid of ['javascript:alert(1)', '/relative', ' ']) {
    assert.throws(
      () => launchUrl(appUrl, { webId, resource: invalid || ' ' }),
      /solid-app-data\/launch:/
    );
    assert.throws(
      () => launchUrl(appUrl, { webId: invalid, resource }),
      /solid-app-data\/launch:/
    );
  }
});

test('anonymous links omit identity and include only an explicit resource', () => {
  for (const parameterLocation of ['fragment', 'query']) {
    const stale = launchUrl(appUrl + '#landing', {
      webId, resource, parameterLocation
    });
    const anonymous = launchUrl(stale, { parameterLocation });
    const target = new URL(anonymous);
    assert.equal(target.searchParams.has('webid'), false);
    assert.equal(target.searchParams.has('resource'), false);
    assert.equal(target.hash, '#landing');
    const withResource = launchUrl(stale, { resource, parameterLocation });
    assert.deepEqual(readLaunchContext(withResource, { parameterLocation }), {
      webId: '', resource
    });
    const otherLocation = parameterLocation === 'fragment' ? 'query' : 'fragment';
    assert.deepEqual(readLaunchContext(withResource, {
      parameterLocation: otherLocation
    }), { webId: '', resource: '' });
  }
  assert.equal(launchUrl(appUrl), appUrl);
});

test('query mode reaches the HTTP query and preserves unrelated app state', () => {
  const target = 'https://server.example/app?view=all&tag=a&tag=b#landing';
  const link = launchUrl(target, {
    webId, resource, parameterLocation: 'query'
  });
  const url = new URL(link);
  assert.deepEqual(readLaunchContext(link, { parameterLocation: 'query' }), {
    webId, resource
  });
  assert.equal(url.hash, '#landing');
  assert.equal(url.searchParams.get('view'), 'all');
  assert.deepEqual(url.searchParams.getAll('tag'), ['a', 'b']);
  assert.equal(parseLaunchUrl(link, { parameterLocation: 'query' }).url, link);
});

test('changing mode removes stale context from the inactive location', () => {
  const original = launchUrl(appUrl + '#landing', { webId, resource });
  const query = launchUrl(original, {
    webId, resource, parameterLocation: 'query'
  });
  assert.equal(new URL(query).hash, '#landing');
  const fragment = launchUrl(query, { webId, resource });
  assert.deepEqual(readLaunchContext(fragment), { webId, resource });
  assert.equal(new URL(fragment).searchParams.has('webid'), false);
  assert.equal(new URL(fragment).searchParams.has('resource'), false);
  assert.equal(new URL(fragment).searchParams.get('mode'), 'view');
  assert.throws(() => launchUrl(appUrl, {
    webId, parameterLocation: 'unsupported'
  }), /Unsupported parameter location/);
});
