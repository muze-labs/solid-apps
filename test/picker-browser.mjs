import http from 'node:http';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { startChrome, formatBrowserException } from './support/chrome.mjs';

// Static protocol fixtures exercise actual activation/startup modules without
// calling WorkspaceState or writing the deferred JSON-in-Turtle representation.
const dataDirectory = new URL('../packages/solid-app-data/src/', import.meta.url);
const pickerBundle = await rollup({
  input: new URL('../apps/launcher/src/picker.mjs', import.meta.url).pathname,
  plugins: [nodeResolve({ browser: true })]
});
const picker = await pickerBundle.generate({ format: 'es' });
await pickerBundle.close();
let port;
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://fixture.invalid').pathname;
  if (['/capabilities.mjs', '/workspace-broker.mjs'].includes(path)) {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(await readFile(new URL(path.slice(1), dataDirectory)));
    return;
  }
  if (path === '/picker.mjs') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(picker.output[0].code);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  if (path === '/files/') {
    res.end(`<!doctype html><title>Files protocol fixture</title>
      <h1>Files</h1><button id="select">Select resource</button>
      <button id="cancel">Cancel selection</button>
      <script type="module">
        import { ManagedApp, browseCapability } from '/capabilities.mjs';
        window.managed = new ManagedApp({ name: 'Files',
          capabilities: [browseCapability],
          onRequest: event => { window.pending = event; }
        });
        document.querySelector('#select').onclick = () => managed.respond(
          pending.id, { result: { '@id': 'https://pod.example/file.ttl#subject' } }
        );
        document.querySelector('#cancel').onclick = () => managed.respond(
          pending.id, { error: { code: 'cancelled', message: 'Selection cancelled.' } }
        );
      </script>`);
    return;
  }
  res.end(`<!doctype html><title>Launcher protocol fixture</title>
    <h1>Launcher</h1><button id="pick">Choose in Files</button>
    <script type="module">
      import { WorkspaceBroker } from '/workspace-broker.mjs';
      import { chooseFiles } from '/picker.mjs';
      window.broker = new WorkspaceBroker({
        onChange: async () => {}, authorize: (_caller, entry) => entry.allowBrowse
      });
      document.querySelector('#pick').onclick = async () => {
        window.result = null;
        window.failure = null;
        try {
          window.result = await chooseFiles(broker, 'http://localhost:${port}/files/', {
            onWait: message => { window.progress = message; }
          });
        }
        catch (error) {
          window.failure = { code: error.code, message: error.message };
        }
      };
    </script>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
port = server.address().port;
let chrome;
const pages = [];
async function value(page, expression) {
  const result = await page.send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error(formatBrowserException(result.exceptionDetails));
  }
  return result.result.value;
}
async function until(page, expression) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await value(page, expression)) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error('picker-browser: Timed out: ' + expression);
}
async function click(page, selector) {
  await page.send('Page.bringToFront');
  const point = await value(page, `(() => {
    const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', {
      type, button: 'left', clickCount: 1, ...point
    });
  }
}
try {
  chrome = await startChrome('about:blank');
  const control = await chrome.page();
  pages.push(control);
  await control.ready();
  const root = await control.send('Target.createTarget', {
    url: 'http://127.0.0.1:' + port + '/'
  });
  const launcher = await chrome.page(root.targetId);
  pages.push(launcher);
  await launcher.ready();
  await until(launcher, 'Boolean(window.broker)');
  await click(launcher, '#pick');
  let child;
  const fileTargets = async () => (await control.send('Target.getTargets'))
    .targetInfos.filter(target => target.url === 'http://localhost:' + port + '/files/');
  for (let attempt = 0; attempt < 100; attempt++) {
    [child] = await fileTargets();
    if (child) { break; }
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  assert(child, 'Choose in Files must open Files without manual pre-opening.');
  const files = await chrome.page(child.targetId);
  pages.push(files);
  await files.ready();
  await until(files, 'Boolean(window.pending) && document.visibilityState === "visible"');
  assert.equal(await value(launcher, 'document.visibilityState'), 'hidden');
  const firstRequest = await value(files, 'window.pending.id');
  await click(files, '#select');
  await until(launcher, 'Boolean(window.result)');
  const returnedAfterSelection = await value(launcher,
    'document.visibilityState === "visible"');
  assert.equal(returnedAfterSelection, true,
    'Selection activates the existing Launcher tab.');
  assert.equal((await control.send('Target.getTargets')).targetInfos
    .filter(target => target.type === 'page').length, 3,
  'Returning must not create another Launcher or blank tab.');
  assert.equal(await value(launcher, 'window.result["@id"]'),
    'https://pod.example/file.ttl#subject');
  // Verify reuse after the provider's earlier transient activation has expired.
  await new Promise(resolve => setTimeout(resolve, 6100));
  await click(launcher, '#pick');
  await until(files, 'window.pending?.id !== ' + JSON.stringify(firstRequest) +
    ' && document.visibilityState === "visible"');
  assert.equal((await fileTargets()).length, 1, 'Reuse the already-open Files app.');
  assert.equal((await fileTargets())[0].targetId, child.targetId);
  await click(files, '#cancel');
  await until(launcher, 'window.failure?.code === "cancelled"');
  const returnedAfterCancellation = await value(launcher,
    'document.visibilityState === "visible"');
  assert.equal(returnedAfterCancellation, true,
    'Cancellation activates the existing Launcher tab.');
  assert.equal(await value(launcher, 'window.result'), null);
  assert.equal((await fileTargets()).length, 1);
  console.log('PASS: one-click cross-origin Files startup, warm-instance reuse, ' +
    'provider tab activation and selection/cancellation results; ' +
    'no workspace persistence invoked.');
  console.log('Verified return activation:', JSON.stringify({
    returnedAfterSelection, returnedAfterCancellation
  }));
}
catch (error) {
  for (const page of pages) {
    try {
      console.error(await value(page, `JSON.stringify({
        url: location.href, focused: document.hasFocus(),
        visibility: document.visibilityState, result: window.result,
        pending: Boolean(window.pending), progress: window.progress,
        failure: window.failure, childReady: window.managed?.ready,
        instances: window.broker && [...broker.instances.values()].map(record => ({
          registered: record.registered, ready: record.ready,
          restoreError: record.restoreError, url: record.entry.url
        }))
      })`));
    }
    catch {}
  }
  throw error;
}
finally {
  pages.forEach(page => page.close());
  await chrome?.close();
  await new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  });
}
