import { app } from '@muze-labs/simplyflow/app';
import { CapabilityClient } from '@muze-labs/solid-app-data/capabilities.mjs';

export function appServices(host, options = {}) {
  let client = null;
  const view = app({
    container: host.main.querySelector('.capability-connection'),
    data: { url: host.preferences.brokerUrl, message: 'Not connected.',
      connectState: { disabled: null } },
    commands: {
      async connect(form) {
        view.data.connectState = { disabled: '' };
        const key = form.elements.key.value;
        form.reset();
        await host.run(async () => {
          client?.disconnect();
          client = new CapabilityClient(host.preferences.brokerUrl, {
            ...options,
            onState(message) {
              view.data.message = message;
              options.onState?.(message);
            }
          });
          await client.connect(key);
        });
        view.data.connectState = { disabled: null };
      },
      disconnect() {
        client?.disconnect();
      }
    }
  });
  host.onPreferences = values => {
    view.data.url = values.brokerUrl;
    if (client && client.url !== values.brokerUrl) {
      client.disconnect('Broker changed. Connect again.');
    }
  };
  window.addEventListener('pagehide', () => client?.disconnect());
  return {
    get client() {
      if (!client?.connection) {
        throw new Error('app-services: Connect to app services first.');
      }
      return client;
    },
    get connected() {
      return Boolean(client?.connection);
    }
  };
}
