import test from 'node:test';
import assert from 'node:assert/strict';
import { model } from '@muze-labs/simplyflow/model';
import { effect, destroy } from '@muze-labs/simplyflow/state';
import { from } from '@muze-nl/jaqt';
import { contactList } from '../apps/contacts/src/features.mjs';
import { fileNavigation, resourcePicker } from '../apps/files/src/features.mjs';
import {
  profileDetails,
  profileEditing
} from '../packages/solid-profile/src/features.mjs';
import {
  fields,
  readProfile,
  profileLabel
} from '../packages/solid-profile/src/index.mjs';
import { oldm } from '../packages/solid-app-data/src/index.mjs';
import { isPerson } from '../packages/solid-app-data/src/collection.mjs';

function actionContext(components, { data = {}, api = {}, runtime = {} } = {}) {
  const context = {
    data,
    api: { model, effect, destroy, from, ...api },
    runtime
  };
  context.actions = {};
  for (const component of components) {
    for (const [name, action] of Object.entries(component.actions || {})) {
      context.actions[name] = action.bind(context);
    }
  }
  return context;
}
function stopList(list, signal) {
  destroy(signal);
  for (const result of list.effects.slice(1)) {
    destroy(result);
  }
}
const turtle = `@prefix v: <http://www.w3.org/2006/vcard/ns#>.
  <#b> a v:Individual; v:fn "Beta"; <https://example.test/unknown> "Keep".
  <#a> a v:Individual; v:fn "Alpha".
  <#other> <https://example.test/unknown> "Unrelated".`;

test('Contacts retains filtering across source refresh without changing RDF', async () => {
  const graph = oldm
    .context()
    .parse(turtle, 'https://example.test/people', 'text/turtle');
  const before = await graph.write();
  let nodes = [...graph.data];
  const view = actionContext([contactList], {
    api: { isPerson, readProfile, profileLabel },
    runtime: { host: {}, store: { collection: { list: () => nodes } } }
  });
  view.actions.initializeList();
  try {
    view.actions.refreshPeople();
    assert.deepEqual(
      view.data.people.map((row) => row.label),
      ['Alpha', 'Beta']
    );
    view.actions.setSearch('be');
    assert.deepEqual(
      view.data.people.map((row) => row.label),
      ['Beta']
    );
    nodes = nodes.slice().reverse();
    view.actions.refreshPeople();
    assert.deepEqual(
      view.data.people.map((row) => row.label),
      ['Beta']
    );
    assert.equal(view.runtime.people.state.options.search, 'be');
    assert.equal(await graph.write(), before);
    view.actions.setSearch('missing');
    assert.equal(view.data.people.length, 0);
    assert.equal(view.data.empty, 'No contacts yet.');
  }
  finally {
    stopList(view.runtime.people, view.runtime.listEffect);
  }
});

test('Files model updates picker visibility and source replacements without mutation', () => {
  const view = actionContext([fileNavigation, resourcePicker], {
    runtime: { pending: null }
  });
  view.actions.initializeFiles();
  try {
    assert.equal(view.data.empty, '');
    view.runtime.current = 'https://pod.test/';
    const source = Object.freeze([
      Object.freeze({
        url: 'https://pod.test/a',
        name: 'A',
        type: 'file',
        deleted: false
      }),
      Object.freeze({
        url: 'https://pod.test/b',
        name: 'B',
        type: 'file',
        deleted: true
      })
    ]);
    view.runtime.files.state.data = source;
    assert.deepEqual(
      view.data.entries.map((row) => row.name),
      ['A']
    );
    assert.equal(view.data.entries[0].pick.hidden, '');
    view.runtime.pending = {
      requester: { application: 'Launcher', origin: 'https://app.test' }
    };
    view.actions.renderPicker();
    assert.equal(view.data.entries[0].pick.hidden, null);
    assert.equal(view.data.entries[0].edit.hidden, '');
    assert.equal(source[0].pick, undefined);
    assert.equal(source[1].deleted, true);
    view.runtime.files.state.data = [];
    assert.equal(view.data.entries.length, 0);
    assert.equal(view.data.empty, 'This folder is empty.');
  }
  finally {
    stopList(view.runtime.files, view.runtime.listEffect);
  }
});

test('shared profile actions preserve drafts and reject another subject without DOM', async () => {
  const graph = oldm
    .context()
    .parse(turtle, 'https://example.test/people', 'text/turtle');
  const before = await graph.write();
  let changes = 0;
  const view = actionContext([profileDetails, profileEditing], {
    data: { profile: {} },
    api: {
      profile: {
        model,
        effect,
        destroy,
        from,
        fields,
        readProfile,
        profileLabel,
        onChange: () => {
          changes++;
        }
      }
    },
    runtime: { profile: { emptyText: 'Empty', options: {}, saving: false } }
  });
  view.actions.initializeProfileDetails();
  try {
    const subject = graph.get('https://example.test/people#b');
    view.actions.showProfile(subject, { editable: true });
    assert.equal(view.actions.profileBeginEdit(), true);
    view.actions.profileUpdateDraft('name', 'Unsaved name');
    const draft = view.actions.profileDraft();
    assert.equal(draft.values.name, 'Unsaved name');
    assert.equal(readProfile(subject).name, 'Beta');
    view.actions.profileCancelEdit();
    assert.equal(view.data.profile.name, 'Beta');
    view.actions.profileRestoreDraft(draft);
    assert.equal(view.data.profile.name, 'Unsaved name');
    assert.throws(
      () =>
        view.actions.profileRestoreDraft({
          ...draft,
          subject: 'https://other.test/'
        }),
      /Cannot restore/
    );
    assert.equal(view.actions.profileDraft().values.name, 'Unsaved name');
    assert.equal(await graph.write(), before);
    assert(changes > 0);
  }
  finally {
    view.actions.cleanupProfile();
  }
});

test('Files upload API retains conditional writes and reports partial failure', async () => {
  const { uploadFiles, readDownload } = await import(
    '../apps/files/src/data.mjs'
  );
  const writes = [];
  const session = {
    client: {
      async put(url, options) {
        writes.push({ url, options });
        return new Response('', { status: 201 });
      },
      async get() {
        return new Response('Denied', { status: 403 });
      }
    }
  };
  const first = { name: 'one.txt', type: 'text/plain' };
  const second = { name: '../outside', type: '' };
  await assert.rejects(
    uploadFiles(session, [first, second], (name) => {
      if (name.includes('/')) {
        throw new Error('files: Invalid child name.');
      }
      return 'https://pod.test/folder/' + name;
    }),
    /1 of 2 files uploaded/
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0].url, 'https://pod.test/folder/one.txt');
  assert.equal(writes[0].options.body, first);
  assert.equal(writes[0].options.headers['If-None-Match'], '*');
  await assert.rejects(readDownload(session, 'https://pod.test/denied'), /403/);
});
