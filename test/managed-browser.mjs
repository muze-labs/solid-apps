import { spawn } from 'node:child_process';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import oldm from '../packages/solid-app-data/src/oldm.mjs';
import { startChrome, freePort, waitForExit,
  formatBrowserException } from './support/chrome.mjs';

const records = new Map();
const puts = [];
let base;
let workspaceETag = '"one"';
let delayPut = 0;
let rejectPut = 0;
const pod = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'ETag,Link');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  const path = new URL(req.url, base).pathname;
  if (req.method === 'PUT') {
    const chunks = [];
    for await (const chunk of req) { chunks.push(chunk); }
    const body = Buffer.concat(chunks).toString();
    if (rejectPut === 'offline') {
      req.socket.destroy();
      return;
    }
    if (rejectPut) {
      res.writeHead(rejectPut).end();
      return;
    }
    if (path !== '/workspace.ttl' ||
      req.headers.authorization !== 'Bearer fixture-workspace-key') {
      res.writeHead(403).end();
      return;
    }
    if (req.headers['if-match'] !== workspaceETag) {
      res.writeHead(412).end();
      return;
    }
    puts.push({ body, authorization: req.headers.authorization,
      condition: req.headers['if-match'] });
    if (delayPut) {
      await new Promise(resolve => setTimeout(resolve, delayPut));
    }
    records.set(path, body);
    workspaceETag = '"' + (puts.length + 1) + '"';
    res.writeHead(204, { ETag: workspaceETag }).end();
    return;
  }
  let body = records.get(path);
  if (path === '/storage/' || path === '/storage/notes/') {
    const child = path === '/storage/' ? base + '/storage/notes/' :
      base + '/storage/notes/note.ttl';
    body = '<' + base + path + '> a <http://www.w3.org/ns/ldp#BasicContainer>; ' +
      '<http://www.w3.org/ns/ldp#contains> <' + child + '>.';
  }
  if (body === undefined) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/turtle',
    ETag: path === '/workspace.ttl' ? workspaceETag : '"fixture"' });
  res.end(req.method === 'HEAD' ? '' : body);
});
await new Promise(resolve => pod.listen(0, '127.0.0.1', resolve));
base = 'http://127.0.0.1:' + pod.address().port;
const webId = base + '/profile#me';
records.set('/profile', '<#me> <http://xmlns.com/foaf/0.1/name> "Workspace tester"; ' +
  '<http://www.w3.org/ns/pim/space#storage> <' + base + '/storage/>; ' +
  '<http://www.w3.org/ns/pim/space#preferencesFile> <' + base + '/prefs>.');
records.set('/prefs', '<#solid-apps> <https://vocab.muze.nl/solid-apps#workspaceResource> <' +
  base + '/workspace.ttl>; <https://vocab.muze.nl/solid-apps#filesRoot> <' +
  base + '/storage/>.');
records.set('/workspace.ttl', '<#other> <https://example.org/unknown> ' +
  '[<https://example.org/label> "preserve me"].');
const appPort = await freePort();
const appBase = 'http://127.0.0.1:' + appPort + '/';
const filesBase = 'http://localhost:' + appPort + '/files/';
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: new URL('../', import.meta.url),
  env: { ...process.env, PORT: String(appPort) }, stdio: 'ignore'
});
let serverClosed = false;
server.once('exit', () => { serverClosed = true; });
for (let i = 0; i < 100; i++) {
  try { if ((await fetch(appBase)).ok) { break; } }
  catch {}
  await new Promise(resolve => setTimeout(resolve, 30));
}
let chrome, control, launcher, files;
const pages = [];
async function evaluate(page, expression) {
  const result = await page.send('Runtime.evaluate', {
    expression: '(async()=>{' + expression + '})()',
    awaitPromise: true, returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(formatBrowserException(result.exceptionDetails));
  }
  return result.result.value;
}
async function wait(page, expression) {
  for (let i = 0; i < 200; i++) {
    if (await evaluate(page, 'return Boolean(' + expression + ');')) { return; }
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error('workspace-browser: Timed out: ' + expression + '\n' +
    await evaluate(page, 'return document.body.innerText;'));
}
async function click(page, selector) {
  await wait(page, 'document.querySelector(' + JSON.stringify(selector) + ')');
  await page.send('Page.bringToFront');
  const point = await evaluate(page, 'const element=document.querySelector(' +
    JSON.stringify(selector) + ');element.scrollIntoView({block:"center"});' +
    'const rect=element.getBoundingClientRect();return {x:rect.x+rect.width/2,' +
    'y:rect.y+rect.height/2};');
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', button: 'left', clickCount: 1, ...point
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', button: 'left', clickCount: 1, ...point
  });
}
async function submit(page, selector, values) {
  await evaluate(page, 'const form=document.querySelector(' + JSON.stringify(selector) +
    ');for(const [key,value] of Object.entries(' + JSON.stringify(values) +
    ')){form.elements[key].value=value;}' +
    'form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));');
}
async function connect(page, app) {
  await click(page, '.account-button');
  await click(page, '[data-simply-command=connectDialog]');
  await submit(page, '.connect-dialog form', { webId });
  await wait(page, 'window.solid' + app + '?.host.session');
}
async function authorizeWorkspace(page) {
  await evaluate(page, 'const session=window.solidLauncher.host.session;' +
    'session.client=session.client.with((request,next)=>{' +
    'const headers=new Headers(request.headers);' +
    'headers.set("Authorization","Bearer fixture-workspace-key");' +
    'return next(request.with({headers}));});');
}
async function newPage(url) {
  const target = await control.send('Target.createTarget', { url });
  const page = await chrome.page(target.targetId);
  pages.push(page);
  await page.ready();
  return { page, id: target.targetId };
}
async function openFiles() {
  const before = new Set((await control.send('Target.getTargets')).targetInfos
    .map(target => target.targetId));
  await click(launcher, '.saved-apps a[href^="' + filesBase + '"]');
  for (let i = 0; i < 100; i++) {
    const target = (await control.send('Target.getTargets')).targetInfos.find(item =>
      item.url.startsWith(filesBase) && !before.has(item.targetId));
    if (target) {
      const page = await chrome.page(target.targetId);
      pages.push(page);
      await page.ready();
      await wait(page, 'window.solidFiles?.host.managed?.peer');
      return { page, id: target.targetId };
    }
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error('workspace-browser: Files did not open.');
}
function readSnapshot() {
  const url = base + '/workspace.ttl';
  const graph = oldm.context().parse(records.get('/workspace.ttl'), url, 'text/turtle');
  const value = graph.get(url + '#workspace')[graph.propertyName(
    'https://vocab.muze.nl/solid-apps#snapshot')];
  return JSON.parse(String(value));
}
try {
  chrome = await startChrome('about:blank', { allowPopups: true });
  control = await chrome.page();
  await control.ready();
  let root = await newPage(appBase + 'launcher/');
  launcher = root.page;
  await wait(launcher, 'window.solidLauncher?.workspace');
  await connect(launcher, 'Launcher');
  await wait(launcher, 'window.solidLauncher.persistence.prepared');
  await authorizeWorkspace(launcher);
  await submit(launcher, '.saved-apps form', { name: 'Managed Files', url: filesBase });
  await wait(launcher, 'document.querySelector(".saved-apps").textContent.includes("Managed Files")');
  let child = await openFiles();
  files = child.page;
  assert.equal(await evaluate(files, 'return Boolean(window.opener);'), true);
  await connect(files, 'Files');
  await wait(files, 'document.querySelector("tbody").textContent.includes("notes")');
  await click(launcher, '.managed-workspace input[type=checkbox]');
  await submit(files, '.file-controls form[data-simply-command=browse]', {
    url: base + '/storage/notes/'
  });
  await wait(files, 'document.querySelector("tbody").textContent.includes("note.ttl")');
  await evaluate(files, 'await window.solidFiles.host.managed.publish();');
  assert.equal(puts.length, 0, 'Live updates must not write the Pod.');
  await click(launcher, '[data-simply-command=pickResource]');
  await wait(files, '!document.querySelector(".picker-request").hidden');
  await click(files, '[data-simply-command=cancelSelection]');
  await wait(launcher, 'document.querySelector(".launch-profile [role=status]").textContent.includes("cancelled")');
  await click(launcher, '[data-simply-command=pickResource]');
  await wait(files, '!document.querySelector(".picker-request").hidden');
  await files.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true
  });
  await fs.mkdir('/tmp/solid-apps-review', { recursive: true });
  const shot = await files.send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile('/tmp/solid-apps-review/managed-picker-mobile.png',
    Buffer.from(shot.data, 'base64'));
  assert(await evaluate(files, 'return document.documentElement.scrollWidth<=innerWidth;'));
  await click(files, '.file-list tbody tr [data-simply-command=selectResource]');
  await wait(launcher, 'document.querySelector(".launch-profile [name=resource]").value===' +
    JSON.stringify(base + '/storage/notes/note.ttl'));
  assert.equal(puts.length, 0);
  await click(launcher, '[data-simply-command=saveWorkspace]');
  await wait(launcher, 'document.querySelector(".managed-workspace [role=status]").textContent.includes("saved to your Solid Pod")');
  assert.equal(readSnapshot().apps[0].state.folder, base + '/storage/notes/');
  assert.match(records.get('/workspace.ttl'), /preserve me/);
  const privateKeys = await evaluate(launcher, 'return window.solidLauncher.workspace.keys();');
  for (const key of Object.values(privateKeys)) {
    assert(!records.get('/workspace.ttl').includes(key));
  }
  await launcher.send('Page.reload');
  await wait(launcher, 'window.solidLauncher?.workspace && ' +
    '[...window.solidLauncher.workspace.instances.values()].some(r=>r.registered)');
  const liveFiles = (await control.send('Target.getTargets')).targetInfos
    .filter(target => target.url.startsWith(filesBase));
  assert.equal(liveFiles.length, 1, 'Launcher reload must reconnect without duplicate apps.');
  await files.send('Page.reload');
  await wait(files, 'window.solidFiles?.host.managed?.peer && ' +
    'document.querySelector("[name=url]").value===' + JSON.stringify(base + '/storage/notes/'));
  await authorizeWorkspace(launcher);
  const second = await openFiles();
  await wait(second.page, 'window.solidFiles?.host.session');
  await wait(launcher, '[...window.solidLauncher.workspace.instances.values()]' +
    '.filter(r=>r.registered).length===2');
  const states = await evaluate(launcher, 'return window.solidLauncher.workspace.snapshot().apps.map(a=>a.state.folder);');
  assert(states.includes(base + '/storage/notes/'));
  assert(states.includes(base + '/storage/'));
  for (const [status, message] of [[412, 'changed elsewhere'], [403, '403'],
    ['offline', 'fetch']]) {
    rejectPut = status;
    await click(launcher, '[data-simply-command=closeWorkspace]');
    await wait(launcher, 'document.querySelector(".suite-status").textContent' +
      '.toLowerCase().includes(' + JSON.stringify(message) + ')');
    assert.equal((await control.send('Target.getTargets')).targetInfos
      .filter(target => target.url.startsWith(filesBase)).length, 2);
    assert.equal(await evaluate(launcher,
      'return window.solidLauncher.persistence.dirty;'), true);
  }
  rejectPut = 0;
  await click(launcher, '[data-simply-command=closeWorkspace]');
  for (let i = 0; i < 150; i++) {
    const targets = (await control.send('Target.getTargets')).targetInfos;
    if (!targets.some(target => target.url.startsWith(filesBase))) { break; }
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  assert.equal(readSnapshot().apps.length, 2);
  assert(!(await control.send('Target.getTargets')).targetInfos
    .some(target => target.url.startsWith(filesBase)));
  await chrome.close();
  chrome = await startChrome('about:blank', { allowPopups: true });
  control = await chrome.page();
  await control.ready();
  root = await newPage(appBase + 'launcher/');
  launcher = root.page;
  await wait(launcher, 'window.solidLauncher?.workspace');
  await connect(launcher, 'Launcher');
  await wait(launcher, 'window.solidLauncher.workspace.instances.size===2');
  await authorizeWorkspace(launcher);
  await click(launcher, '[data-simply-command=restoreWorkspace]');
  let restored = [];
  for (let i = 0; i < 150; i++) {
    restored = (await control.send('Target.getTargets')).targetInfos
      .filter(target => target.url.startsWith(filesBase));
    if (restored.length === 2) { break; }
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  assert.equal(restored.length, 2, 'Fresh browser restores the app set from the Pod.');
  files = await chrome.page(restored[0].targetId);
  pages.push(files);
  await files.ready();
  await connect(files, 'Files');
  await wait(files, 'document.querySelector("tbody").textContent.includes("notes") || ' +
    'document.querySelector("tbody").textContent.includes("note.ttl")');
  await submit(files, '.file-controls form[data-simply-command=browse]', {
    url: base + '/storage/notes/'
  });
  await wait(files, 'document.querySelector("tbody").textContent.includes("note.ttl")');
  await evaluate(files, 'await window.solidFiles.host.managed.publish();');
  await evaluate(launcher, 'window.solidLauncher.workspace.launcherState.closeProbe="latest";' +
    'await window.solidLauncher.workspace.changed();await window.solidLauncher.persistence.work;');
  await wait(launcher, '[...window.solidLauncher.workspace.instances.values()]' +
    '.filter(record=>record.registered).length===2');
  const beforeClose = puts.length;
  delayPut = 200;
  await launcher.send('Page.close');
  for (let i = 0; i < 100 && puts.length === beforeClose; i++) {
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  await new Promise(resolve => setTimeout(resolve, 300));
  const closeWriteReceived = puts.length > beforeClose;
  if (closeWriteReceived) {
    assert.equal(readSnapshot().launcher.closeProbe, 'latest');
  }
  for (let i = 0; i < 150; i++) {
    const targets = (await control.send('Target.getTargets')).targetInfos;
    if (!targets.some(target => target.url.startsWith(filesBase))) { break; }
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  assert(!(await control.send('Target.getTargets')).targetInfos
    .some(target => target.url.startsWith(filesBase)),
  'Managed children should close after their opener closes.');
  const result = { browser: (await control.send('Browser.getVersion')).product,
    explicitPodSave: true, freshBrowserPodRestore: true,
    nativeCloseWriteReceived: closeWriteReceived,
    nativeCloseAuthorized: closeWriteReceived &&
      puts.at(-1).authorization === 'Bearer fixture-workspace-key',
    fixtureAuthentication: true, realSolidOidcNotTested: true };
  await fs.writeFile('/tmp/solid-apps-review/workspace-close-results.json',
    JSON.stringify(result, null, 2));
  console.log('PASS: browser-local routing, reload/reconnect, distinct instances, ' +
    'local-only updates, acknowledged conditional Pod save and fresh-browser restore.');
  console.log('Tab-close experiment:', JSON.stringify(result));
}
catch (error) {
  console.error('Workspace fixture PUTs:', puts.length);
  throw error;
}
finally {
  for (const page of pages) { page.close(); }
  await chrome?.close();
  server.kill('SIGTERM');
  await waitForExit({ process: server, isClosed: () => serverClosed });
  await new Promise(resolve => { pod.close(resolve); pod.closeAllConnections(); });
}
