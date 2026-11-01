import { PortConnection, capabilityError, serializable } from './capabilities.mjs';

export class WorkspaceBroker {
  constructor({ snapshot = { version: 1, apps: [], launcher: {} }, keys = {},
    onChange = () => {}, onMessage = () => {}, authorize = () => false,
    target = window } = {}) {
    Object.assign(this, { onChange, onMessage, authorize, target });
    this.instances = new Map();
    this.extra = structuredClone(snapshot);
    this.launcherState = structuredClone(snapshot.launcher || {});
    this.closing = false;
    for (const entry of snapshot.apps) {
      this.add(entry, keys[entry.id]);
    }
    this.listener = event => this.resume(event);
    target.addEventListener('message', this.listener);
    this.timer = setInterval(() => this.inspect(), 400);
  }
  add(entry, key = crypto.randomUUID() + crypto.randomUUID()) {
    const record = { entry: structuredClone(entry), key, win: null, peer: null,
      registered: false, capabilities: [], lastOffer: 0 };
    this.instances.set(entry.id, record);
    return record;
  }
  snapshot() {
    return { ...this.extra, version: 1, launcher: serializable(this.launcherState),
      apps: [...this.instances.values()].map(record => serializable(record.entry)) };
  }
  keys() {
    return Object.fromEntries([...this.instances].map(([id, record]) =>
      [id, record.key]));
  }
  changed() {
    return this.onChange(this.snapshot(), this.keys());
  }
  open(url, { allowBrowse = false, label = '', id } = {}) {
    let record = id && this.instances.get(id);
    if (!record) {
      record = this.add({ id: crypto.randomUUID(), url, label,
        allowBrowse, state: null });
    }
    if (record.win && !record.win.closed) {
      record.win.focus();
      return record;
    }
    this.closing = false;
    record.win = this.target.open(record.entry.url, '_blank',
      this.presentation === 'window' ? 'popup' : '');
    if (!record.win) {
      this.onMessage('Browser blocked an app. Allow popups or restore it separately.');
    }
    this.changed().catch(error => this.onMessage(error.message));
    return record;
  }
  restore() {
    for (const record of this.instances.values()) {
      this.open(record.entry.url, { id: record.entry.id });
    }
  }
  inspect() {
    for (const record of this.instances.values()) {
      if (!record.win) {
        continue;
      }
      if (record.win.closed) {
        this.detach(record);
        if (!this.closing) {
          this.instances.delete(record.entry.id);
        }
        this.changed().catch(error => this.onMessage(error.message));
      }
      else if (!record.registered && Date.now() - record.lastOffer > 1500) {
        this.offer(record);
      }
    }
  }
  resume(event) {
    const data = event.data;
    const record = this.instances.get(data?.id);
    if (!record || data.type !== 'solid-apps:resume' ||
      data.key !== record.key || event.origin !== new URL(record.entry.url).origin ||
      (record.win && record.win !== event.source) || !event.source) {
      return;
    }
    if (record.registered && record.generation === data.generation) {
      return;
    }
    record.win = event.source;
    this.offer(record);
  }
  offer(record) {
    record.peer?.close('Application reconnected.');
    const channel = new MessageChannel();
    record.lastOffer = Date.now();
    record.peer = new PortConnection(channel.port1,
      (method, input, options) => this.handle(record, method, input, options));
    record.win.postMessage({ type: 'solid-apps:offer', id: record.entry.id,
      key: record.key, state: record.entry.state },
    new URL(record.entry.url).origin, [channel.port2]);
  }
  async handle(record, method, input, options) {
    if (this.instances.get(record.entry.id) !== record || this.closing) {
      throw capabilityError('Workspace instance is no longer active.');
    }
    if (method === 'register') {
      if (!Array.isArray(input.capabilities) || input.capabilities.length > 16 ||
        input.capabilities.some(value => typeof value !== 'string')) {
        throw capabilityError('Invalid capability declaration.');
      }
      record.capabilities = [...new Set(input.capabilities)];
      record.generation = input.generation;
      record.registered = true;
      await this.changed();
      return { id: record.entry.id };
    }
    if (method === 'state') {
      record.entry.state = serializable(input);
      await this.changed();
      return { saved: true };
    }
    if (method === 'request' && record.registered) {
      return this.request(input.capability, input.input, {
        ...options, requester: record.entry.id
      });
    }
    throw capabilityError('Unsupported workspace operation.', 'denied');
  }
  async request(capability, input, { requester = 'launcher', signal } = {}) {
    const providers = [...this.instances.values()].filter(record =>
      record.registered && record.peer && !record.peer.closed &&
      record.capabilities.includes(capability) &&
      this.authorize(requester, record.entry, capability));
    if (providers.length !== 1) {
      throw capabilityError(providers.length ? 'More than one provider is available.' :
        'Open Files through Launcher and allow resource selection.');
    }
    const result = await providers[0].peer.call('capability', {
      capability, input: serializable(input),
      requester: { application: requester, origin: this.target.location.origin }
    }, { signal });
    if (result.error) {
      throw capabilityError(result.error.message, result.error.code);
    }
    return result.result;
  }
  async checkpoint() {
    await Promise.all([...this.instances.values()].map(async record => {
      if (record.registered && record.peer && !record.peer.closed) {
        record.entry.state = serializable(await record.peer.call('checkpoint', null,
          { timeout: 2500 }));
      }
    }));
    await this.changed();
  }
  async allow(id, value) {
    this.instances.get(id).entry.allowBrowse = Boolean(value);
    await this.changed();
  }
  detach(record) {
    record.peer?.close();
    record.peer = null;
    record.win = null;
    record.registered = false;
    record.capabilities = [];
  }
  async remove(id) {
    const record = this.instances.get(id);
    if (!record) {
      return;
    }
    record.win?.close();
    this.detach(record);
    this.instances.delete(id);
    await this.changed();
  }
  closeApps() {
    this.closing = true;
    for (const record of this.instances.values()) {
      record.win?.close();
      this.detach(record);
    }
  }
  dispose() {
    clearInterval(this.timer);
    this.target.removeEventListener('message', this.listener);
    for (const record of this.instances.values()) {
      this.detach(record);
    }
  }
}
