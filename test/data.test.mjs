import test from 'node:test';
import assert from 'node:assert/strict';
import {
  oldm,
  prefixes,
  valueAt
} from '../packages/solid-app-data/src/index.mjs';
import {
  applyProfileEdits,
  readProfile,
  profileLabel
} from '../packages/solid-profile/src/index.mjs';
import {
  defaults,
  loadPreferences,
  savePreferences
} from '../packages/solid-preferences/src/index.mjs';
import { StateGraph, termText, sameGraph }
  from '../packages/solid-app-data/src/state-rdf.mjs';
import {
  markResourceDeleted,
  linkState
} from '../packages/solid-app-data/src/link-metadata.mjs';
const url = 'https://pod.example/settings/preferences.ttl';
const graph = (text) =>
  oldm.context({ prefixes }).parse(text, url, 'text/turtle');

test('sparse profiles render without required names or WebIDs', () => {
  const g = graph('<#person> a <http://xmlns.com/foaf/0.1/Person>.');
  const person = g.get(url + '#person');
  assert.equal(profileLabel(person), person.id);
  assert.deepEqual(Object.values(readProfile(person)), [
    '',
    '',
    '',
    '',
    '',
    ''
  ]);
});
test('profile edits preserve identity, other facts, other subjects and repeated values', async () => {
  const g = graph(
    '@prefix v: <http://www.w3.org/2006/vcard/ns#>. <#person> v:fn "Old"; v:hasEmail <mailto:a@example.org>, <mailto:b@example.org>; <https://example.org/private> "keep". <#another> v:fn "Untouched".'
  );
  const person = g.get(url + '#person');
  applyProfileEdits(person, { name: 'New', website: 'https://example.org/' });
  const reparsed = graph(await g.write());
  const saved = reparsed.get(person.id);
  assert.equal(readProfile(saved).name, 'New');
  assert.equal(readProfile(saved).website, 'https://example.org/');
  assert.equal(readProfile(saved).email, 'a@example.org\nb@example.org');
  assert.equal(String(valueAt(saved, 'https://example.org/private')), 'keep');
  assert.equal(readProfile(reparsed.get(url + '#another')).name, 'Untouched');
});
test('structured profile values remain intact and unsupported edits do not partially apply', () => {
  const g = graph(
    '@prefix v: <http://www.w3.org/2006/vcard/ns#>. <#person> v:fn "Old"; v:hasEmail [v:value "a@example.org"; <https://example.org/label> "work"].'
  );
  const person = g.get(url + '#person');
  assert.throws(
    () =>
      applyProfileEdits(person, {
        name: 'New',
        email: 'different@example.org'
      }),
    /structured RDF/
  );
  assert.equal(readProfile(person).name, 'Old');
});
test('preferences use the linked URL, retain unknown RDF, and send conditional writes', async () => {
  let written, headers, readUrl;
  const turtle =
    '<#other-app> <https://example.org/setting> "keep". <#solid-apps> <https://example.org/unknown> "also keep".';
  const session = {
    preferencesUrl: url,
    client: {
      async get(input) {
        readUrl = input;
        return new Response(turtle, { headers: { ETag: '"v1"' } });
      },
      async put(input, options) {
        assert.equal(input, url);
        written = options.body;
        headers = options.headers;
        return new Response(null, { status: 204, headers: { ETag: '"v2"' } });
      }
    }
  };
  const loaded = await loadPreferences(session);
  assert.equal(loaded.settings.launchTarget, 'tab');
  const result = await savePreferences(session, loaded.document, {
    ...defaults,
    theme: 'dark',
    launchTarget: 'window',
    workspaceResource: 'https://pod.example/workspace.ttl',
    language: 'nl',
    contactsResource: 'https://pod.example/private/contacts.ttl'
  });
  assert.equal(readUrl, url);
  assert.equal(headers['If-Match'], '"v1"');
  assert.equal(result.settings.theme, 'dark');
  assert.equal(result.settings.launchTarget, 'window');
  assert.equal(result.settings.workspaceResource, 'https://pod.example/workspace.ttl');
  assert.equal(result.settings.language, 'nl');
  const g = graph(written);
  assert.equal(
    String(valueAt(g.get(url + '#other-app'), 'https://example.org/setting')),
    'keep'
  );
  assert.equal(
    String(valueAt(g.get(url + '#solid-apps'), 'https://example.org/unknown')),
    'also keep'
  );
});
test('partial preferences preserve omitted app settings and RDF terms', async () => {
  const turtle = '<#solid-apps> ' +
    '<' + prefixes.apps + 'contactsResource> <https://pod.example/contacts>; ' +
    '<' + prefixes.apps + 'filesRoot> <https://pod.example/files/>, ' +
    '<https://pod.example/archive/>; ' +
    '<' + prefixes.apps + 'launcherResource> "kept"@nl; ' +
    '<https://example.org/unknown> <#detail>. ' +
    '<#detail> <https://example.org/count> "007"^^' +
    '<http://www.w3.org/2001/XMLSchema#integer>.';
  let written;
  const session = { client: {
    async put(_url, options) {
      if (options.headers['If-None-Match']) {
        assert.equal(options.headers['If-None-Match'], '*');
      }
      else {
        assert.equal(options.headers['If-Match'], '"v1"');
      }
      written = options.body;
      return new Response(null, { status: 204, headers: { ETag: '"v2"' } });
    }
  } };
  const document = { url, graph: graph(turtle), missing: false, etag: '"v1"' };
  const triples = text => new StateGraph(text, url).quads.map(quad =>
    [quad.subject, quad.predicate, quad.object].map(termText).join(' ')).sort();
  await savePreferences(session, document, { theme: 'dark' });
  const withoutTheme = graph(written);
  withoutTheme.delete(url + '#solid-apps', prefixes.apps + 'theme');
  assert.deepEqual(triples(await withoutTheme.write()), triples(turtle));
  await savePreferences(session, document, { contactsResource: '' });
  const withoutContacts = graph(turtle);
  withoutContacts.delete(url + '#solid-apps', prefixes.apps + 'contactsResource');
  assert.deepEqual(triples(written), triples(await withoutContacts.write()));
  await savePreferences(session, {
    url, graph: graph(''), missing: true, etag: null
  }, { filesRoot: 'https://pod.example/files/' });
  assert.equal(new StateGraph(written, url).quads.length, 1);
});
test('unsupported app launch preferences fail without altering RDF or writing', async () => {
  const client = { put: async () => assert.fail('Must not write') };
  for (const value of [
    '"tab", "window"',
    '[<https://example.org/setting> "keep"]',
    '"tab"@en',
    '"elsewhere"'
  ]) {
    const g = graph('<#solid-apps> <' + prefixes.apps + 'launchTarget> ' +
      value + '.');
    const original = await g.write();
    const document = { url, graph: g, missing: false, etag: '"v1"' };
    await assert.rejects(savePreferences({ client }, document, defaults),
      /app launch target|App launch target/);
    assert.equal(await g.write(), original);
  }
  await assert.rejects(savePreferences({ client }, {
    url, graph: graph(''), missing: false, etag: '"v1"'
  }, { ...defaults, launchTarget: 'reuse' }), /new tabs or new windows/);
});
test('missing preference link and conflicting writes fail without inventing a location', async () => {
  await assert.rejects(
    loadPreferences({ preferencesUrl: '' }),
    /does not link/
  );
  const document = { url, graph: graph(''), missing: false, etag: '"v1"' };
  await assert.rejects(
    savePreferences(
      { client: { put: async () => new Response(null, { status: 412 }) } },
      document,
      defaults
    ),
    /changed elsewhere/
  );
  await assert.rejects(
    savePreferences(
      { client: { put: async () => assert.fail('Must not write') } },
      { ...document, etag: null },
      defaults
    ),
    /no ETag/
  );
});
test('unsupported stored workspace locations are preserved and never written', async () => {
  for (const value of ['<https://a.example/>, <https://b.example/>',
    '"https://broker.example/"', '[<https://example.org/p> "keep"]',
    '"https://broker.example/"@en']) {
    const g = graph('<#solid-apps> <' + prefixes.apps + 'workspaceResource> ' + value + '.');
    const before = await g.write();
    await assert.rejects(savePreferences({ client: {
      put: async () => assert.fail('Must not write')
    } }, { url, graph: g, missing: false, etag: '"v1"' }, defaults),
    /Workspace resource/);
    assert.equal(await g.write(), before);
  }
});
test('resource deletion uses parent metadata and never issues a destructive request', async () => {
  const target = 'https://pod.example/files/test.txt';
  const metadata = 'https://pod.example/files/description';
  let written;
  const client = {
    async head(input) {
      assert.equal(input, 'https://pod.example/files/');
      return new Response(null, {
        headers: { Link: '<description>; rel="describedby"' }
      });
    },
    async get(input) {
      assert.equal(input, metadata);
      return new Response('<#other> <https://example.org/fact> "keep".', {
        headers: { ETag: '"1"' }
      });
    },
    async put(input, options) {
      assert.equal(input, metadata);
      assert.equal(options.headers['If-Match'], '"1"');
      written = options.body;
      return new Response(null, { status: 204 });
    },
    async delete() {
      assert.fail('No physical deletion permitted');
    }
  };
  const result = await markResourceDeleted(client, target);
  assert.equal(result.contentRemoved, false);
  assert.equal(
    linkState(
      {
        graph: oldm
          .context({ prefixes })
          .parse(written, metadata, 'text/turtle')
      },
      target
    ).deleted,
    true
  );
});
test('resource deletion refuses to proceed without advertised metadata', async () => {
  await assert.rejects(
    markResourceDeleted(
      { head: async () => new Response(null) },
      'https://pod.example/a.txt'
    ),
    /not advertise/
  );
});

test('invalid links leave the entire graph unchanged; notes preserve paragraphs', async () => {
  const g = graph('<#person> <http://www.w3.org/2006/vcard/ns#fn> "Original".');
  const person = g.get(url + '#person');
  const original = await g.write();
  assert.throws(
    () =>
      applyProfileEdits(person, {
        name: 'Changed',
        email: 'new@example.org',
        website: 'javascript:alert(1)'
      }),
    /HTTP or HTTPS/
  );
  assert.equal(await g.write(), original);
  applyProfileEdits(person, { notes: 'First paragraph.\n\nSecond paragraph.' });
  const saved = graph(await g.write()).get(person.id);
  assert.equal(
    readProfile(saved).notes,
    'First paragraph.\n\nSecond paragraph.'
  );
});

test('structured profile contacts project RDF values and retain unresolved references', async () => {
  const g = graph(`@prefix v: <http://www.w3.org/2006/vcard/ns#>.
    <#person> v:fn "Original";
      v:hasEmail <#work>, [v:hasValue <mailto:home@example.org>], <#missing>;
      v:hasTelephone <#phone>.
    <#work> a v:Work; v:value <mailto:work@example.org>, <mailto:other@example.org>;
      <https://example.org/label> "Keep work metadata".
    <#phone> v:value <tel:+31201234567>.
    <#another> <https://example.org/unknown> "Keep other subject".`);
  const person = g.get(url + '#person');
  const original = await g.write();
  const profile = readProfile(person);
  assert.equal(profile.email, 'work@example.org\nother@example.org\nhome@example.org');
  assert.equal(profile.phone, '+31201234567');
  assert.equal(await g.write(), original);
  assert.throws(() => applyProfileEdits(person, {
    name: 'Must not partially apply', email: 'replacement@example.org'
  }), /structured RDF/);
  assert.equal(await g.write(), original);
  applyProfileEdits(person, { ...profile, name: 'Changed' });
  const saved = graph(await g.write());
  const current = saved.get(person.id);
  assert.equal(readProfile(current).email, profile.email);
  assert.equal(String(valueAt(saved.get(url + '#work'), 'https://example.org/label')),
    'Keep work metadata');
  assert.equal(String(valueAt(saved.get(url + '#another'), 'https://example.org/unknown')),
    'Keep other subject');
  const baseline = graph(original);
  for (const preserved of [baseline, saved]) {
    preserved.delete(person.id, prefixes.vcard + 'fn');
    preserved.delete(person.id, prefixes.dcterms + 'modified');
  }
  assert(sameGraph(await baseline.write(), await saved.write()));
});

test('unresolved and cyclic contact nodes are preserved and never flattened', async () => {
  for (const detail of ['', '<#missing> <' + prefixes.vcard + 'value> <#missing>.']) {
    const g = graph('<#person> <' + prefixes.vcard + 'hasEmail> <#missing>. ' + detail);
    const person = g.get(url + '#person');
    const before = await g.write();
    assert.equal(readProfile(person).email, '');
    assert.throws(() => applyProfileEdits(person, { email: 'new@example.org' }),
      /structured RDF/);
    assert.equal(await g.write(), before);
  }
});

test('direct contact URI schemes remain scalar regardless of scheme casing', () => {
  const g = graph('<#person> <' + prefixes.vcard + 'hasEmail> <MAILTO:Case@example.org>.');
  const person = g.get(url + '#person');
  assert.equal(readProfile(person).email, 'Case@example.org');
  applyProfileEdits(person, { email: 'changed@example.org' });
  assert.equal(readProfile(person).email, 'changed@example.org');
});
