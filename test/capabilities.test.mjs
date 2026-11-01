import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CapabilityBroker } from '../broker/server.mjs';
import {
  brokerUrl, selectionUrl, CapabilityClient
} from '../packages/solid-app-data/src/capabilities.mjs';
const capability = 'https://example.org/arbitrary-capability';
const config = {
  clients: [
    { application: 'caller', workspace: 'one',
      origin: 'https://caller.example', key: 'c'.repeat(32) },
    { application: 'provider', workspace: 'one',
      origin: 'https://provider.example', key: 'p'.repeat(32) },
    { application: 'other', workspace: 'two',
      origin: 'https://other.example', key: 'o'.repeat(32) }
  ],
  routes: [{ workspace: 'one', requester: 'caller', provider: 'provider',
    capability }]
};
function fixture(t, options) {
  const broker = new CapabilityBroker(config, { pollTimeout: 50, ...options });
  t.after(() => broker.close());
  async function send(client, operation, body, method = 'POST') {
    const response = await broker.handle(new Request(
      'https://broker.example' + (client.id
        ? '/connections/' + client.id + (operation ? '/' + operation : '')
        : '/connect'),
      { method, headers: { Origin: client.origin,
        Authorization: 'Bearer ' + (client.token || client.key) },
      body: body === undefined ? undefined : JSON.stringify(body) }
    ));
    return { status: response.status, value: await response.json(), response };
  }
  async function connect(index) {
    const client = config.clients[index];
    const reply = await send(client, '', {});
    assert.equal(reply.status, 200);
    return { ...client, ...reply.value };
  }
  return { broker, send, connect };
}
test('broker authenticates configured origins and identities, not supplied claims', async t => {
  const { broker, send, connect } = fixture(t);
  assert.equal((await send({ ...config.clients[0],
    origin: config.clients[1].origin }, '', {})).status, 401);
  const response = await broker.handle(new Request('https://broker.example/connect', {
    method: 'POST', headers: { Origin: 'https://evil.example' }
  }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  const client = await connect(0);
  assert.equal(client.identity.application, 'caller');
  assert.equal((await send({ ...client, token: 'wrong' }, 'events',
    undefined, 'GET')).status, 401);
  assert.equal((await send(client, 'register',
    { capabilities: [capability] })).status, 403);
});
test('explicit route carries opaque payload privately and settles only once', async t => {
  const { send, connect } = fixture(t);
  const caller = await connect(0);
  const provider = await connect(1);
  const other = await connect(2);
  assert.equal((await send(provider, 'register',
    { capabilities: [capability] })).status, 200);
  const id = randomUUID();
  const input = { 'https://example.org/value': 'opaque' };
  assert.equal((await send(caller, 'request', { id, capability, input })).status,
    200);
  const events = (await send(provider, 'events', undefined, 'GET')).value;
  assert.equal(events[0].requester.origin, caller.origin);
  assert.deepEqual(events[0].input, input);
  assert.deepEqual((await send(other, 'events', undefined, 'GET')).value, []);
  assert.equal((await send(other, 'respond', { id, result: 'stolen' })).status, 403);
  assert.equal((await send(caller, 'respond', { id, result: 'spoof' })).status, 403);
  const result = { '@id': 'https://pod.example/file?view=all#person' };
  await send(provider, 'respond', { id, result });
  const response = (await send(caller, 'events', undefined, 'GET')).value[0];
  assert.deepEqual(response.result, result);
  assert.equal((await send(provider, 'respond', { id, result })).status, 403);
  assert.equal((await send(other, 'request',
    { id: randomUUID(), capability, input })).status, 403);
});
test('missing and ambiguous providers fail without silent selection', async t => {
  const { send, connect } = fixture(t);
  const caller = await connect(0);
  const request = () => send(caller, 'request', {
    id: randomUUID(), capability, input: {}
  });
  assert.equal((await request()).status, 409);
  for (let i = 0; i < 2; i++) {
    const provider = await connect(1);
    await send(provider, 'register', { capabilities: [capability] });
  }
  assert.match((await request()).value.error, /More than one/);
});
test('cancel, provider disconnect and timeout settle the caller and release work', async t => {
  const { send, connect, broker } = fixture(t, { requestTimeout: 20 });
  const caller = await connect(0);
  let provider = await connect(1);
  await send(provider, 'register', { capabilities: [capability] });
  async function request() {
    const id = randomUUID();
    await send(caller, 'request', { id, capability, input: {} });
    await send(provider, 'events', undefined, 'GET');
    return id;
  }
  const id = await request();
  await send(caller, 'cancel', { id });
  assert.equal((await send(provider, 'events', undefined, 'GET'))
    .value[0].type, 'cancel');
  assert.equal((await send(caller, 'events', undefined, 'GET'))
    .value[0].error.code, 'cancelled');
  await request();
  await send(provider, '', undefined, 'DELETE');
  assert.equal((await send(caller, 'events', undefined, 'GET'))
    .value[0].error.code, 'disconnected');
  provider = await connect(1);
  await send(provider, 'register', { capabilities: [capability] });
  await request();
  assert.equal((await send(caller, 'events', undefined, 'GET'))
    .value[0].error.code, 'timeout');
  assert.equal(broker.requests.size, 0);
});
test('capability URLs preserve full resources and refuse unsafe destinations', () => {
  const resource = 'https://pod.example/file?x=a%2Bb#person';
  assert.equal(selectionUrl({ '@id': resource }), resource);
  for (const result of [null, {}, { '@id': 'javascript:alert(1)' },
    { '@id': 'https://user:password@example.org/' }]) {
    assert.throws(() => selectionUrl(result));
  }
  assert.equal(brokerUrl('http://localhost:4175/'), 'http://localhost:4175');
  for (const url of ['http://remote.example/', 'https://example.org/?key=x',
    'https://example.org/#key', 'https://example.org/path']) {
    assert.throws(() => brokerUrl(url));
  }
});
test('shutdown settles work and refuses new sessions', async t => {
  const { broker, send, connect } = fixture(t);
  const caller = await connect(0);
  const events = send(caller, 'events', undefined, 'GET');
  broker.close();
  assert.deepEqual((await events).value, []);
  assert.equal((await send(config.clients[0], '', {})).status, 503);
});
test('disconnect aborts an in-flight connection attempt', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason),
      { once: true });
  });
  const client = new CapabilityClient('https://broker.example/');
  const connecting = client.connect('fixture-key'.repeat(4));
  client.disconnect();
  await assert.rejects(connecting);
  assert.equal(client.connection, null);
});
