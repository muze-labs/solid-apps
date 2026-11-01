import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import http from 'node:http';

const digest = value => createHash('sha256').update(value).digest();
const equal = (a, b) => timingSafeEqual(digest(a), digest(b));
function fail(message, status = 400) {
  const error = new Error('broker: ' + message);
  error.status = status;
  throw error;
}
function uri(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) &&
      !url.username && !url.password;
  }
  catch {
    return false;
  }
}
export class CapabilityBroker {
  constructor(config, {
    requestTimeout = 60000, pollTimeout = 25000, leaseTimeout = 60000
  } = {}) {
    if (!Array.isArray(config.clients) || !Array.isArray(config.routes)) {
      fail('Configure clients and explicit routes.');
    }
    this.clients = config.clients.map(client => ({ ...client }));
    this.routes = config.routes.map(route => ({ ...route }));
    const identities = new Set();
    const keys = new Set();
    for (const client of this.clients) {
      const identity = client.workspace + '/' + client.application;
      if (!client.workspace || !client.application || !uri(client.origin) ||
        new URL(client.origin).origin !== client.origin ||
        typeof client.key !== 'string' || client.key.length < 32 ||
        identities.has(identity) || keys.has(client.key)) {
        fail('Clients need unique identities/keys and exact origins.');
      }
      identities.add(identity);
      keys.add(client.key);
    }
    for (const route of this.routes) {
      if (!uri(route.capability) ||
        !identities.has(route.workspace + '/' + route.requester) ||
        !identities.has(route.workspace + '/' + route.provider)) {
        fail('Routes must name configured clients and capability URIs.');
      }
    }
    this.connections = new Map();
    this.requests = new Map();
    this.requestTimeout = requestTimeout;
    this.pollTimeout = pollTimeout;
    this.leaseTimeout = leaseTimeout;
    this.sweep = setInterval(() => {
      for (const connection of this.connections.values()) {
        if (Date.now() - connection.seen > leaseTimeout) {
          this.drop(connection);
        }
      }
    }, Math.min(leaseTimeout, 1000));
    this.sweep.unref();
  }
  identity(connection) {
    const { application, workspace, origin } = connection.client;
    return { application, workspace, origin };
  }
  send(connection, event) {
    if (!this.connections.has(connection.id)) {
      return;
    }
    if (connection.waiter) {
      connection.waiter([event]);
    }
    else if (connection.events.length < 64) {
      connection.events.push(event);
    }
    else {
      this.drop(connection);
    }
  }
  finish(record, error, result) {
    if (!this.requests.delete(record.id)) {
      return;
    }
    clearTimeout(record.timer);
    this.send(record.caller, {
      type: 'response', id: record.id, error, result
    });
    if (error) {
      this.send(record.provider, {
        type: 'cancel', id: record.id, error
      });
    }
  }
  drop(connection) {
    this.connections.delete(connection.id);
    connection.waiter?.([]);
    for (const record of this.requests.values()) {
      if (record.caller === connection || record.provider === connection) {
        this.finish(record, { code: 'disconnected',
          message: 'An application disconnected. Connect and try again.' });
      }
    }
  }
  close() {
    this.closed = true;
    clearInterval(this.sweep);
    for (const connection of this.connections.values()) {
      this.drop(connection);
    }
  }
  async body(request) {
    const text = await request.text();
    if (Buffer.byteLength(text) > 65536) {
      fail('Message exceeds 64 KB.', 413);
    }
    try {
      const value = JSON.parse(text);
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        fail('Expected a JSON object.');
      }
      return value;
    }
    catch {
      fail('Expected a JSON object.');
    }
  }
  async handle(request) {
    const origin = request.headers.get('origin');
    const headers = { 'Content-Type': 'application/json',
      'Cache-Control': 'no-store', Vary: 'Origin' };
    try {
      if (!this.clients.some(client => client.origin === origin)) {
        fail('Origin is not configured.', 403);
      }
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
      headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
      if (this.closed) {
        fail('Broker is shutting down.', 503);
      }
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
      }
      const authorization = request.headers.get('authorization') || '';
      const bearer = authorization.startsWith('Bearer ')
        ? authorization.slice(7) : '';
      const path = new URL(request.url).pathname;
      if (path === '/connect' && request.method === 'POST') {
        const client = this.clients.find(item =>
          item.origin === origin && equal(item.key, bearer));
        if (!client) {
          fail('Invalid application key.', 401);
        }
        if (this.connections.size >= 64) {
          fail('Connection limit reached.', 429);
        }
        const connection = { id: randomUUID(),
          token: randomBytes(32).toString('base64url'), client,
          capabilities: [], events: [], seen: Date.now() };
        this.connections.set(connection.id, connection);
        return Response.json({ id: connection.id, token: connection.token,
          identity: this.identity(connection) }, { headers });
      }
      const match = /^\/connections\/([\w-]+)(?:\/(\w+))?$/.exec(path);
      const connection = this.connections.get(match?.[1]);
      if (!connection || connection.client.origin !== origin ||
        !equal(connection.token, bearer)) {
        fail('Connection is not authenticated.', 401);
      }
      connection.seen = Date.now();
      const operation = match[2];
      if (!operation && request.method === 'DELETE') {
        this.drop(connection);
        return Response.json({}, { headers });
      }
      if (operation === 'events' && request.method === 'GET') {
        if (connection.waiter) {
          fail('Only one event poll is allowed.', 409);
        }
        let events = connection.events.splice(0);
        if (!events.length) {
          events = await new Promise(resolve => {
            const complete = values => {
              clearTimeout(timer);
              connection.waiter = null;
              request.signal.removeEventListener('abort', abort);
              resolve(values);
            };
            const abort = () => complete([]);
            const timer = setTimeout(() => complete([]), this.pollTimeout);
            connection.waiter = complete;
            request.signal.addEventListener('abort', abort, { once: true });
            if (request.signal.aborted) {
              abort();
            }
          });
        }
        return Response.json(events, { headers });
      }
      if (request.method !== 'POST') {
        fail('Unknown operation.', 404);
      }
      const body = await this.body(request);
      if (!this.connections.has(connection.id)) {
        fail('Connection closed.', 401);
      }
      const client = connection.client;
      if (operation === 'register') {
        if (!Array.isArray(body.capabilities) ||
          body.capabilities.length > 16 || body.capabilities.some(capability =>
            !this.routes.some(route => route.workspace === client.workspace &&
              route.provider === client.application &&
              route.capability === capability))) {
          fail('Capability registration is not allowed.', 403);
        }
        connection.capabilities = [...new Set(body.capabilities)];
      }
      else if (operation === 'request') {
        if (!/^[0-9a-f-]{36}$/.test(body.id) || this.requests.has(body.id) ||
          !body.input || typeof body.input !== 'object' ||
          Array.isArray(body.input)) {
          fail('Invalid or duplicate request.');
        }
        const routes = this.routes.filter(route =>
          route.workspace === client.workspace &&
          route.requester === client.application &&
          route.capability === body.capability);
        if (!routes.length) {
          fail('Capability route is not allowed.', 403);
        }
        const providers = [...this.connections.values()].filter(candidate =>
          candidate.client.workspace === client.workspace &&
          candidate.capabilities.includes(body.capability) &&
          routes.some(route => route.provider === candidate.client.application));
        if (providers.length !== 1) {
          fail(providers.length ? 'More than one provider is connected.' :
            'No provider connected. Open Files and connect it first.', 409);
        }
        if ([...this.requests.values()].filter(record =>
          record.caller === connection).length >= 16) {
          fail('Pending request limit reached.', 429);
        }
        const record = { id: body.id, caller: connection,
          provider: providers[0] };
        record.timer = setTimeout(() => this.finish(record, {
          code: 'timeout', message: 'Selection timed out. Try again.'
        }), this.requestTimeout);
        this.requests.set(record.id, record);
        this.send(record.provider, { type: 'request', id: body.id,
          capability: body.capability, input: body.input,
          requester: this.identity(connection) });
      }
      else if (operation === 'respond' || operation === 'cancel') {
        const record = this.requests.get(body.id);
        if (!record || (operation === 'respond'
          ? record.provider !== connection : record.caller !== connection)) {
          fail('Request is not owned by this connection.', 403);
        }
        let error = body.error;
        if (operation === 'cancel') {
          error = { code: 'cancelled', message: 'Selection cancelled.' };
        }
        if (error && (typeof error.code !== 'string' ||
          typeof error.message !== 'string')) {
          fail('Invalid error response.');
        }
        if (!error && !Object.hasOwn(body, 'result')) {
          fail('Response needs a result or error.');
        }
        this.finish(record, error, body.result);
      }
      else {
        fail('Unknown operation.', 404);
      }
      return Response.json({}, { headers });
    }
    catch (error) {
      return Response.json({ error: error.message }, {
        status: error.status || 500, headers
      });
    }
  }
}

export function brokerServer(broker) {
  return http.createServer(async (incoming, outgoing) => {
    const controller = new AbortController();
    outgoing.on('close', () => {
      if (!outgoing.writableEnded) {
        controller.abort();
      }
    });
    try {
      let length = 0;
      const chunks = [];
      for await (const chunk of incoming) {
        length += chunk.length;
        if (length > 65536) {
          outgoing.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      const request = new Request('http://broker.invalid' + incoming.url, {
        method: incoming.method, headers: incoming.headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
        signal: controller.signal
      });
      const response = await broker.handle(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    }
    catch {
      outgoing.writeHead(400).end();
    }
  });
}
