export const browseCapability = 'https://vocab.muze.nl/capabilities/browse';
export const browseInput = Object.freeze({
  '@context': { '@vocab': 'https://vocab.muze.nl/capability#' }
});
export function capabilityError(message, code = 'failed') {
  const error = new Error('capabilities: ' + message);
  error.code = code;
  return error;
}
export function selectionUrl(result) {
  try {
    const url = new URL(result?.['@id']);
    if (!['https:', 'http:'].includes(url.protocol) ||
      url.username || url.password) {
      throw new Error();
    }
    return url.href;
  }
  catch {
    throw capabilityError('Provider did not return a safe resource URL.');
  }
}
export function serializable(value) {
  function visit(item, depth) {
    if (depth > 30) {
      throw capabilityError('State nesting is too deep.');
    }
    if (item === null || typeof item === 'string' || typeof item === 'boolean' ||
      (typeof item === 'number' && Number.isFinite(item))) {
      return;
    }
    if (typeof item !== 'object' || (!Array.isArray(item) &&
      ![Object.prototype, null].includes(Object.getPrototypeOf(item)))) {
      throw capabilityError('State must contain only JSON values.');
    }
    for (const child of Object.values(item)) {
      visit(child, depth + 1);
    }
  }
  visit(value, 0);
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).byteLength > 65536) {
    throw capabilityError('State exceeds 64 KB.');
  }
  return JSON.parse(text);
}

// A private MessagePort owns its calls, cancellation and exactly-once replies.
export class PortConnection {
  constructor(port, handle, { timeout = 60000 } = {}) {
    this.port = port;
    this.handle = handle;
    this.timeout = timeout;
    this.pending = new Map();
    this.active = new Map();
    this.closed = false;
    port.onmessage = event => this.receive(event.data);
    port.onmessageerror = () => this.close('Message could not be decoded.');
    port.start?.();
  }
  async receive(message) {
    if (this.closed || !message || typeof message.id !== 'string') {
      return;
    }
    if (message.type === 'reply') {
      const pending = this.pending.get(message.id);
      if (pending) {
        if (message.error) {
          pending.reject(capabilityError(message.error.message, message.error.code));
        }
        else {
          pending.resolve(message.result);
        }
      }
      return;
    }
    if (message.type === 'cancel') {
      this.active.get(message.id)?.abort();
      return;
    }
    if (message.type !== 'call' || this.active.has(message.id)) {
      return;
    }
    if (this.active.size >= 32) {
      this.port.postMessage({ type: 'reply', id: message.id,
        error: { code: 'busy', message: 'capabilities: Too many active calls.' } });
      return;
    }
    const controller = new AbortController();
    this.active.set(message.id, controller);
    try {
      const result = await this.handle(message.method, message.input, {
        signal: controller.signal
      });
      if (!this.closed) {
        this.port.postMessage({ type: 'reply', id: message.id, result });
      }
    }
    catch (error) {
      if (!this.closed) {
        this.port.postMessage({ type: 'reply', id: message.id,
          error: { code: error.code || 'failed', message: error.message } });
      }
    }
    finally {
      this.active.delete(message.id);
    }
  }
  call(method, input, { signal, timeout = this.timeout } = {}) {
    if (this.closed || signal?.aborted || this.pending.size >= 32) {
      return Promise.reject(capabilityError('Connection unavailable or cancelled.'));
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
        this.port.postMessage({ type: 'cancel', id });
        finish(reject, capabilityError('Selection cancelled.', 'cancelled'));
      };
      const timer = setTimeout(() => {
        this.port.postMessage({ type: 'cancel', id });
        finish(reject, capabilityError('Request timed out.', 'timeout'));
      }, timeout);
      this.pending.set(id, {
        resolve: value => finish(resolve, value),
        reject: error => finish(reject, error)
      });
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        this.port.postMessage({ type: 'call', id, method, input });
      }
      catch (error) {
        finish(reject, error);
      }
    });
  }
  close(message = 'Application disconnected.') {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const call of this.pending.values()) {
      call.reject(capabilityError(message, 'disconnected'));
    }
    for (const controller of this.active.values()) {
      controller.abort();
    }
    this.port.close();
  }
}

export class ManagedApp {
  constructor({ name, capabilities = [], getState = () => ({}),
    restoreState = () => {}, onRequest, onCancel, onState } = {}) {
    Object.assign(this, { name, capabilities, getState, restoreState,
      onRequest, onCancel, onState });
    this.incoming = new Map();
    this.parent = window.opener;
    this.generation = crypto.randomUUID();
    this.listen = event => this.offer(event);
    window.addEventListener('message', this.listen);
    try {
      this.resume = JSON.parse(sessionStorage.getItem('solid-apps.managed') || 'null');
    }
    catch {}
    this.tick = setInterval(() => {
      if (this.resume && this.parent?.closed) {
        this.peer?.close('Workspace closed.');
        window.close();
      }
      else if (this.resume && this.parent) {
        this.parent.postMessage({ type: 'solid-apps:resume', ...this.resume,
          generation: this.generation },
          this.resume.origin);
      }
    }, 400);
    window.addEventListener('pagehide', () => this.peer?.close());
  }
  async offer(event) {
    const message = event.data;
    if (!this.parent || event.source !== this.parent ||
      message?.type !== 'solid-apps:offer' || !event.ports[0] ||
      typeof message.id !== 'string' || typeof message.key !== 'string') {
      return;
    }
    this.peer?.close();
    this.resume = { id: message.id, key: message.key, origin: event.origin };
    sessionStorage.setItem('solid-apps.managed', JSON.stringify(this.resume));
    this.peer = new PortConnection(event.ports[0], (method, input, options) =>
      this.handle(method, input, options));
    try {
      await this.peer.call('register', { name: this.name,
        generation: this.generation,
        capabilities: this.capabilities });
      this.restoring = Promise.resolve(this.restoreState(message.state));
      await this.restoring;
      await this.publish();
      this.onState?.('Connected to this workspace.');
    }
    catch (error) {
      this.onState?.(error.message);
    }
  }
  async handle(method, input, { signal }) {
    if (method === 'checkpoint') {
      await this.restoring;
      return serializable(await this.getState());
    }
    if (method !== 'capability' || !this.capabilities.includes(input.capability)) {
      throw capabilityError('Unsupported operation.', 'denied');
    }
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const cancel = () => {
        this.incoming.delete(id);
        this.onCancel?.({ id });
        reject(capabilityError('Selection cancelled.', 'cancelled'));
      };
      signal.addEventListener('abort', cancel, { once: true });
      const complete = result => {
        signal.removeEventListener('abort', cancel);
        resolve(result);
      };
      this.incoming.set(id, { complete });
      this.onRequest?.({ ...input, id });
    });
  }
  async publish() {
    if (this.peer && !this.peer.closed) {
      return this.peer.call('state', serializable(await this.getState()));
    }
  }
  async respond(id, response) {
    const request = this.incoming.get(id);
    if (!request) {
      throw capabilityError('Selection request is no longer active.');
    }
    this.incoming.delete(id);
    request.complete(response);
  }
  request(capability, input, options) {
    if (!this.peer) {
      return Promise.reject(capabilityError('Open this app through Launcher.'));
    }
    return this.peer.call('request', { capability, input }, options);
  }
}
