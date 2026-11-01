export const browseCapability = 'https://vocab.muze.nl/capabilities/browse';
export const browseInput = Object.freeze({
  '@context': { '@vocab': 'https://vocab.muze.nl/capability#' }
});
export function selectionUrl(result) {
  if (!result || typeof result['@id'] !== 'string') {
    throw new Error('capabilities: Provider did not return a resource URL.');
  }
  const url = new URL(result['@id']);
  if (!['https:', 'http:'].includes(url.protocol) ||
    url.username || url.password) {
    throw new Error('capabilities: Provider returned an unsafe resource URL.');
  }
  return url.href;
}
export function brokerUrl(value) {
  if (!value) {
    throw new Error('capabilities: Set the capability broker URL in Preferences.');
  }
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
    url.username || url.password || url.search || url.hash ||
    url.pathname !== '/') {
    throw new Error('capabilities: Use an HTTPS broker origin (HTTP on localhost).');
  }
  return url.origin;
}
function failure(message, code = 'failed') {
  const error = new Error('capabilities: ' + message);
  error.code = code;
  return error;
}

export class CapabilityClient {
  constructor(url, { capabilities = [], onRequest, onCancel, onState } = {}) {
    this.url = brokerUrl(url);
    this.capabilities = capabilities;
    this.onRequest = onRequest;
    this.onCancel = onCancel;
    this.onState = onState;
    this.pending = new Map();
    this.incoming = new Set();
    this.connection = null;
  }
  async http(path, { method = 'POST', body, key, signal, keepalive } = {}) {
    const response = await fetch(this.url + path, {
      method, signal, keepalive, credentials: 'omit', cache: 'no-store',
      headers: { Authorization: 'Bearer ' + (key || this.connection?.token),
        'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const value = await response.json();
    if (!response.ok) {
      throw failure(value.error || 'Broker request failed.');
    }
    return value;
  }
  async connect(key) {
    if (this.connection || (this.controller && !this.controller.signal.aborted)) {
      throw failure('Disconnect before connecting again.');
    }
    this.controller = new AbortController();
    const controller = this.controller;
    try {
      this.connection = await this.http('/connect', {
        key, signal: AbortSignal.any([
          controller.signal, AbortSignal.timeout(10000)
        ])
      });
      await this.send('register', { capabilities: this.capabilities });
      this.onState?.('Connected to app services.');
      this.poll(this.connection, controller).catch(error => {
        if (!controller.signal.aborted) {
          this.disconnect(error.message);
        }
      });
    }
    catch (error) {
      this.disconnect(error.message);
      throw error;
    }
    return this.connection.identity;
  }
  send(operation, body) {
    if (!this.connection) {
      return Promise.reject(failure('Connect to app services first.'));
    }
    return this.http('/connections/' + this.connection.id + '/' + operation,
      { body, signal: this.controller.signal });
  }
  async poll(connection, controller) {
    while (!controller.signal.aborted) {
      const signal = AbortSignal.any([
        controller.signal, AbortSignal.timeout(35000)
      ]);
      const events = await this.http(
        '/connections/' + connection.id + '/events',
        { method: 'GET', signal, key: connection.token }
      );
      if (controller.signal.aborted) {
        return;
      }
      for (const event of events) {
        if (event.type === 'response') {
          const pending = this.pending.get(event.id);
          if (pending) {
            if (event.error) {
              pending.reject(failure(event.error.message, event.error.code));
            }
            else {
              pending.resolve(event.result);
            }
          }
        }
        else if (event.type === 'request') {
          this.incoming.add(event.id);
          this.onRequest?.(event);
        }
        else if (event.type === 'cancel') {
          this.incoming.delete(event.id);
          this.onCancel?.(event);
        }
      }
    }
  }
  request(capability, input, { signal } = {}) {
    if (!this.connection || signal?.aborted) {
      return Promise.reject(failure('Not connected or request cancelled.'));
    }
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const finish = (callback, value) => {
        if (this.pending.delete(id)) {
          clearTimeout(timer);
          signal?.removeEventListener('abort', cancel);
          callback(value);
        }
      };
      const cancel = () => {
        finish(reject, failure('Selection cancelled.', 'cancelled'));
        this.send('cancel', { id }).catch(() => {});
      };
      const timer = setTimeout(() => {
        finish(reject, failure('Selection timed out.', 'timeout'));
        this.send('cancel', { id }).catch(() => {});
      }, 65000);
      this.pending.set(id, {
        resolve: value => finish(resolve, value),
        reject: error => finish(reject, error)
      });
      signal?.addEventListener('abort', cancel, { once: true });
      this.send('request', { id, capability, input }).then(() => {
        // A cancellation can precede acknowledgement of the request.
        if (!this.pending.has(id)) {
          this.send('cancel', { id }).catch(() => {});
        }
      }).catch(error => finish(reject, error));
    });
  }
  async respond(id, response) {
    if (!this.incoming.has(id)) {
      throw failure('Selection request is no longer active.');
    }
    await this.send('respond', { id, ...response });
    this.incoming.delete(id);
  }
  disconnect(message = 'Disconnected from app services.') {
    const connection = this.connection;
    this.controller?.abort();
    if (!connection) {
      this.onState?.(message);
      return;
    }
    this.connection = null;
    for (const pending of this.pending.values()) {
      pending.reject(failure(message, 'disconnected'));
    }
    for (const id of this.incoming) {
      this.onCancel?.({ id, error: { message } });
    }
    this.incoming.clear();
    this.onState?.(message);
    this.http('/connections/' + connection.id, {
      method: 'DELETE', key: connection.token, keepalive: true
    }).catch(() => {});
  }
}
