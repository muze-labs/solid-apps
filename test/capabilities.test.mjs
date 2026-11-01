import test from 'node:test';
import assert from 'node:assert/strict';
import { PortConnection, capabilityError, selectionUrl,
  serializable } from '../packages/solid-app-data/src/capabilities.mjs';
import { WorkspaceBroker } from '../packages/solid-app-data/src/workspace-broker.mjs';

const restoration = value => ({ turtle:
  '<urn:muze:solid-apps:state:root> <https://example.org/draft> "' + value + '" .' });

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
test('Transport values reject lossy or unsafe representations', () => {
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
  const snapshot = { version: 2, launcher: { resource: '' }, apps: [{
    id: 'one', url: 'https://files.example/', state: restoration('original')
  }] };
  const broker = new WorkspaceBroker({ snapshot,
    target: { addEventListener() {}, removeEventListener() {} } });
  t.after(() => broker.dispose());
  broker.launcherState.resource = 'https://pod.example/latest';
  broker.instances.get('one').entry.state.turtle = restoration('changed').turtle;
  assert.equal(snapshot.launcher.resource, '');
  assert.deepEqual(snapshot.apps[0].state, restoration('original'));
  assert.equal(broker.snapshot().launcher.resource, 'https://pod.example/latest');
});
test('workspace routing requires an explicit grant and binds state to one instance', async t => {
  const peers = [];
  let focused = 0;
  const target = {
    location: { origin: 'https://launcher.example' },
    addEventListener() {}, removeEventListener() {},
    open() {
      return { closed: false, focus() { focused++; },
        close() { this.closed = true; },
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
  assert.equal(focused, 0);
  await broker.allow(record.entry.id, true);
  assert.deepEqual(await broker.request('https://example.org/select', {}),
    { '@id': 'https://pod.example/resource' });
  assert.equal(focused, 1);
  await assert.rejects(broker.request('https://example.org/select', {}, {
    providerId: ''
  }), /allow/);
  assert.equal(focused, 1);
  await assert.rejects(peer.call('request', {
    capability: 'https://example.org/select', input: {}
  }), /allow/);
  await peer.call('state', restoration('unknown-42'));
  assert.deepEqual(broker.snapshot().apps[0].state, restoration('unknown-42'));
  assert(!JSON.stringify(broker.snapshot()).includes(record.key));
  const existingWindow = record.win;
  broker.resume({ data: { type: 'solid-apps:resume', id: record.entry.id,
    key: record.key }, origin: 'https://evil.example', source: {} });
  assert.equal(record.win, existingWindow);
  broker.resume({ data: { type: 'solid-apps:resume', id: record.entry.id,
    key: record.key }, origin: 'https://files.example', source: {} });
  assert.equal(record.win, existingWindow);
  broker.closing = true;
  await assert.rejects(peer.call('state', restoration('stale state')), /active/);
  assert.deepEqual(broker.snapshot().apps[0].state, restoration('unknown-42'));
});

async function checkpointFixture(t, handle, options = {}) {
  const peers = [];
  const target = { addEventListener() {}, removeEventListener() {},
    open() {
      return { closed: false, focus() {}, close() { this.closed = true; },
        postMessage(message, _origin, ports) {
          peers.push(new PortConnection(ports[0], (method, input, options) =>
            handle(method, input, options, message.id)));
        } };
    }
  };
  const snapshots = [];
  const broker = new WorkspaceBroker({ target, ...options,
    onChange: async snapshot => { snapshots.push(snapshot); } });
  t.after(() => { broker.dispose(); peers.forEach(peer => peer.close()); });
  const record = broker.open('https://files.example/', { label: 'My Files' });
  broker.offer(record);
  await peers[0].call('register', { capabilities: [], generation: 'one',
    restoring: true });
  return { broker, record, peers, snapshots };
}

test('a healthy three-second checkpoint captures fresh state', async t => {
  const { broker, record, peers } = await checkpointFixture(t, async () => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    return restoration('fresh');
  });
  await peers[0].call('ready', null);
  await broker.checkpoint();
  assert.deepEqual(record.entry.state, restoration('fresh'));
});

test('restoration is distinct from readiness and failures name the app', async t => {
  let calls = 0;
  const { broker, record, peers } = await checkpointFixture(t, () => { calls++; });
  await assert.rejects(broker.checkpoint(), /My Files.*still restoring/);
  assert.equal(calls, 0);
  await peers[0].call('restore-error', { message: 'Pod sign-in required.' });
  await assert.rejects(broker.checkpoint(), /My Files.*Pod sign-in required/);
  assert.equal(record.entry.state, null);
});

test('timeout keeps previous state and permits a fresh checkpoint after reconnect', async t => {
  let responsive = false;
  let slowId;
  const { broker, record, peers } = await checkpointFixture(t,
    (_method, _input, _options, id) => {
    if (!responsive && id === slowId) { return new Promise(() => {}); }
    return restoration('still-live');
  }, { checkpointTimeout: 30 });
  slowId = record.entry.id;
  await peers[0].call('state', restoration('previous'));
  await peers[0].call('ready', null);
  const sibling = broker.open('https://contacts.example/', { label: 'Contacts' });
  broker.offer(sibling);
  await peers[1].call('register', { capabilities: [], generation: 'sibling',
    restoring: true });
  await peers[1].call('ready', null);
  await assert.rejects(broker.checkpoint(), /My Files.*timed out/);
  assert.deepEqual(record.entry.state, restoration('previous'));
  assert.deepEqual(sibling.entry.state, restoration('still-live'));
  assert.equal(record.win.closed, false);
  assert.equal(record.registered, false);
  responsive = true;
  broker.offer(record);
  await peers[2].call('register', { capabilities: [], generation: 'one',
    restoring: true });
  await peers[2].call('ready', null);
  await broker.checkpoint();
  assert.deepEqual(record.entry.state, restoration('still-live'));
});

test('older clients require reload after timeout to protect their live drafts', async t => {
  const { broker, record, peers } = await checkpointFixture(t,
    () => new Promise(() => {}), { checkpointTimeout: 30 });
  await peers[0].call('register', { capabilities: [], generation: 'old-client' });
  await assert.rejects(broker.checkpoint(), /timed out/);
  broker.inspect();
  assert.equal(peers.length, 1);
  assert.match(record.restoreError, /Reload this app/);
  assert.equal(record.win.closed, false);
});
