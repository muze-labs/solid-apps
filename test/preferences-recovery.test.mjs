import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadPreferences,
  savePreferences
} from '../packages/solid-preferences/src/index.mjs';
import {
  sameGraph,
  StateGraph,
  named,
  literal
} from '../packages/solid-app-data/src/state-rdf.mjs';

const url = 'https://pod.example/settings/prefs.ttl';
const namespace = 'https://vocab.muze.nl/solid-apps#';
function fixture() {
  const state = {
    body:
      '<#solid-apps> <' +
      namespace +
      'theme> "system". ' +
      '<#other> <https://example.org/unknown> "keep".',
    version: 1,
    validator: true,
    readFailure: null,
    writeFailure: false,
    race: false,
    reads: 0,
    attempts: [],
    writes: 0
  };
  const session = {
    preferencesUrl: url,
    client: {
      async get(input) {
        assert.equal(input, url);
        state.reads += 1;
        if (state.readFailure) {
          if (typeof state.readFailure === 'number') {
            return new Response(null, { status: state.readFailure });
          }
          throw state.readFailure;
        }
        const etag =
          state.validator === 'weak'
            ? 'W/"' + state.version + '"'
            : '"' + state.version + '"';
        return new Response(state.body, {
          headers: state.validator ? { ETag: etag } : {}
        });
      },
      async put(input, options) {
        assert.equal(input, url);
        state.attempts.push(options);
        if (state.race) {
          state.version += 1;
        }
        if (options.headers['If-Match'] !== '"' + state.version + '"') {
          return new Response(null, { status: 412 });
        }
        state.body = options.body;
        state.version += 1;
        state.writes += 1;
        if (state.writeFailure) {
          throw new TypeError('fixture response lost after commit');
        }
        return new Response(null, { status: 205 });
      }
    }
  };
  return { state, session };
}

test('a 205 without ETag acknowledges saving and next save reacquires its validator', async () => {
  const { state, session } = fixture();
  const loaded = await loadPreferences(session);
  const light = await savePreferences(session, loaded.document, {
    theme: 'light'
  });
  assert.equal(light.settings.theme, 'light');
  assert.equal(light.document.etag, null);
  assert.equal(
    state.reads,
    1,
    'No follow-up read can turn acknowledgement into failure.'
  );
  const system = await savePreferences(session, light.document, {
    theme: 'system'
  });
  assert.equal(system.settings.theme, 'system');
  assert.equal(state.reads, 2);
  assert.equal(state.writes, 2);
  assert.deepEqual(
    state.attempts.map((request) => request.headers['If-Match']),
    ['"1"', '"2"']
  );
  assert.ok(state.body.includes('keep'));
});

test('validator refresh compares all RDF and does not adopt a newer resource silently', async () => {
  const { state, session } = fixture();
  const loaded = await loadPreferences(session);
  const saved = await savePreferences(session, loaded.document, {
    theme: 'light'
  });
  state.body += '\n<#someone> <https://example.org/change> "new".';
  state.version += 1;
  await assert.rejects(
    savePreferences(session, saved.document, { theme: 'system' }),
    { code: 'document_conflict' }
  );
  assert.equal(state.writes, 1);
  assert.equal(saved.document.etag, null);
  assert.ok(state.body.includes('new'));
});

test('a conflict after validator refresh remains protected by If-Match', async () => {
  const { state, session } = fixture();
  const loaded = await loadPreferences(session);
  const saved = await savePreferences(session, loaded.document, {
    theme: 'light'
  });
  state.race = true;
  await assert.rejects(
    savePreferences(session, saved.document, { theme: 'system' }),
    { status: 412 }
  );
  assert.equal(state.writes, 1);
  assert.equal(state.attempts[1].headers['If-Match'], '"2"');
});

test('missing or weak GET validators never allow an unconditional save', async (t) => {
  for (const validator of [false, 'weak']) {
    await t.test(String(validator), async () => {
      const { state, session } = fixture();
      state.validator = validator;
      const loaded = await loadPreferences(session);
      await assert.rejects(
        savePreferences(session, loaded.document, { theme: 'light' }),
        { code: 'validator_missing' }
      );
      assert.equal(state.attempts.length, 0);
    });
  }
});

test('a failed refresh preserves the acknowledged baseline and can retry later', async (t) => {
  for (const failure of [new TypeError('fixture offline'), 401, 403, 404]) {
    await t.test(String(failure), async () => {
      const { state, session } = fixture();
      const loaded = await loadPreferences(session);
      const saved = await savePreferences(session, loaded.document, {
        theme: 'light'
      });
      state.readFailure = failure;
      await assert.rejects(
        savePreferences(session, saved.document, { theme: 'system' })
      );
      assert.equal(state.writes, 1);
      assert.equal(saved.settings.theme, 'light');
      state.readFailure = null;
      const retried = await savePreferences(session, saved.document, {
        theme: 'system'
      });
      assert.equal(retried.settings.theme, 'system');
      assert.equal(state.writes, 2);
    });
  }
});

test('unknown RDF including shared cyclic nodes, multiple values and typed literals survives', async () => {
  const { state, session } = fixture();
  state.body +=
    '\n<#a> <https://example.org/link> _:shared. ' +
    '<#b> <https://example.org/link> _:shared. ' +
    '_:shared <https://example.org/next> _:shared; ' +
    '<https://example.org/value> "01"^^<http://www.w3.org/2001/XMLSchema#integer>, "text"@nl.';
  const original = state.body;
  const loaded = await loadPreferences(session);
  const saved = await savePreferences(session, loaded.document, {
    theme: 'light'
  });
  const expected = new StateGraph(original, url);
  expected.set(
    named(url + '#solid-apps'),
    namespace + 'theme',
    literal('light')
  );
  assert.ok(sameGraph(expected.write(), state.body, url));
  // The server may rewrite blank labels without changing the resource.
  state.body = state.body.replaceAll('_:shared', '_:renamed');
  const next = await savePreferences(session, saved.document, {
    theme: 'system'
  });
  expected.set(
    named(url + '#solid-apps'),
    namespace + 'theme',
    literal('system')
  );
  assert.ok(sameGraph(expected.write(), state.body, url));
  assert.equal(next.settings.theme, 'system');
  assert.equal(state.writes, 2);
});

test('a lost write response does not falsely acknowledge or replay that save', async () => {
  const { state, session } = fixture();
  const loaded = await loadPreferences(session);
  state.writeFailure = true;
  await assert.rejects(
    savePreferences(session, loaded.document, { theme: 'light' }),
    { code: 'save_unconfirmed' }
  );
  assert.equal(loaded.document.etag, '"1"');
  assert.equal(loaded.settings.theme, 'system');
  state.writeFailure = false;
  await assert.rejects(
    savePreferences(session, loaded.document, { theme: 'light' }),
    { status: 412 }
  );
  assert.equal(state.writes, 1);
  const reviewed = await loadPreferences(session);
  assert.equal(reviewed.settings.theme, 'light');
});
