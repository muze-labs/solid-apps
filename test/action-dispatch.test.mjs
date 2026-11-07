import { fileEditing } from '../apps/files/src/components/file-editing.mjs';
import { uploadFiles } from '../apps/files/src/data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { actions } from '@muze-labs/simplyflow-app/action';
import { accountLifecycle } from '../packages/solid-app-ui/src/components/account-lifecycle.mjs';
import { lifecycle as filesLifecycle } from '../apps/files/src/components/lifecycle.mjs';
import { muzeSolidDesignToast } from '../packages/solid-design/src/components/toast.mjs';
import { AppState } from '../packages/solid-app-data/src/app-state.mjs';

function ownerFor(definitions, properties = {}) {
  const owner = { data: {}, runtime: {}, api: {}, ...properties };
  owner.actions = actions({ app: owner, actions: { ...definitions } });
  return owner;
}

test('existing account listeners use current actions once and stop after cleanup', (t) => {
  const target = new EventTarget();
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.localStorage;
  globalThis.window = target;
  globalThis.localStorage = { getItem: () => null };
  t.after(() => {
    globalThis.window = previousWindow;
    globalThis.localStorage = previousStorage;
  });
  const calls = [];
  let destroyed = 0;
  const originals = {
    accountRemoved(event) {
      calls.push(['original', event, this]);
    },
    launchChanged(event) {
      calls.push(['launch', event, this]);
    }
  };
  const owner = ownerFor(
    {
      ...accountLifecycle.actions,
      ...originals,
      muzeSolidUiCleanupCapability() {}
    },
    {
      runtime: {
        root: { querySelector: () => ({}) },
        templates: {},
        settings: {},
        host: { launch: {} },
        acceptLaunch: true
      },
      api: {
        preferencesDialog: () => ({
          app: {
            destroy() {
              destroyed += 1;
            }
          }
        }),
        applyPreferences() {}
      }
    }
  );
  owner.actions.initialize();
  const event = new Event('storage');
  target.dispatchEvent(event);
  owner.actions.accountRemoved = function (value) {
    calls.push(['replacement', value, this]);
  };
  target.dispatchEvent(event);
  owner.actions.accountRemoved = originals.accountRemoved;
  target.dispatchEvent(event);
  target.dispatchEvent(new Event('hashchange'));
  assert.deepEqual(
    calls.map((call) => call[0]),
    ['original', 'replacement', 'original', 'launch']
  );
  assert.ok(calls.every((call) => call[2] === owner));
  assert.ok(calls.slice(0, 3).every((call) => call[1] === event));
  owner.actions.cleanup();
  target.dispatchEvent(event);
  target.dispatchEvent(new Event('hashchange'));
  assert.equal(calls.length, 4);
  assert.equal(destroyed, 1);
});

test('existing managed Files callbacks retain state, arguments, promises and failures', async () => {
  let managed;
  const namespace = 'https://vocab.muze.nl/solid-apps#';
  const owner = ownerFor(
    {
      ...filesLifecycle.actions,
      initializeFiles() {},
      receiveBrowseRequest(value) {
        return value;
      },
      cancelBrowseRequest() {}
    },
    {
      runtime: {
        host: {
          main: { querySelector: () => ({}) },
          manage(options) {
            managed = options;
          }
        }
      },
      api: { AppState, apps: namespace, browseCapability: 'urn:fixture:browse' }
    }
  );
  await owner.actions.initialize();
  owner.runtime.current = 'https://pod.example/retained/';
  const original = filesLifecycle.actions.captureState;
  const before = await managed.getState();
  const callback = managed.getState;
  owner.actions.captureState = async function () {
    assert.equal(this, owner);
    return { ...original.call(this), opaque: 'replacement' };
  };
  assert.equal((await callback()).opaque, 'replacement');
  owner.actions.captureState = original;
  assert.deepEqual(await callback(), before);
  assert.equal(owner.runtime.current, 'https://pod.example/retained/');
  const request = { resource: 'https://pod.example/item' };
  owner.actions.receiveBrowseRequest = function (value, signal) {
    assert.equal(this, owner);
    return Promise.resolve([value, signal]);
  };
  const controller = new AbortController();
  assert.deepEqual(await managed.onRequest(request, controller.signal), [
    request,
    controller.signal
  ]);
  const failure = new Error('action-dispatch-test: fixture failure');
  owner.actions.receiveBrowseRequest = async function () {
    throw failure;
  };
  await assert.rejects(
    managed.onRequest(request),
    (error) => error === failure
  );
  owner.actions.receiveBrowseRequest = function () {
    throw failure;
  };
  assert.throws(
    () => managed.onRequest(request),
    (error) => error === failure
  );
  owner.actions.receiveBrowseRequest = function (value) {
    return value;
  };
  assert.equal(managed.onRequest(request), request);
  assert.deepEqual(await managed.getState(), before);
  let handled = 0;
  owner.onError = function (error) {
    assert.equal(error, failure);
    handled += 1;
    return 'handled';
  };
  owner.actions.receiveBrowseRequest = async function () {
    throw failure;
  };
  assert.equal(await managed.onRequest(request), 'handled');
  assert.equal(handled, 1, 'SimplyFlow error handling runs once');
  owner.actions.receiveBrowseRequest = function (value) {
    return value;
  };
  assert.equal(managed.onRequest(request), request);
});

test('a scheduled toast invokes the current expiry action and restores normal expiry', (t) => {
  const scheduled = [];
  t.mock.method(globalThis, 'setTimeout', (callback) => {
    scheduled.push(callback);
    return scheduled.length;
  });
  t.mock.method(globalThis, 'clearTimeout', () => {});
  const owner = ownerFor(muzeSolidDesignToast.actions, {
    data: { muzeSolidDesignNotice: { text: '', visibility: { hidden: '' } } }
  });
  owner.actions.muzeSolidDesignNotify('First');
  let expired = 0;
  owner.actions.muzeSolidDesignExpireToast = function () {
    assert.equal(this, owner);
    expired += 1;
  };
  scheduled.shift()();
  assert.equal(expired, 1);
  assert.equal(owner.data.muzeSolidDesignNotice.text, 'First');
  owner.actions.muzeSolidDesignExpireToast =
    muzeSolidDesignToast.actions.muzeSolidDesignExpireToast;
  owner.actions.muzeSolidDesignNotify('Second');
  scheduled.shift()();
  assert.equal(owner.data.muzeSolidDesignNotice.visibility.hidden, '');
  assert.equal(owner.data.muzeSolidDesignNotice.text, '');
  assert.equal(expired, 1);
});

test('later callbacks in an upload use the current action without replaying writes', async () => {
  let release;
  const firstWrite = new Promise((resolve) => {
    release = resolve;
  });
  const writes = [];
  const session = {
    client: {
      async put(url, options) {
        writes.push({ url, options });
        if (writes.length === 1) {
          await firstWrite;
        }
        return new Response(null, { status: 201 });
      }
    }
  };
  const original = function (name) {
    return 'https://pod.example/original/' + name;
  };
  const owner = ownerFor(
    { ...fileEditing.actions, child: original, browse() {} },
    {
      runtime: {
        current: 'https://pod.example/',
        host: {
          requireSession: () => session,
          notify() {}
        }
      },
      api: { uploadFiles }
    }
  );
  const files = ['a', 'b'].map((name) => new File(['retained bytes'], name));
  const pending = owner.actions.uploadFiles(files);
  assert.equal(writes.length, 1);
  owner.actions.child = function (name) {
    assert.equal(this, owner);
    return 'https://pod.example/replacement/' + name;
  };
  release();
  await pending;
  owner.actions.child = original;
  await owner.actions.uploadFiles([new File(['last bytes'], 'c')]);
  assert.deepEqual(
    writes.map((write) => write.url),
    [
      'https://pod.example/original/a',
      'https://pod.example/replacement/b',
      'https://pod.example/original/c'
    ]
  );
  assert.ok(
    writes.every((write) => write.options.headers['If-None-Match'] === '*')
  );
  assert.equal(await writes[0].options.body.text(), 'retained bytes');
  assert.equal(await writes[1].options.body.text(), 'retained bytes');
});
