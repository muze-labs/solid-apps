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
  const result = await savePreferences(session, loaded.document, {
    ...defaults,
    theme: 'dark',
    language: 'nl',
    contactsResource: 'https://pod.example/private/contacts.ttl'
  });
  assert.equal(readUrl, url);
  assert.equal(headers['If-Match'], '"v1"');
  assert.equal(result.settings.theme, 'dark');
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
