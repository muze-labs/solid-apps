import { spawn } from 'node:child_process';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { StateGraph, apps } from '../packages/solid-app-data/src/state-rdf.mjs';
import { AppState } from '../packages/solid-app-data/src/app-state.mjs';
import {
  readWorkspace,
  writeWorkspace
} from '../packages/solid-app-data/src/workspace-rdf.mjs';
import {
  startChrome,
  freePort,
  waitForExit,
  formatBrowserException
} from './support/chrome.mjs';

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
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString();
    if (rejectPut === 'offline') {
      req.socket.destroy();
      return;
    }
    if (rejectPut) {
      res.writeHead(rejectPut).end();
      return;
    }
    if (
      path !== '/workspace.ttl' ||
      req.headers.authorization !== 'Bearer fixture-workspace-key'
    ) {
      res.writeHead(403).end();
      return;
    }
    if (req.headers['if-match'] !== workspaceETag) {
      res.writeHead(412).end();
      return;
    }
    puts.push({
      body,
      authorization: req.headers.authorization,
      condition: req.headers['if-match']
    });
    if (delayPut) {
      await new Promise((resolve) => setTimeout(resolve, delayPut));
    }
    records.set(path, body);
    workspaceETag = '"' + (puts.length + 1) + '"';
    // CSS can acknowledge transformed RDF with 205 and no write validator.
    // GET still returns the current representation's ETag.
    res.writeHead(205).end();
    return;
  }
  let body = records.get(path);
  if (path === '/storage/' || path === '/storage/notes/') {
    const child =
      path === '/storage/'
        ? base + '/storage/notes/'
        : base + '/storage/notes/note.ttl';
    body =
      '<' +
      base +
      path +
      '> a <http://www.w3.org/ns/ldp#BasicContainer>; ' +
      '<http://www.w3.org/ns/ldp#contains> <' +
      child +
      '>.';
  }
  if (body === undefined) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/turtle',
    ETag: path === '/workspace.ttl' ? workspaceETag : '"fixture"'
  });
  res.end(req.method === 'HEAD' ? '' : body);
});
await new Promise((resolve) => pod.listen(0, '127.0.0.1', resolve));
base = 'http://127.0.0.1:' + pod.address().port;
const webId = base + '/profile#me';
records.set(
  '/profile',
  '<#me> <http://xmlns.com/foaf/0.1/name> "Workspace tester"; ' +
    '<http://www.w3.org/ns/pim/space#storage> <' +
    base +
    '/storage/>; ' +
    '<http://www.w3.org/ns/pim/space#preferencesFile> <' +
    base +
    '/prefs>.'
);
records.set(
  '/prefs',
  '<#solid-apps> <https://vocab.muze.nl/solid-apps#workspaceResource> <' +
    base +
    '/workspace.ttl>; <https://vocab.muze.nl/solid-apps#filesRoot> <' +
    base +
    '/storage/>.'
);
records.set(
  '/workspace.ttl',
  '<#workspace> <https://vocab.muze.nl/solid-apps#snapshot> ' +
    '"retired pre-release snapshot". <#other> <https://example.org/unknown> ' +
    '[<https://example.org/label> "preserve me"].'
);
const appPort = await freePort();
const appBase = 'http://127.0.0.1:' + appPort + '/';
const filesBase = 'http://localhost:' + appPort + '/files/';
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: new URL('../', import.meta.url),
  env: { ...process.env, PORT: String(appPort) },
  stdio: 'ignore'
});
let serverClosed = false;
server.once('exit', () => {
  serverClosed = true;
});
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(appBase)).ok) {
      break;
    }
  }
  catch {}
  await new Promise((resolve) => setTimeout(resolve, 30));
}
let chrome, control, launcher, files;
const pages = [];
async function evaluate(page, expression) {
  const result = await page.send('Runtime.evaluate', {
    expression: '(async()=>{' + expression + '})()',
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(formatBrowserException(result.exceptionDetails));
  }
  return result.result.value;
}
async function wait(page, expression) {
  for (let i = 0; i < 200; i++) {
    if (await evaluate(page, 'return Boolean(' + expression + ');')) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(
    'workspace-browser: Timed out: ' +
      expression +
      '\n' +
      (await evaluate(page, 'return document.body.innerText;'))
  );
}
async function click(page, selector) {
  await evaluate(
    page,
    `
    for (const dialog of document.querySelectorAll('dialog[open]')) {
      await Promise.all(dialog.getAnimations().map(animation =>
        animation.finished.catch(() => {})));
    }
  `
  );
  await evaluate(
    page,
    'const target=document.querySelector(' +
      JSON.stringify(selector) +
      ');for(let element=target?.parentElement;element;element=element.parentElement){if(element.tagName==="DETAILS" && !element.open){element.querySelector("summary").click();}}'
  );
  const element = 'document.querySelector(' + JSON.stringify(selector) + ')';
  await wait(
    page,
    element +
      ' && !' +
      element +
      '.disabled && ' +
      element +
      '.getClientRects().length'
  );
  await page.send('Page.bringToFront');
  const point = await evaluate(
    page,
    'const element=document.querySelector(' +
      JSON.stringify(selector) +
      ');element.scrollIntoView({block:"center"});' +
      'const rect=element.getBoundingClientRect();return {x:rect.x+rect.width/2,' +
      'y:rect.y+rect.height/2};'
  );
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    button: 'left',
    clickCount: 1,
    ...point
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    button: 'left',
    clickCount: 1,
    ...point
  });
}
async function submit(page, selector, values) {
  await evaluate(
    page,
    'const form=document.querySelector(' +
      JSON.stringify(selector) +
      ');for(const [key,value] of Object.entries(' +
      JSON.stringify(values) +
      ')){form.elements[key].value=value;}' +
      'form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));'
  );
}
async function reload(page) {
  const loaded = page.once('Page.loadEventFired');
  await page.send('Page.reload');
  await loaded;
}
async function changePodWorkspace(resource) {
  const snapshot = readSnapshot();
  snapshot.launcher.resource = resource;
  const url = base + '/workspace.ttl';
  const graph = new StateGraph(records.get('/workspace.ttl'), url);
  writeWorkspace(graph, url + '#workspace', snapshot);
  records.set('/workspace.ttl', graph.write());
  workspaceETag = '"external-' + resource.split('/').pop() + '"';
}
async function connect(page, app) {
  await click(page, '.account-button');
  await click(page, '[data-simply-command=connectDialog]');
  await submit(page, '.connect-dialog form', { webId });
  await wait(page, 'window.solid' + app + '?.host.session');
}
async function authorizeWorkspace(page) {
  await evaluate(
    page,
    'const session=window.solidLauncher.host.session;' +
      'session.client=session.client.with((request,next)=>{' +
      'const headers=new Headers(request.headers);' +
      'headers.set("Authorization","Bearer fixture-workspace-key");' +
      'return next(request.with({headers}));});'
  );
}
async function newPage(url) {
  const target = await control.send('Target.createTarget', { url });
  const page = await chrome.page(target.targetId);
  pages.push(page);
  await page.ready();
  return { page, id: target.targetId };
}
async function openFiles() {
  const before = new Set(
    (await control.send('Target.getTargets')).targetInfos.map(
      (target) => target.targetId
    )
  );
  await click(launcher, '.saved-apps a[href^="' + filesBase + '"]');
  for (let i = 0; i < 100; i++) {
    const target = (await control.send('Target.getTargets')).targetInfos.find(
      (item) => item.url.startsWith(filesBase) && !before.has(item.targetId)
    );
    if (target) {
      const page = await chrome.page(target.targetId);
      pages.push(page);
      await page.ready();
      await wait(page, 'window.solidFiles?.host.managed?.ready');
      return { page, id: target.targetId };
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('workspace-browser: Files did not open.');
}
function readSnapshot() {
  const url = base + '/workspace.ttl';
  return readWorkspace(
    new StateGraph(records.get('/workspace.ttl'), url),
    url + '#workspace'
  );
}
function folderOf(envelope) {
  const state = new AppState();
  state.restore(envelope);
  return state.read(apps + 'folder', 'iri');
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
  await submit(launcher, '.saved-apps form', {
    name: 'Managed Files',
    url: filesBase
  });
  await wait(
    launcher,
    'document.querySelector(".saved-apps").textContent.includes("Managed Files")'
  );
  let child = await openFiles();
  files = child.page;
  assert.equal(await evaluate(files, 'return Boolean(window.opener);'), true);
  await connect(files, 'Files');
  await wait(
    files,
    'document.querySelector("tbody").textContent.includes("notes")'
  );
  await click(launcher, '.managed-workspace input[type=checkbox]');
  await submit(files, '.file-controls form[data-simply-command=browse]', {
    url: base + '/storage/notes/'
  });
  await wait(
    files,
    'document.querySelector("tbody").textContent.includes("note.ttl")'
  );
  await evaluate(files, 'await window.solidFiles.host.managed.publish();');
  assert.equal(puts.length, 0, 'Live updates must not write the Pod.');
  const pickerWindow =
    'document.querySelector(".muze-solid-ui-capability-frame").contentWindow';
  await click(launcher, '[data-simply-command=pickResource]');
  await wait(
    launcher,
    'document.querySelector(".muze-solid-ui-capability-dialog").open && document.querySelector(".muze-solid-ui-capability-loading").hidden && document.querySelector(".muze-solid-ui-capability-frame").getAttribute("aria-busy")==="false"'
  );
  await wait(launcher, pickerWindow + '.solidFiles?.host.managed?.ready');
  await wait(
    launcher,
    pickerWindow + '.document.querySelector(".picker-request").hidden===false'
  );
  assert.equal(
    await evaluate(
      files,
      'return document.querySelector(".picker-request").hidden;'
    ),
    true,
    'An embedded task must not replace the independently open Files view'
  );
  await evaluate(
    launcher,
    pickerWindow +
      '.document.querySelector("[data-simply-command=cancelSelection]").click();'
  );
  await wait(
    launcher,
    '!document.querySelector(".muze-solid-ui-capability-dialog").open && !document.querySelector("[data-simply-command=pickResource]").disabled'
  );
  assert.equal(
    await evaluate(
      launcher,
      'return document.querySelector(".launch-profile [role=status]").textContent;'
    ),
    '',
    'Cancelling selection quietly leaves the caller ready for another request'
  );
  await click(launcher, '[data-simply-command=pickResource]');
  await wait(
    launcher,
    'document.querySelector(".muze-solid-ui-capability-dialog").open && document.querySelector(".muze-solid-ui-capability-loading").hidden && document.querySelector(".muze-solid-ui-capability-frame").getAttribute("aria-busy")==="false"'
  );
  await wait(launcher, pickerWindow + '.solidFiles?.host.managed?.ready');
  await wait(
    launcher,
    pickerWindow + '.document.querySelector(".picker-request").hidden===false'
  );
  await evaluate(
    launcher,
    'const form=' +
      pickerWindow +
      '.document.querySelector(".file-controls form[data-simply-command=browse]");form.elements.url.value=' +
      JSON.stringify(base + '/storage/notes/') +
      ';form.requestSubmit();'
  );
  await wait(
    launcher,
    pickerWindow +
      '.document.querySelector("tbody").textContent.includes("note.ttl")'
  );
  await launcher.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await fs.mkdir('/tmp/solid-apps-review', { recursive: true });
  const shot = await launcher.send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(
    '/tmp/solid-apps-review/managed-picker-mobile.png',
    Buffer.from(shot.data, 'base64')
  );
  assert(
    await evaluate(
      launcher,
      'const provider=' +
        pickerWindow +
        ';const rect=provider.document.querySelector(".picker-request .actions").getBoundingClientRect();return provider.document.documentElement.scrollWidth<=provider.innerWidth && rect.bottom<=provider.innerHeight;'
    )
  );
  await evaluate(
    launcher,
    pickerWindow +
      '.document.querySelector(".file-list tbody tr [data-simply-command=selectResource]").click();'
  );
  await wait(
    launcher,
    'document.querySelector(".launch-profile [name=resource]").value===' +
      JSON.stringify(base + '/storage/notes/note.ttl')
  );
  await launcher.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  assert.equal(puts.length, 0);
  assert.match(records.get('/workspace.ttl'), /retired pre-release snapshot/);
  await click(launcher, '[data-simply-command=saveWorkspace]');
  await wait(
    launcher,
    'document.querySelector(".managed-workspace [role=status]").textContent.includes("saved to your Solid Pod")'
  );
  assert(
    !records.get('/workspace.ttl').includes('retired pre-release snapshot')
  );
  assert.equal(
    folderOf(readSnapshot().apps[0].state),
    base + '/storage/notes/'
  );
  assert.match(records.get('/workspace.ttl'), /preserve me/);
  const privateKeys = await evaluate(
    launcher,
    'return window.solidLauncher.workspace.keys();'
  );
  for (const key of Object.values(privateKeys)) {
    assert(!records.get('/workspace.ttl').includes(key));
  }
  await evaluate(
    files,
    'const managed=window.solidFiles.host.managed;' +
      'const getState=managed.getState;' +
      'managed.getState=async()=>({...await getState(),opaque:"live-only"});' +
      'window.replayedRestore=0;const restore=managed.restoreState;' +
      'managed.restoreState=async state=>{window.replayedRestore++;return restore(state);};' +
      'window.dispatchEvent(new PageTransitionEvent("pagehide",{persisted:true}));' +
      'window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}));'
  );
  await wait(
    launcher,
    '[...window.solidLauncher.workspace.instances.values()]' +
      '.some(record=>record.ready && record.entry.state?.opaque==="live-only")'
  );
  assert.equal(await evaluate(files, 'return window.replayedRestore;'), 0);
  await evaluate(
    files,
    'const managed=window.solidFiles.host.managed;' +
      'window.normalGetState=managed.getState;' +
      'managed.getState=async()=>{await new Promise(resolve=>setTimeout(resolve,3000));' +
      'return window.normalGetState();};'
  );
  const beforeSlowSave = puts.length;
  await click(launcher, '[data-simply-command=saveWorkspace]');
  await wait(
    launcher,
    'document.querySelector("[data-simply-command=saveWorkspace]").disabled'
  );
  await wait(
    launcher,
    '!document.querySelector("[data-simply-command=saveWorkspace]").disabled && ' +
      'document.querySelector(".managed-workspace [role=status]")' +
      '.textContent.includes("saved to your Solid Pod")'
  );
  assert.equal(puts.length, beforeSlowSave + 1);
  await evaluate(
    files,
    'window.solidFiles.host.managed.getState=()=>new Promise(()=>{});'
  );
  await evaluate(
    launcher,
    'window.solidLauncher.workspace.checkpointTimeout=50;'
  );
  const beforeTimeout = puts.length;
  await click(launcher, '[data-simply-command=closeWorkspace]');
  await wait(
    launcher,
    'document.querySelector(".managed-workspace [role=status]")' +
      '.textContent.includes("Managed Files") && ' +
      'document.querySelector(".managed-workspace [role=status]").textContent.includes("timed out")'
  );
  assert.equal(puts.length, beforeTimeout);
  assert(
    (await control.send('Target.getTargets')).targetInfos.some(
      (target) => target.targetId === child.id
    )
  );
  await evaluate(
    files,
    'window.solidFiles.host.managed.getState=window.normalGetState;' +
      'window.dispatchEvent(new PageTransitionEvent("pagehide",{persisted:true}));' +
      'window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}));'
  );
  await wait(
    launcher,
    '[...window.solidLauncher.workspace.instances.values()]' +
      '.some(record=>record.ready)'
  );
  await evaluate(
    launcher,
    'window.solidLauncher.workspace.checkpointTimeout=10000;'
  );
  await click(launcher, '[data-simply-command=saveWorkspace]');
  await wait(
    launcher,
    'document.querySelector(".managed-workspace [role=status]")' +
      '.textContent.includes("saved to your Solid Pod")'
  );
  assert.equal(await evaluate(files, 'return window.replayedRestore;'), 0);
  await reload(launcher);
  await wait(
    launcher,
    'window.solidLauncher?.workspace && ' +
      '[...window.solidLauncher.workspace.instances.values()].some(r=>r.ready)'
  );
  const liveFiles = (
    await control.send('Target.getTargets')
  ).targetInfos.filter((target) => target.url.startsWith(filesBase));
  assert.equal(
    liveFiles.length,
    1,
    'Launcher reload must reconnect without duplicate apps.'
  );
  await reload(files);
  await wait(
    files,
    'window.solidFiles?.host.managed?.ready && ' +
      'document.querySelector("[name=url]").value===' +
      JSON.stringify(base + '/storage/notes/')
  );
  await authorizeWorkspace(launcher);
  const second = await openFiles();
  await wait(second.page, 'window.solidFiles?.host.session');
  await wait(
    launcher,
    '[...window.solidLauncher.workspace.instances.values()]' +
      '.filter(r=>r.ready).length===2'
  );
  const states = (
    await evaluate(
      launcher,
      'return window.solidLauncher.workspace.snapshot().apps.map(a=>a.state);'
    )
  ).map(folderOf);
  assert(states.includes(base + '/storage/notes/'));
  assert(states.includes(base + '/storage/'));
  for (const [status, message] of [
    [403, '403'],
    ['offline', 'fetch']
  ]) {
    rejectPut = status;
    await click(launcher, '[data-simply-command=closeWorkspace]');
    await wait(
      launcher,
      'document.querySelector(".suite-status").textContent' +
        '.toLowerCase().includes(' +
        JSON.stringify(message) +
        ')'
    );
    assert.equal(
      (await control.send('Target.getTargets')).targetInfos.filter((target) =>
        target.url.startsWith(filesBase)
      ).length,
      2
    );
    assert.equal(
      await evaluate(
        launcher,
        'return window.solidLauncher.persistence.dirty;'
      ),
      true
    );
  }
  rejectPut = 0;
  await reload(launcher);
  await wait(launcher, 'window.solidLauncher?.workspace');
  await wait(
    launcher,
    'document.querySelector(".managed-workspace [role=status]")' +
      '.textContent.toLowerCase().includes("fetch")'
  );
  await wait(
    launcher,
    '[...window.solidLauncher.workspace.instances.values()]' +
      '.filter(record=>record.ready).length===2'
  );
  await authorizeWorkspace(launcher);
  await changePodWorkspace(base + '/remote-version');
  await click(launcher, '[data-simply-command=closeWorkspace]');
  await wait(launcher, 'window.solidLauncher.persistence.conflict');
  await reload(launcher);
  await wait(launcher, 'window.solidLauncher?.persistence?.conflict');
  await wait(
    launcher,
    '!document.querySelector("[data-simply-command=reviewConflict]")' +
      '.closest("section").hidden'
  );
  // Conflict restoration finishes independently of the children's handshakes.
  // Checkpoint actions below require both live instances to have reconnected.
  await wait(
    launcher,
    '[...window.solidLauncher.workspace.instances.values()]' +
      '.filter(record=>record.ready).length===2'
  );
  await authorizeWorkspace(launcher);
  await evaluate(
    launcher,
    'window.authOperations=0;' +
      'const session=window.solidLauncher.host.session;' +
      'const original=session.perform.bind(session);' +
      'session.perform=(operation,options)=>{window.authOperations++;' +
      'return original(operation,options);};'
  );
  await click(launcher, '[data-simply-command=closeWorkspace]');
  await wait(
    launcher,
    'document.querySelector(".managed-workspace [role=status]")' +
      '.textContent.includes("Review Pod conflict")'
  );
  assert.equal(await evaluate(launcher, 'return window.authOperations;'), 0);
  await click(launcher, '[data-simply-command=reviewConflict]');
  await wait(
    launcher,
    'document.querySelector("[data-simply-field=podVersion]")' +
      '.textContent.includes("remote-version")'
  );
  await launcher.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await evaluate(
    launcher,
    'document.querySelector(' +
      '"[data-simply-command=reviewConflict]").scrollIntoView({block:"start"});'
  );
  assert(
    await evaluate(
      launcher,
      'return document.documentElement.scrollWidth<=innerWidth;'
    )
  );
  const conflictShot = await launcher.send('Page.captureScreenshot', {
    format: 'png'
  });
  await fs.writeFile(
    '/tmp/solid-apps-review/workspace-conflict-mobile.png',
    Buffer.from(conflictShot.data, 'base64')
  );
  await changePodWorkspace(base + '/newer-version');
  await click(launcher, '[data-simply-command=keepLocalWorkspace]');
  await wait(
    launcher,
    'window.solidLauncher.persistence.conflict && ' +
      '!window.solidLauncher.persistence.reviewedDocument'
  );
  assert.equal(readSnapshot().launcher.resource, base + '/newer-version');
  await click(launcher, '[data-simply-command=reviewConflict]');
  await wait(launcher, 'window.solidLauncher.persistence.reviewedDocument');
  delayPut = 250;
  await click(launcher, '[data-simply-command=keepLocalWorkspace]');
  await wait(
    launcher,
    'document.querySelector("[data-simply-command=closeWorkspace]").disabled'
  );
  await wait(
    launcher,
    'document.querySelector(".managed-workspace [role=status]")' +
      '.textContent.includes("saved to your Solid Pod")'
  );
  delayPut = 0;
  assert.equal(
    readSnapshot().launcher.resource,
    base + '/storage/notes/note.ttl'
  );
  assert.match(records.get('/workspace.ttl'), /preserve me/);
  await changePodWorkspace(base + '/use-pod-version');
  await click(launcher, '[data-simply-command=saveWorkspace]');
  await wait(launcher, 'window.solidLauncher.persistence.conflict');
  await click(launcher, '[data-simply-command=reviewConflict]');
  await wait(launcher, 'window.solidLauncher.persistence.reviewedDocument');
  const beforeUsePod = puts.length;
  await click(launcher, '[data-simply-command=usePodWorkspace]');
  await wait(
    launcher,
    'document.querySelector(".launch-profile [name=resource]")' +
      '.value===' +
      JSON.stringify(base + '/use-pod-version')
  );
  await wait(
    launcher,
    '[...window.solidLauncher.workspace.instances.values()]' +
      '.filter(record=>record.ready).length===2'
  );
  assert.equal(
    puts.length,
    beforeUsePod,
    'Using Pod state must not PUT app data.'
  );
  await click(launcher, '[data-simply-command=closeWorkspace]');
  for (let i = 0; i < 150; i++) {
    const targets = (await control.send('Target.getTargets')).targetInfos;
    if (!targets.some((target) => target.url.startsWith(filesBase))) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  assert.equal(readSnapshot().apps.length, 2);
  assert(
    !(await control.send('Target.getTargets')).targetInfos.some((target) =>
      target.url.startsWith(filesBase)
    )
  );
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
    restored = (await control.send('Target.getTargets')).targetInfos.filter(
      (target) => target.url.startsWith(filesBase)
    );
    if (restored.length === 2) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  assert.equal(
    restored.length,
    2,
    'Fresh browser restores the app set from the Pod.'
  );
  files = await chrome.page(restored[0].targetId);
  pages.push(files);
  await files.ready();
  await connect(files, 'Files');
  await wait(
    files,
    'document.querySelector("tbody").textContent.includes("notes") || ' +
      'document.querySelector("tbody").textContent.includes("note.ttl")'
  );
  await submit(files, '.file-controls form[data-simply-command=browse]', {
    url: base + '/storage/notes/'
  });
  await wait(
    files,
    'document.querySelector("tbody").textContent.includes("note.ttl")'
  );
  await evaluate(files, 'await window.solidFiles.host.managed.publish();');
  await evaluate(
    launcher,
    'window.solidLauncher.workspace.launcherState.resource=' +
      JSON.stringify(base + '/latest-close-probe') +
      ';' +
      'await window.solidLauncher.workspace.changed();await window.solidLauncher.persistence.work;'
  );
  await wait(
    launcher,
    '[...window.solidLauncher.workspace.instances.values()]' +
      '.filter(record=>record.ready).length===2'
  );
  const beforeClose = puts.length;
  delayPut = 200;
  await launcher.send('Page.close');
  for (let i = 0; i < 100 && puts.length === beforeClose; i++) {
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  const closeWriteReceived = puts.length > beforeClose;
  if (closeWriteReceived) {
    assert.equal(
      readSnapshot().launcher.resource,
      base + '/latest-close-probe'
    );
  }
  for (let i = 0; i < 150; i++) {
    const targets = (await control.send('Target.getTargets')).targetInfos;
    if (!targets.some((target) => target.url.startsWith(filesBase))) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  assert(
    !(await control.send('Target.getTargets')).targetInfos.some((target) =>
      target.url.startsWith(filesBase)
    ),
    'Managed children should close after their opener closes.'
  );
  const result = {
    browser: (await control.send('Browser.getVersion')).product,
    explicitPodSave: true,
    freshBrowserPodRestore: true,
    nativeCloseWriteReceived: closeWriteReceived,
    nativeCloseAuthorized:
      closeWriteReceived &&
      puts.at(-1).authorization === 'Bearer fixture-workspace-key',
    fixtureAuthentication: true,
    realSolidOidcNotTested: true
  };
  await fs.writeFile(
    '/tmp/solid-apps-review/workspace-close-results.json',
    JSON.stringify(result, null, 2)
  );
  console.log(
    'PASS: browser-local routing, reload/reconnect, distinct instances, ' +
      'local-only updates, acknowledged conditional Pod save, fresh-browser restore, ' +
      'retained errors and reviewable conditional conflict recovery.'
  );
  console.log('Tab-close experiment:', JSON.stringify(result));
}
catch (error) {
  console.error('Workspace fixture PUTs:', puts.length);
  throw error;
}
finally {
  for (const page of pages) {
    page.close();
  }
  await chrome?.close();
  server.kill('SIGTERM');
  await waitForExit({ process: server, isClosed: () => serverClosed });
  await new Promise((resolve) => {
    pod.close(resolve);
    pod.closeAllConnections();
  });
}
