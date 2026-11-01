import { readFile } from 'node:fs/promises';
import { CapabilityBroker, brokerServer } from '../broker/server.mjs';
const configPath = process.env.SOLID_APPS_BROKER_CONFIG;
if (!configPath) {
  throw new Error('broker: Set SOLID_APPS_BROKER_CONFIG to a private JSON file.');
}
const broker = new CapabilityBroker(JSON.parse(await readFile(configPath)));
const server = brokerServer(broker);
const port = Number(process.env.PORT || 4175);
server.listen(port, '127.0.0.1', () => {
  console.log('Capability broker: http://127.0.0.1:' + port);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    broker.close();
    server.close();
    server.closeAllConnections();
  });
}
