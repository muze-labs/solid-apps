# Initial capability broker

Experimental, manually provisioned broker for the resource-picker proof. It
routes messages between already-open apps; it does not discover or start them,
store Pod data, or receive Solid access tokens. The
[protocol and authority boundaries](../design/solid-resource-picker.md) describe
the contract and its current limits.

## Local setup

Run the apps with `npm run dev`. For a cross-origin demonstration use Launcher
at `http://127.0.0.1:4174/launcher/` and Files at
`http://localhost:4174/files/`. Connect each app to Solid.

Create a private configuration outside the repository. This example refuses to
overwrite an existing file and prints the generated app keys to your terminal:

```sh
node --input-type=module <<'JS'
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const clients = [
  { application: 'launcher', origin: 'http://127.0.0.1:4174' },
  { application: 'files', origin: 'http://localhost:4174' }
].map(client => ({ ...client, workspace: 'personal',
  key: randomBytes(32).toString('base64url') }));
const routes = [{ workspace: 'personal', requester: 'launcher', provider: 'files',
  capability: 'https://vocab.muze.nl/capabilities/browse' }];
writeFileSync('/tmp/solid-apps-broker.json', JSON.stringify({ clients, routes }),
  { mode: 0o600, flag: 'wx' });
for (const client of clients) {
  console.log(client.application + ': ' + client.key);
}
JS
SOLID_APPS_BROKER_CONFIG=/tmp/solid-apps-broker.json npm run broker
```

Keep this configuration private. Each application/workspace identity and key
must be unique. The initial application names identify provisioned broker
principals; publisher-controlled application descriptions and the provider
registry are future work. A route explicitly permits a requester/provider pair
for a capability, within a workspace. Unlisted relationships cannot communicate.

In Preferences, save **Capability broker URL** as `http://127.0.0.1:4175/`.
Both app origins load this from the same linked Pod preferences. In each app,
expand **App services connection**, enter its own key and connect. The key is
cleared from the input and kept only for the connection attempt; the issued
connection token remains in memory. Reconnect manually after a page reload.

In Launcher, choose **Choose in Files**. In the already-open Files app, select a
file or the current folder, or cancel. Launcher receives only the selected URL
and leaves opening it as a separate user action. Selecting a file's document URL
does not automatically identify an RDF subject within it; append a fragment
where the receiving app needs one.

## Hosting and limits

Node 20.6+ serves HTTP on loopback, using `PORT` (default 4175). For remote use,
put it behind an HTTPS proxy and configure exact public app origins. The proxy
must allow long-poll responses lasting 25 seconds. CORS reflects only configured
origins. Never put connection keys in launch links or shared preferences.

Connections have random scoped bearer tokens and a 60-second inactivity lease.
Requests expire after 60 seconds. Disconnect cancels associated work, and
shutdown rejects new connections. Multiple matching live providers are an
explicit error. Routing and event queues are memory-only and bounded; a restart
loses connections and pending requests. There is no automatic invocation replay.

The broker operator provisions workspace membership. A supplied WebID is not
broker authentication. Files continues to use its own Solid authorization;
broker routing grants no right to read or write the selected resource.

`npm run check` covers protocol/authority contracts without network listeners.
`npm run test:browser` runs the real broker against distinct app origins and a
fixture Pod, including an independent client with every Launcher tab closed.
