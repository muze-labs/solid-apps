import test from 'node:test';
import assert from 'node:assert/strict';
import {
  oldm, prefixes, valueAt
} from '../packages/solid-app-data/src/index.mjs';
import {
  shortcutLaunch, applyLaunchOverride, locationPredicate, overridePredicate,
  applyAnonymousLaunch, anonymousPredicate
} from '../apps/launcher/src/shortcuts.mjs';
import {
  readLaunchContext
} from '../packages/solid-app-data/src/launch.mjs';

const base = 'https://pod.example/apps.ttl';
const webId = 'https://alice.example/profile#me';
const resource = 'https://pod.example/data.ttl?view=all#alice';
const target = 'https://server.example/app?view=all&' +
  new URLSearchParams({ resource }) + '#landing';

function application(extra = '') {
  const graph = oldm.context({ prefixes }).parse(
    '@prefix apps: <' + prefixes.apps + '>. ' +
    '<#app> <' + prefixes.schema + 'url> <' + target + '>; ' +
    '<https://example.org/unknown> "one", "two". ' +
    '<#other> <https://example.org/unknown> "keep". ' + extra,
    base, 'text/turtle'
  );
  return graph.get(base + '#app');
}

test('declaration is default, user override wins, absence means fragment', () => {
  const subject = application('<#app> apps:launchParameterLocation "query".');
  let result = shortcutLaunch(subject, webId);
  assert.equal(result.override, '');
  assert.equal(result.location, 'query');
  assert.equal(new URL(result.href).hash, '#landing');
  assert.deepEqual(readLaunchContext(result.href, {
    parameterLocation: 'query'
  }), { webId, resource });

  applyLaunchOverride(subject, 'fragment');
  result = shortcutLaunch(subject, webId);
  assert.equal(result.location, 'fragment');
  assert.deepEqual(readLaunchContext(result.href), { webId, resource });
  assert.equal(String(valueAt(subject, locationPredicate)), 'query');

  applyLaunchOverride(subject, '');
  result = shortcutLaunch(subject, webId);
  assert.equal(result.location, 'query');
  assert.equal(valueAt(subject, overridePredicate), undefined);
  assert.equal(shortcutLaunch(application(), webId).location, 'fragment');
});

test('mode edits preserve app declarations, unknown values and other subjects', async () => {
  const subject = application('<#app> apps:launchParameterLocation "query".');
  applyLaunchOverride(subject, 'fragment');
  applyLaunchOverride(subject, '');
  const graph = oldm.context({ prefixes }).parse(
    await subject.graph.write(), base, 'text/turtle'
  );
  const app = graph.get(subject.id);
  assert.equal(String(valueAt(app, locationPredicate)), 'query');
  assert.deepEqual(valueAt(app, 'https://example.org/unknown').map(String),
    ['one', 'two']);
  assert.equal(String(valueAt(graph.get(base + '#other'),
    'https://example.org/unknown')), 'keep');
});

test('unsupported settings and edits fail without flattening native RDF', async () => {
  for (const object of ['"query", "fragment"', '[apps:note "keep"]',
    '<https://example.org/query>', '"future-mode"', '"query"@en']) {
    const subject = application('<#app> apps:launchParameterLocationOverride ' +
      object + '.');
    const before = await subject.graph.write();
    assert.throws(() => shortcutLaunch(subject, webId), /launcher\/shortcuts:/);
    assert.throws(() => applyLaunchOverride(subject, 'query'),
      /launcher\/shortcuts:/);
    assert.equal(await subject.graph.write(), before);
  }
  const subject = application();
  const before = await subject.graph.write();
  assert.throws(() => applyLaunchOverride(subject, 'unsupported'),
    /Choose a supported/);
  assert.equal(await subject.graph.write(), before);
});

test('user override can supersede an unsupported declaration without changing it', () => {
  const subject = application('<#app> apps:launchParameterLocation "future-mode".');
  assert.throws(() => shortcutLaunch(subject, webId), /Unsupported launch mode/);
  applyLaunchOverride(subject, 'query');
  assert.equal(shortcutLaunch(subject, webId).location, 'query');
  assert.equal(String(valueAt(subject, locationPredicate)), 'future-mode');
});

test('links cannot reuse a saved identity without a current account', () => {
  assert.equal(shortcutLaunch(application()).href, null);
});

test('anonymous is saved per link and remains independent of app defaults', async () => {
  const identified = application('<#app> apps:launchParameterLocation "query".');
  const anonymous = application('<#app> apps:launchParameterLocation "query".');
  applyAnonymousLaunch(anonymous, true);
  const result = shortcutLaunch(anonymous, webId);
  assert.equal(result.anonymous, true);
  assert.deepEqual(readLaunchContext(result.href, { parameterLocation: 'query' }), {
    webId: '', resource
  });
  assert.equal(shortcutLaunch(anonymous).href, result.href);
  assert.equal(shortcutLaunch(identified, webId).anonymous, false);
  assert.equal(new URL(shortcutLaunch(identified, webId).href)
    .searchParams.get('webid'), webId);
  const graph = oldm.context({ prefixes }).parse(
    await anonymous.graph.write(), base, 'text/turtle'
  );
  assert.equal(shortcutLaunch(graph.get(anonymous.id)).anonymous, true);
  applyAnonymousLaunch(anonymous, false);
  assert.equal(valueAt(anonymous, anonymousPredicate), undefined);
  assert.equal(String(valueAt(anonymous, locationPredicate)), 'query');
  assert.equal(valueAt(anonymous, 'https://example.org/unknown').length, 2);
});

test('anonymous editing refuses structured or multiple values before mutation', async () => {
  for (const value of ['true, false', '[apps:note "keep"]', '"true"']) {
    const subject = application('<#app> apps:anonymousLaunch ' + value + '.');
    const before = await subject.graph.write();
    assert.throws(() => shortcutLaunch(subject, webId), /launcher\/shortcuts:/);
    assert.throws(() => applyAnonymousLaunch(subject, true), /launcher\/shortcuts:/);
    assert.equal(await subject.graph.write(), before);
  }
});
