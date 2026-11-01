import test from 'node:test';
import assert from 'node:assert/strict';
import { PortConnection, capabilityError, selectionUrl,
  serializable } from '../packages/solid-app-data/src/capabilities.mjs';
import { WorkspaceBroker } from '../packages/solid-app-data/src/workspace-broker.mjs';

function pair(t, handle, options) {
  const channel = new MessageChannel();
  const caller = new PortConnection(channel.port1, () => {}, options);
  const provider = new PortConnection(channel.port2, handle, options);
  t.after(() => { caller.close(); provider.close(); });
  return { caller, provider };
}
test('private ports carry results and errors without shared storage or a service', async t => {
  const { caller } = pair(t, async (method, input) => {
    if (method !== 'select') {
      throw capabilityError('Not allowed.', 'denied');
    }
    return { '@id': input.url };
  });
  const url = 'https://pod.example/file?view=all#subject';
  assert.equal(selectionUrl(await caller.call('select', { url })), url);
  await assert.rejects(caller.call('wrong', {}), error => error.code === 'denied');
});
test('cancel, timeout and disconnect settle outstanding calls', async t => {
  let observe;
  const cancelled = new Promise(resolve => { observe = resolve; });
  const { caller, provider } = pair(t, (_method, _input, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        observe();
        reject(capabilityError('Cancelled.', 'cancelled'));
      });
    }), { timeout: 30 });
  const controller = new AbortController();
  const pending = caller.call('wait', {}, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.code === 'cancelled');
  await cancelled;
  await assert.rejects(caller.call('wait', {}), error => error.code === 'timeout');
  const outstanding = caller.call('wait', {});
  caller.close();
  provider.close();
  await assert.rejects(outstanding, error => error.code === 'disconnected');
});
test('JSON restoration state rejects lossy or unsafe representations', () => {
  const value = { selected: 'https://pod.example/#me', extra: ['unknown', null] };
  assert.deepEqual(serializable(value), value);
  for (const unsupported of [undefined, { f() {} }, new Date(), { n: NaN }]) {
    assert.throws(() => serializable(unsupported), /JSON/);
  }
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => serializable(cyclic), /nesting/);
  assert.throws(() => selectionUrl({ '@id': 'javascript:alert(1)' }));
});
test('workspace drafts cannot mutate a clean persistence snapshot by alias', t => {
  const snapshot = { version: 1, launcher: { resource: '' }, apps: [{
    id: 'one', url: 'https://files.example/', state: { folder: 'original' }
  }] };
  const broker = new WorkspaceBroker({ snapshot,
    target: { addEventListener() {}, removeEventListener() {} } });
  t.after(() => broker.dispose());
  broker.launcherState.resource = 'https://pod.example/latest';
  broker.instances.get('one').entry.state.folder = 'changed';
  assert.equal(snapshot.launcher.resource, '');
  assert.equal(snapshot.apps[0].state.folder, 'original');
  assert.equal(broker.snapshot().launcher.resource, 'https://pod.example/latest');
});
test('workspace routing requires an explicit grant and binds state to one instance', async t => {
  const peers = [];
  const target = {
    location: { origin: 'https://launcher.example' },
    addEventListener() {}, removeEventListener() {},
    open() {
      return { closed: false, focus() {}, close() { this.closed = true; },
        postMessage(message, origin, ports) {
          assert.equal(origin, 'https://files.example');
          const peer = new PortConnection(ports[0], method => {
            assert.equal(method, 'capability');
            return { result: { '@id': 'https://pod.example/resource' } };
          });
          peers.push(peer);
        } };
    }
  };
  const broker = new WorkspaceBroker({ target, onChange: async () => {},
    authorize: (caller, entry, capability) => caller === 'launcher' &&
      entry.allowBrowse && capability === 'https://example.org/select' });
  t.after(() => { broker.dispose(); peers.forEach(peer => peer.close()); });
  const record = broker.open('https://files.example/app');
  broker.offer(record);
  const peer = peers[0];
  await peer.call('register', { capabilities: ['https://example.org/select'] });
  await assert.rejects(broker.request('https://example.org/select', {}), /allow/);
  await broker.allow(record.entry.id, true);
  assert.deepEqual(await broker.request('https://example.org/select', {}),
    { '@id': 'https://pod.example/resource' });
  await assert.rejects(peer.call('request', {
    capability: 'https://example.org/select', input: {}
  }), /allow/);
  await peer.call('state', { folder: 'https://pod.example/folder/', unknown: 42 });
  assert.equal(broker.snapshot().apps[0].state.unknown, 42);
  assert(!JSON.stringify(broker.snapshot()).includes(record.key));
  const existingWindow = record.win;
  broker.resume({ data: { type: 'solid-apps:resume', id: record.entry.id,
    key: record.key }, origin: 'https://evil.example', source: {} });
  assert.equal(record.win, existingWindow);
  broker.resume({ data: { type: 'solid-apps:resume', id: record.entry.id,
    key: record.key }, origin: 'https://files.example', source: {} });
  assert.equal(record.win, existingWindow);
});
