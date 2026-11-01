import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseFiles } from '../apps/launcher/src/picker.mjs';
import { WorkspaceBroker } from '../packages/solid-app-data/src/workspace-broker.mjs';
import { PortConnection, browseCapability } from '../packages/solid-app-data/src/capabilities.mjs';

const filesUrl = 'https://suite.example/files/#webid=https%3A%2F%2Fperson.example%2F%23me';
function fixture(t, { blocked = false, restoreError, neverReady = false } = {}) {
  const windows = [], peers = [], calls = [];
  const target = { location: { origin: 'https://suite.example' },
    addEventListener() {}, removeEventListener() {},
    open(url, name, features) {
      calls.push({ type: 'open', url, name, features });
      if (blocked) { return null; }
      const win = { closed: false,
        focus() { calls.push({ type: 'focus', url }); },
        close() { this.closed = true; },
        postMessage(_message, _origin, ports) {
          const peer = new PortConnection(ports[0], method => {
            assert.equal(method, 'capability');
            calls.push({ type: 'request', url });
            return { result: { '@id': 'https://pod.example/selected' } };
          });
          peers.push(peer);
          (async () => {
            await peer.call('register', { capabilities: [browseCapability],
              restoring: true, generation: 'fixture' });
            if (restoreError) {
              await peer.call('restore-error', { message: restoreError });
            }
            else if (!neverReady) {
              await peer.call('ready', null);
            }
          })().catch(() => {});
        } };
      windows.push(win);
      return win;
    }
  };
  const broker = new WorkspaceBroker({ target, onChange: async () => {},
    authorize: (caller, entry, capability) => caller === 'launcher' &&
      entry.allowBrowse && capability === browseCapability });
  t.after(() => { broker.dispose(); peers.forEach(peer => peer.close()); });
  return { broker, calls, windows };
}

test('one click opens built-in Files before awaiting its ready connection', async t => {
  const { broker, calls } = fixture(t);
  const result = chooseFiles(broker, filesUrl);
  assert.equal(calls[0].type, 'open');
  assert.equal(calls[0].url, filesUrl);
  assert.equal(calls[0].name, '_blank');
  assert.deepEqual(await result, { '@id': 'https://pod.example/selected' });
  assert.equal(calls.filter(call => call.type === 'open').length, 1);
  assert(calls.some(call => call.type === 'focus'));
});

test('saved and live Files instances are reused without duplicate windows', async t => {
  const { broker, calls } = fixture(t);
  broker.add({ id: 'saved', url: 'https://suite.example/files/',
    label: 'My Files', allowBrowse: true, state: { folder: 'https://pod.example/' } });
  await chooseFiles(broker, filesUrl);
  await chooseFiles(broker, filesUrl);
  assert.equal(broker.instances.size, 1);
  assert.equal(calls.filter(call => call.type === 'open').length, 1);
  assert.equal(broker.instances.get('saved').entry.state.folder, 'https://pod.example/');
});

test('an existing denied Files instance is not silently granted or bypassed', async t => {
  const { broker, calls } = fixture(t);
  broker.add({ id: 'denied', url: filesUrl, allowBrowse: false, state: null });
  await assert.rejects(chooseFiles(broker, filesUrl), /Enable Allow resource/);
  assert.equal(calls.length, 0);
  assert.equal(broker.instances.get('denied').entry.allowBrowse, false);
});

test('multiple eligible live providers require a user choice', async t => {
  const { broker, calls } = fixture(t);
  const first = broker.open(filesUrl, { allowBrowse: true });
  const second = broker.open('https://other.example/files/', { allowBrowse: true });
  await Promise.all([broker.whenReady(first.entry.id), broker.whenReady(second.entry.id)]);
  await assert.rejects(chooseFiles(broker, filesUrl), /More than one provider/);
  assert.equal(calls.filter(call => call.type === 'request').length, 0);
});

test('cancelling startup prevents invocation and leaves the opened app usable', async t => {
  const { broker, calls, windows } = fixture(t);
  const controller = new AbortController();
  const result = chooseFiles(broker, filesUrl, { signal: controller.signal });
  controller.abort();
  await assert.rejects(result, error => error.code === 'cancelled');
  assert.equal(calls.filter(call => call.type === 'request').length, 0);
  assert.equal(windows[0].closed, false);
});

test('blocked windows, restoration failures and startup deadlines fail visibly', async t => {
  const blocked = fixture(t, { blocked: true });
  await assert.rejects(chooseFiles(blocked.broker, filesUrl), /Allow popups/);
  const failed = fixture(t, { restoreError: 'Sign-in required.' });
  await assert.rejects(chooseFiles(failed.broker, filesUrl), /Sign-in required/);
  const waiting = fixture(t, { neverReady: true });
  await assert.rejects(chooseFiles(waiting.broker, filesUrl, { timeout: 10 }),
    error => error.code === 'timeout');
});

test('route permission is rechecked after startup before invocation', async t => {
  const { broker, calls } = fixture(t);
  await assert.rejects(chooseFiles(broker, filesUrl, {
    onWait(message) {
      if (message.startsWith('Choose a resource')) {
        [...broker.instances.values()][0].entry.allowBrowse = false;
      }
    }
  }), /allow resource selection/);
  assert.equal(calls.filter(call => call.type === 'request').length, 0);
});
