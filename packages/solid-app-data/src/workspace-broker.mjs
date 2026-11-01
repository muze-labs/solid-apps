import { PortConnection, capabilityError, serializable, restorationState }
  from './capabilities.mjs';

export class WorkspaceBroker {
  constructor({ snapshot = { version: 2, apps: [], launcher: {} }, keys = {},
    onChange = () => {}, onMessage = () => {}, authorize = () => false,
    target = window, checkpointTimeout = 10000 } = {}) {
    Object.assign(this, { onChange, onMessage, authorize, target,
      checkpointTimeout });
    this.focusTarget = 'solid-apps-launcher-' + crypto.randomUUID();
    target.name = this.focusTarget;
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
      registered: false, ready: false, restoreError: '', capabilities: [],
      lastOffer: 0 };
    this.instances.set(entry.id, record);
    return record;
  }
  snapshot() {
    return { ...this.extra, version: 2, launcher: serializable(this.launcherState),
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
    if (record.registered && record.generation === data.generation &&
      !data.reconnect && !record.peer?.closed) {
      return;
    }
    if (!record.registered && Date.now() - record.lastOffer < 1500) {
      return;
    }
    record.win = event.source;
    this.offer(record);
  }
  offer(record) {
    record.peer?.close('Application reconnected.');
    record.registered = false;
    record.ready = false;
    record.restoreError = '';
    const channel = new MessageChannel();
    record.lastOffer = Date.now();
    record.peer = new PortConnection(channel.port1,
      (method, input, options) => this.handle(record, method, input, options));
    record.win.postMessage({ type: 'solid-apps:offer', id: record.entry.id,
      key: record.key, state: record.entry.state, focusTarget: this.focusTarget },
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
      record.managed = true;
      record.canResume = input.restoring === true;
      record.ready = input.restoring !== true;
      await this.changed();
      return { id: record.entry.id };
    }
    if (method === 'ready' && record.registered) {
      record.ready = true;
      record.restoreError = '';
      await this.changed();
      return { ready: true };
    }
    if (method === 'restore-error' && record.registered) {
      record.ready = false;
      record.restoreError = String(input.message).slice(0, 1000);
      await this.changed();
      return { ready: false };
    }
    if (method === 'state') {
      const previous = record.entry.state;
      record.entry.state = restorationState(input);
      try {
        await this.changed();
      }
      catch (error) {
        record.entry.state = previous;
        throw error;
      }
      return { saved: true };
    }
    if (method === 'request' && record.registered) {
      return this.request(input.capability, input.input, {
        ...options, requester: record.entry.id
      });
    }
    throw capabilityError('Unsupported workspace operation.', 'denied');
  }
  whenReady(id, { signal, timeout = 30000 } = {}) {
    const deadline = Date.now() + timeout;
    return new Promise((resolve, reject) => {
      const finish = (error, record) => {
        clearInterval(timer);
        signal?.removeEventListener('abort', cancel);
        if (error) {
          reject(error);
        }
        else {
          resolve(record);
        }
      };
      const cancel = () => finish(capabilityError('Selection cancelled.', 'cancelled'));
      const check = () => {
        const record = this.instances.get(id);
        const label = record?.entry.label || 'Application';
        if (signal?.aborted) {
          cancel();
        }
        else if (!record?.win || record.win.closed) {
          finish(capabilityError(label + ' did not open or was closed. Allow ' +
            'popups or open it through Launcher, then retry.', 'disconnected'));
        }
        else if (record.restoreError) {
          finish(capabilityError(record.restoreError, 'restoring'));
        }
        else if (record.registered && record.ready && record.peer &&
          !record.peer.closed) {
          finish(null, record);
        }
        else if (Date.now() >= deadline) {
          finish(capabilityError(label + ' did not become ready. Check its tab ' +
            'and connection, then retry.', 'timeout'));
        }
      };
      const timer = setInterval(check, 100);
      signal?.addEventListener('abort', cancel, { once: true });
      check();
    });
  }
  async request(capability, input, {
    requester = 'launcher', signal, providerId
  } = {}) {
    const providers = [...this.instances.values()].filter(record =>
      (providerId === undefined || record.entry.id === providerId) &&
      record.registered && record.ready && record.peer && !record.peer.closed &&
      record.capabilities.includes(capability) &&
      this.authorize(requester, record.entry, capability));
    if (providers.length !== 1) {
      throw capabilityError(providers.length ? 'More than one provider is available.' :
        'Open Files through Launcher and allow resource selection.');
    }
    try {
      providers[0].win?.focus();
    }
    catch {}
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
    const previous = new Map([...this.instances.values()].map(record =>
      [record, record.entry.state]));
    const results = await Promise.allSettled(
      [...this.instances.values()].map(async record => {
        const label = record.entry.label
          ? record.entry.label + ' (' + record.entry.url + ')'
          : record.entry.url;
        if (record.registered && !record.ready) {
          const reason = record.restoreError ||
            'App is still restoring. Finish connecting or reload it, then retry.';
          throw new Error('workspace-broker: ' + label + ' is not ready. ' + reason);
        }
        if (record.registered && record.peer && !record.peer.closed) {
          try {
            record.entry.state = restorationState(await record.peer.call(
              'checkpoint', null, { timeout: this.checkpointTimeout }
            ));
          }
          catch (error) {
            if (['timeout', 'disconnected'].includes(error.code)) {
              record.peer.close();
              record.registered = !record.canResume;
              record.ready = false;
              if (!record.canResume) {
                record.restoreError = 'Reload this app to reconnect safely.';
              }
            }
            throw new Error('workspace-broker: Could not collect state from ' +
              label + '. ' + error.message + ' Open that app, then retry.');
          }
        }
        else if (record.win && !record.win.closed &&
          (record.managed || record.entry.state !== null)) {
          throw new Error('workspace-broker: ' + label +
            ' is reconnecting. Open that app, then retry.');
        }
      })
    );
    try {
      await this.changed();
    }
    catch (error) {
      for (const [record, state] of previous) {
        record.entry.state = state;
      }
      throw error;
    }
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) {
      throw new Error(failures.map(result => result.reason.message).join('\n'));
    }
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
    record.ready = false;
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
