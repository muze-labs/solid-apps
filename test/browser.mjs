import { checkStyleOwnership } from './support/style-ownership.mjs';
import { recordVisualStyles } from './support/visual-styles.mjs';
import {
  checkCurrentActions,
  checkRetainedProfileDraft
} from './support/action-dispatch.mjs';
import { checkFeatureSources } from './support/features.mjs';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as path from 'node:path';
import assert from 'node:assert/strict';
import {
  startChrome,
  freePort,
  waitForExit,
  formatBrowserException
} from './support/chrome.mjs';

// The app is exercised through HTTP against an isolated in-memory Pod, never a user's Pod.
const resources = new Map();
let base;
let version = 1;
let profileSaveDelay = 0;
const calls = [];
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,OPTIONS,DELETE');
  res.setHeader('Access-Control-Expose-Headers', 'ETag,Link,Location');
  const url = new URL(req.url, base).href;
  const requestedPath = new URL(url).pathname;
  if (requestedPath === '/presentation-capabilities.mjs') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(
      await fs.readFile(
        new URL(
          '../packages/solid-app-data/src/capabilities.mjs',
          import.meta.url
        )
      )
    );
    return;
  }
  if (requestedPath === '/presentation-provider/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><title>Presentation fixture</title>
      <p>Provider content ready</p>
      <script type="module">
        import { ManagedApp, editProfileCapability } from '/presentation-capabilities.mjs';
        const mode = new URL(location.href).searchParams.get('mode');
        const managed = new ManagedApp({
          name: 'Presentation fixture',
          capabilities: [editProfileCapability],
          waitForPresentation: mode !== 'legacy',
          onRequest: () => parent.postMessage({
            type: 'fixture-presentation-request', id: managed.resume.id
          }, managed.resume.origin)
        });
        addEventListener('message', event => {
          if (event.source !== parent || event.origin !== managed.resume?.origin ||
              event.data?.type !== 'fixture-present') { return; }
          if (event.data.id) {
            parent.postMessage({type:'solid-apps:presentation-ready',id:event.data.id}, managed.resume.origin);
          }
          else { managed.presentationReady(); }
        });
      </script>`);
    return;
  }
  if (requestedPath === '/embedded-profile/') {
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Security-Policy': "frame-ancestors 'none'"
    });
    const html = await fs.readFile(
      new URL('../www/profile/index.html', import.meta.url),
      'utf8'
    );
    res.end(html.replaceAll('../assets/', '/assets/'));
    return;
  }
  if (requestedPath.startsWith('/assets/')) {
    const file = new URL('../www' + requestedPath, import.meta.url);
    try {
      const type = requestedPath.endsWith('.css')
        ? 'text/css'
        : requestedPath.endsWith('.svg')
          ? 'image/svg+xml'
          : 'text/javascript';
      res.writeHead(200, { 'Content-Type': type });
      res.end(await fs.readFile(file));
    }
    catch {
      res.writeHead(404).end();
    }
    return;
  }

  calls.push({ method: req.method, url });
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === 'PUT') {
    if (new URL(url).pathname === '/profile' && profileSaveDelay) {
      await new Promise((resolve) => setTimeout(resolve, profileSaveDelay));
    }
    const existing = resources.get(url);
    if (
      (req.headers['if-none-match'] === '*' && existing) ||
      (req.headers['if-match'] && req.headers['if-match'] !== existing?.etag)
    ) {
      res.writeHead(412);
      res.end();
      return;
    }
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    resources.set(url, {
      body: Buffer.concat(chunks),
      type: req.headers['content-type'],
      etag: '"' + ++version + '"'
    });
    res.writeHead(201, { ETag: resources.get(url).etag });
    res.end();
    return;
  }
  if (req.method === 'DELETE') {
    res.writeHead(500);
    res.end('No destructive request expected');
    return;
  }
  if (new URL(url).pathname === '/server-app') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Server-side app received launch context.');
    return;
  }
  let record = resources.get(url);
  if (url.endsWith('/storage/')) {
    const child = [...resources.keys()].filter(
      (key) =>
        key.startsWith(url) &&
        key !== url &&
        !key.slice(url.length).includes('/') &&
        !key.endsWith('metadata')
    );
    record = {
      body: `@prefix ldp: <http://www.w3.org/ns/ldp#>. <${url}> a ldp:BasicContainer ${child.length ? '; ldp:contains ' + child.map((key) => '<' + key + '>').join(', ') : ''}.`,
      type: 'text/turtle',
      etag: '"folder"'
    };
    res.setHeader('Link', `<${base}/storage/metadata>; rel="describedby"`);
  }
  if (!record) {
    res.writeHead(404);
    res.end('Missing');
    return;
  }
  res.writeHead(record.status || 200, {
    'Content-Type': record.type,
    ETag: record.etag
  });
  res.end(req.method === 'HEAD' ? undefined : record.body);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
base = `http://127.0.0.1:${server.address().port}`;
const webId = base + '/profile#me';
resources.set(base + '/profile', {
  body: `@prefix pim: <http://www.w3.org/ns/pim/space#>. @prefix foaf: <http://xmlns.com/foaf/0.1/>. <#me> a foaf:Person; foaf:name "Remote Person"; pim:storage <${base}/storage/>; pim:preferencesFile <${base}/prefs>; <http://www.w3.org/2006/vcard/ns#hasEmail> <#work-email>, <#unresolved-email>; <http://www.w3.org/ns/solid/terms#oidcIssuer> <${base}/issuer/>. <#work-email> <http://www.w3.org/2006/vcard/ns#value> <mailto:owner@example.org>; <https://example.org/emailMetadata> "keep email metadata". <#other> foaf:name "Keep me".`,
  type: 'text/turtle',
  etag: '"1"'
});
resources.set(base + '/prefs', {
  body:
    '<#other> <https://example.org/setting> "untouched". ' +
    '<#solid-apps> <https://vocab.muze.nl/solid-apps#launcherResource> <' +
    base +
    '/launcher.ttl>; <https://vocab.muze.nl/solid-apps#filesRoot> <' +
    base +
    '/storage/>.',
  type: 'text/turtle',
  etag: '"1"'
});
resources.set(base + '/storage/metadata', {
  body: '<#other> <https://example.org/setting> "untouched".',
  type: 'text/turtle',
  etag: '"1"'
});
resources.set(base + '/storage/test.txt', {
  body: 'file contents',
  type: 'text/plain',
  etag: '"1"'
});
resources.set(base + '/storage/forbidden/', {
  body: 'Access denied',
  type: 'text/plain',
  etag: '"denied"',
  status: 403
});
const launchDocument = base + '/people.ttl?view=all&value=a%2Bb';
const launchResource = launchDocument + '#alice';
const serverAppUrl =
  base +
  '/server-app?view=full&' +
  new URLSearchParams({ resource: launchResource }) +
  '#landing';
const describedAppId = base + '/launcher.ttl#server-app';
resources.set(base + '/launcher.ttl', {
  body:
    '@prefix schema: <https://schema.org/>. ' +
    '@prefix apps: <https://vocab.muze.nl/solid-apps#>. ' +
    '<#server-app> a schema:SoftwareApplication; ' +
    'schema:name "Declared server app"; schema:url <' +
    serverAppUrl +
    '>; ' +
    'apps:launchParameterLocation "query"; ' +
    '<https://example.org/unknown> "preserve app metadata". ' +
    '<#unrelated> <https://example.org/unknown> "preserve other subject".',
  type: 'text/turtle',
  etag: '"launcher-initial"'
});
resources.set(launchDocument, {
  body:
    '<#alice> <http://xmlns.com/foaf/0.1/name> "Launch Alice". ' +
    '<#bob> <http://xmlns.com/foaf/0.1/name> "Other subject". ' +
    '<#alice> <https://example.org/unknown> "preserve me".',
  type: 'text/turtle',
  etag: '"launch"'
});
resources.set(base + '/denied', {
  body: 'Forbidden',
  type: 'text/plain',
  etag: '"denied"',
  status: 403
});
const appPort = await freePort();
const appBase = `http://127.0.0.1:${appPort}/`;
const appServer = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: new URL('../', import.meta.url),
  env: { ...process.env, PORT: String(appPort) },
  stdio: 'ignore'
});
let appServerClosed = false;
appServer.once('exit', () => {
  appServerClosed = true;
});
for (let attempt = 0; attempt < 100; attempt++) {
  try {
    if ((await fetch(appBase)).ok) {
      break;
    }
  }
  catch {}
  if (appServerClosed) {
    throw new Error('browser-test: app server exited.');
  }
  await new Promise((resolve) => setTimeout(resolve, 30));
}
const chrome = await startChrome('about:blank');
let page, otherPage, launchedPage;
try {
  page = await chrome.page();
  await page.ready();
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source:
      'window.confirm=()=>true; window.__fixtureErrors=[]; addEventListener("error",e=>__fixtureErrors.push(e.message)); addEventListener("unhandledrejection",e=>__fixtureErrors.push(String(e.reason?.stack || e.reason)));'
  });
  async function evaluate(expression) {
    const result = await page.send('Runtime.evaluate', {
      expression: `(async()=>{${expression}})()`,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(formatBrowserException(result.exceptionDetails));
    }
    return result.result.value;
  }
  async function wait(expression) {
    for (let i = 0; i < 150; i++) {
      if (await evaluate(`return Boolean(${expression});`)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw new Error(
      'Timed out: ' +
        expression +
        '\n' +
        (await evaluate('return document.body.innerText;'))
    );
  }
  const inspectedFeatures = new Set();
  async function visit(path) {
    const loaded = page.once('Page.loadEventFired');
    const navigation = await page.send('Page.navigate', {
      url: appBase + path
    });
    if (navigation.loaderId) {
      await loaded;
    }
    await page.ready();
    const route = path.split('/')[0];
    const name = route === 'workbench' ? 'launcher' : route;
    const exportedApp = 'window.solid' + name[0].toUpperCase() + name.slice(1);
    await wait(exportedApp);
    await evaluate('await ' + exportedApp + '.host.ready;');
    if (!inspectedFeatures.has(name)) {
      await checkFeatureSources(page, name);
      await checkCurrentActions(page);
      await checkStyleOwnership(page);
      inspectedFeatures.add(name);
    }
    const storageFields = {
      contacts: ['contactsResource'],
      launcher: ['launcherResource', 'workspaceResource'],
      files: ['filesRoot'],
      profile: []
    };
    assert.deepEqual(
      await evaluate(
        'return [...document.querySelectorAll(' +
          '\'.preferences-dialog input[type="url"]\')].map(input=>input.name);'
      ),
      storageFields[name]
    );
    assert.equal(
      await evaluate('return document.querySelector("h1").textContent;'),
      name === 'launcher'
        ? 'Solid Workbench'
        : name[0].toUpperCase() + name.slice(1)
    );
    if (name === 'launcher') {
      assert.equal(await evaluate('return document.title;'), 'Solid Workbench');
    }
    if (name !== 'launcher') {
      assert.deepEqual(
        await evaluate(
          'return [...document.querySelectorAll("a[href]:not(.account-name)")].map(link=>link.getAttribute("href")).filter(href=>/^(?:\\.\\.\\/|\\/)(?:workbench|launcher|contacts|profile|files)(?:\\/|$)/.test(href));'
        ),
        []
      );
    }
  }
  async function reload() {
    const loaded = page.once('Page.loadEventFired');
    await page.send('Page.reload');
    await loaded;
    await page.ready();
  }
  async function click(selector) {
    await page.send('Page.bringToFront');
    await evaluate(`
      for (const dialog of document.querySelectorAll('dialog[open]')) {
        await Promise.all(dialog.getAnimations().map(animation =>
          animation.finished.catch(() => {})));
      }
    `);
    await evaluate(
      'const target=document.querySelector(' +
        JSON.stringify(selector) +
        ');for(let element=target?.parentElement;element;element=element.parentElement){if(element.tagName==="DETAILS" && !element.open){element.querySelector("summary").click();}}'
    );
    await wait(
      `document.querySelector(${JSON.stringify(selector)}) && !document.querySelector(${JSON.stringify(selector)}).disabled && document.querySelector(${JSON.stringify(selector)}).getClientRects().length`
    );
    const position = await evaluate(
      `const element=document.querySelector(${JSON.stringify(selector)});element.scrollIntoView({block:"center"});const rect=element.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};`
    );
    await page.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...position,
      button: 'left',
      clickCount: 1
    });
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...position,
      button: 'left',
      clickCount: 1
    });
  }
  async function account(command) {
    await click('.account-button');
    await wait(
      'document.querySelector("#muze-solid-ui-account-menu").matches(":popover-open")'
    );
    await click(`[data-simply-command=${command}]`);
    await wait(
      '!document.querySelector("#muze-solid-ui-account-menu").matches(":popover-open")'
    );
  }
  async function capture(name) {
    await fs.mkdir('/tmp/solid-apps-review', { recursive: true });
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    await recordVisualStyles(page, name, shot.data);
    await fs.writeFile(
      `/tmp/solid-apps-review/${name}.png`,
      Buffer.from(shot.data, 'base64')
    );
  }
  async function submit(selector, values) {
    await evaluate(
      `const form=document.querySelector(${JSON.stringify(selector)});
      for (const [key,value] of Object.entries(${JSON.stringify(values)})) {
        const input = form.elements.namedItem(key);
        if (input.type === 'checkbox') {
          input.checked = value;
        }
        else {
          input.value = value;
        }
      }
      form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));`
    );
  }
  async function openApp(selector, presentation = 'tab') {
    const launcherWindow = await page.send('Browser.getWindowForTarget');
    const before = await page.send('Target.getTargets');
    const previous = new Set(
      before.targetInfos.map((target) => target.targetId)
    );
    const opened = page.once('Page.windowOpen');
    await click(selector);
    const openedWindow = await opened;
    for (let attempt = 0; attempt < 100; attempt++) {
      const targets = await page.send('Target.getTargets');
      const target = targets.targetInfos.find(
        (candidate) =>
          candidate.type === 'page' &&
          candidate.url === openedWindow.url &&
          !previous.has(candidate.targetId)
      );
      if (target) {
        const appWindow = await page.send('Browser.getWindowForTarget', {
          targetId: target.targetId
        });
        if (presentation === 'window') {
          assert.notEqual(
            appWindow.windowId,
            launcherWindow.windowId,
            'App should open in a separate browser window. ' +
              JSON.stringify({
                openedWindow,
                presentation: await evaluate(
                  'return window.solidLauncher?.workspace?.presentation;'
                )
              })
          );
        }
        else {
          assert.equal(
            appWindow.windowId,
            launcherWindow.windowId,
            'App should open in a new tab in the Launcher browser window.'
          );
        }
        const appPage = await chrome.page(target.targetId);
        await appPage.ready();
        return { target, page: appPage };
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    throw new Error('browser-test: Launch did not create a fresh app target.');
  }
  const resourceFragment = new URLSearchParams({
    resource: launchResource
  }).toString();
  await visit('profile/#' + resourceFragment);
  await wait(
    'document.querySelector(".profile-card h2")?.textContent==="Launch Alice" && ' +
      'document.querySelector(".profile-toolbar [name=url]").value===' +
      JSON.stringify(launchResource)
  );
  assert.equal(
    await evaluate('return window.solidProfile.host.session;'),
    null
  );
  assert.equal(
    await evaluate(
      'return document.querySelector(".profile-toolbar [name=url]").value;'
    ),
    launchResource
  );
  assert.equal(
    await evaluate(
      'return document.querySelector("[data-simply-command=editProfile]").getClientRects().length;'
    ),
    0
  );

  const launchFragment = new URLSearchParams({
    webid: webId,
    resource: launchResource
  }).toString();
  const historySetup = await page.send(
    'Page.addScriptToEvaluateOnNewDocument',
    {
      source:
        'window.initialLaunchHistoryLength=history.length;' +
        'history.replaceState({launchTest:"preserve-state"}, "");'
    }
  );
  await visit('profile/?launch-case=fragment#foo%3Fbar?' + launchFragment);
  await wait(
    'window.solidProfile?.host.session && document.querySelector(".profile-card h2")?.textContent==="Launch Alice"'
  );
  assert.equal(
    await evaluate('return location.href;'),
    appBase + 'profile/?launch-case=fragment#foo%3Fbar'
  );
  assert.deepEqual(await evaluate('return window.solidProfile.host.launch;'), {
    webId,
    resource: launchResource
  });
  assert.deepEqual(await evaluate('return history.state;'), {
    launchTest: 'preserve-state'
  });
  assert(
    await evaluate('return history.length===window.initialLaunchHistoryLength;')
  );
  await page.send('Page.removeScriptToEvaluateOnNewDocument', {
    identifier: historySetup.identifier
  });
  const beforeAnchor = calls.length;
  assert(
    await evaluate(
      'window.launchAnchorMarker=true;location.hash="ordinary%3Fanchor";' +
        'await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));' +
        'return window.launchAnchorMarker===true && ' +
        'window.solidProfile.host.launch.resource===' +
        JSON.stringify(launchResource) +
        ';'
    )
  );
  assert.equal(calls.length, beforeAnchor);

  await visit('profile/#' + launchFragment);
  await wait(
    'window.solidProfile?.host.session && document.querySelector(".profile-card h2")?.textContent==="Launch Alice"'
  );
  assert.equal(
    await evaluate('return window.solidProfile.host.session.webId;'),
    webId
  );
  assert.equal(
    await evaluate('return localStorage.getItem("solid-apps.webId");'),
    null
  );

  for (const fragment of [
    'resource=javascript%3Aalert(1)',
    'foo?resource=javascript%3Aalert(1)',
    'resource=' +
      encodeURIComponent(launchResource) +
      '&resource=' +
      encodeURIComponent(launchResource)
  ]) {
    const before = calls.length;
    await visit('profile/#' + fragment);
    await wait(
      'document.querySelector(".suite-status").textContent.includes("solid-app-data/launch:")'
    );
    assert.equal(calls.length, before);
    assert.equal(await evaluate('return location.hash;'), '#' + fragment);
  }

  for (const [resource, message] of [
    [launchDocument + '#missing', 'not present'],
    [base + '/denied#person', 'Request failed (403)']
  ]) {
    await visit('profile/#' + new URLSearchParams({ resource }));
    await wait(
      'document.querySelector(".suite-status").textContent.includes(' +
        JSON.stringify(message) +
        ')'
    );
  }

  const otherWebId = base + '/other-profile#me';
  await evaluate(
    'localStorage.setItem("solid-apps.webId", ' +
      JSON.stringify(otherWebId) +
      ');'
  );
  const beforeMismatch = calls.length;
  await visit('profile/#' + launchFragment);
  await wait(
    'window.solidProfile && document.querySelector(".suite-status").textContent.includes("WebID / connection")'
  );
  assert.match(
    await evaluate(
      'return document.querySelector(".suite-status").textContent;'
    ),
    /WebID \/ connection/
  );
  assert.equal(calls.length, beforeMismatch);
  assert.equal(
    await evaluate('return localStorage.getItem("solid-apps.webId");'),
    otherWebId
  );
  assert.equal(
    await evaluate('return window.solidProfile.host.session;'),
    null
  );
  await account('connectDialog');
  assert.equal(
    await evaluate(
      'return document.querySelector(".connect-dialog [name=webId]").value;'
    ),
    webId
  );
  await submit('.connect-dialog form', { webId });
  await wait(
    'window.solidProfile.host.session?.webId===' +
      JSON.stringify(webId) +
      ' && document.querySelector(".profile-card h2")?.textContent==="Launch Alice"'
  );
  await evaluate('localStorage.removeItem("solid-apps.webId");');
  assert(
    !calls.some((call) => call.method === 'PUT' || call.method === 'DELETE')
  );

  await visit('contacts/');
  await wait('window.solidContacts?.store');
  await click('.account-button');
  await wait(
    'document.querySelector("#muze-solid-ui-account-menu").matches(":popover-open")'
  );
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27
  });
  await wait(
    '!document.querySelector("#muze-solid-ui-account-menu").matches(":popover-open")'
  );
  await click('.account-button');
  await wait(
    'document.querySelector("#muze-solid-ui-account-menu").matches(":popover-open")'
  );
  await click('h1');
  await wait(
    '!document.querySelector("#muze-solid-ui-account-menu").matches(":popover-open")'
  );
  assert.equal(
    await evaluate(`
      const button = document.querySelector('[data-simply-command=newContact]');
      button.focus(); button.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      const dialog = document.querySelector('.new-contact-dialog');
      const opacity = Number(getComputedStyle(dialog).opacity);
      const scale = new DOMMatrix(getComputedStyle(dialog).transform).a;
      return dialog.open && dialog.matches(':modal') &&
        opacity > 0 && opacity < 1 && scale > 0.7 && scale < 1;
    `),
    true,
    'Dialog opens with the reference fade and scale while remaining modal'
  );
  await evaluate(`
    const dialog = document.querySelector('.new-contact-dialog');
    await Promise.all(dialog.getAnimations().map(animation => animation.finished));
  `);
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27
  });
  assert.equal(
    await evaluate(`
      await new Promise(resolve => setTimeout(resolve, 100));
      const dialog = document.querySelector('.new-contact-dialog');
      const opacity = Number(getComputedStyle(dialog).opacity);
      return dialog.open && dialog.matches(':modal') && opacity > 0 && opacity < 1;
    `),
    true,
    'Escape animates closing before releasing native modality'
  );
  await wait('!document.querySelector(".new-contact-dialog").open');
  assert.equal(
    await evaluate('return document.activeElement.dataset.simplyCommand;'),
    'newContact',
    'Closing restores focus to the dialog invoker'
  );
  await evaluate(`
    document.querySelector('[data-simply-command=newContact]').click();
  `);
  await evaluate(`
    const dialog = document.querySelector('.new-contact-dialog');
    await Promise.all(dialog.getAnimations().map(animation => animation.finished));
    document.querySelector('[data-simply-command=cancelNew]').click();
  `);
  const animationTarget = await page.send('Target.createTarget', {
    url: 'about:blank'
  });
  const animationTab = await chrome.page(animationTarget.targetId);
  await animationTab.ready();
  await animationTab.send('Page.bringToFront');
  await wait('document.visibilityState==="hidden"');
  await wait('!document.querySelector(".new-contact-dialog").open');
  await page.send('Target.closeTarget', { targetId: animationTarget.targetId });
  animationTab.close();
  await page.send('Page.bringToFront');
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  assert.equal(
    await evaluate(`
      document.querySelector('[data-simply-command=newContact]').click();
      const dialog = document.querySelector('.new-contact-dialog');
      const bounds = dialog.getBoundingClientRect();
      return dialog.getAnimations().length === 0 && bounds.x === 0 && bounds.y === 0 &&
        bounds.width === innerWidth && bounds.height === innerHeight;
    `),
    true,
    'Phone dialogs fill the viewport and reduced motion skips animation'
  );
  await click('[data-simply-command=cancelNew]');
  await wait('!document.querySelector(".new-contact-dialog").open');
  await page.send('Emulation.setEmulatedMedia', { features: [] });
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await evaluate(
    'document.querySelector("[data-simply-command=newContact]").click();'
  );
  await submit('.contacts-list form', { name: 'Sparse person' });
  await wait(
    'document.querySelector(".profile-card h2")?.textContent==="Sparse person"'
  );
  await evaluate(
    'document.querySelector("[data-simply-command=editProfile]").click();'
  );
  await evaluate(
    'const input=document.querySelector(".profile-card [name=notes]");' +
      'input.value="Unsaved workspace draft";' +
      'input.dispatchEvent(new Event("input",{bubbles:true}));' +
      'const managed=window.solidContacts.host.managed;' +
      'const state=await managed.getState();' +
      'document.querySelector(".profile-card [data-simply-command=cancelProfile]").click();' +
      'await managed.restoreState(state);'
  );
  await wait(
    '!document.querySelector(".profile-card form").hidden && ' +
      'document.querySelector(".profile-card [name=notes]").value===' +
      '"Unsaved workspace draft"'
  );
  assert(
    !(
      await evaluate(
        'return await window.solidContacts.store.service' +
          '.workspace.graph("contacts").write();'
      )
    ).includes('Unsaved workspace draft')
  );
  await checkRetainedProfileDraft(page);
  await submit('.profile-card form', {
    name: 'Edited contact',
    email: 'first@example.org\nsecond@example.org'
  });
  await wait(
    'document.querySelector(".profile-card h2")?.textContent==="Edited contact" && ' +
      'document.querySelector(".profile-card form").hidden'
  );
  assert.match(
    await evaluate(
      'return document.querySelector(".contact-profile").innerText;'
    ),
    /second@example.org/
  );
  await visit('contacts/');
  await wait('window.solidContacts?.store');
  await capture('contacts-local');
  const localContactId = await evaluate(
    'return window.solidContacts.store.collection.list()[0].id;'
  );
  await visit('profile/?contact=' + encodeURIComponent(localContactId));
  await wait(
    'document.querySelector(".profile-card h2")?.textContent==="Edited contact"'
  );
  await visit('contacts/');
  await wait('window.solidContacts?.store');
  await account('connectDialog');
  assert.equal(
    await evaluate('return document.querySelector(".logout-section").hidden;'),
    true
  );
  await submit('.connect-dialog form', { webId });
  await wait(
    'window.solidContacts.host.session && !document.querySelector(".connect-dialog").open'
  );
  await wait(
    'document.querySelector(".account-name").textContent.trim()==="Remote Person"'
  );
  assert.equal(
    await evaluate(
      'return document.querySelector("#muze-solid-ui-account-menu").textContent.includes(window.solidContacts.host.session.webId);'
    ),
    false
  );
  await account('connectDialog');
  await wait('!document.querySelector(".logout-section").hidden');
  assert.equal(
    await evaluate(
      'return document.querySelector(".connect-dialog [name=webId]").value;'
    ),
    webId
  );
  await click('[data-simply-command=closeConnect]');
  await account('preferences');
  await wait('document.querySelector(".preferences-dialog [name=theme]")');
  await submit('.preferences-dialog form', {
    theme: 'dark',
    textScale: '110',
    language: 'nl',
    contactsResource: base + '/contacts.ttl'
  });
  await wait(
    'document.querySelector(".preferences-dialog .muze-solid-design-toast").textContent.includes("saved")'
  );
  assert.match(String(resources.get(base + '/prefs').body), /untouched/);
  assert.match(String(resources.get(base + '/prefs').body), /launcher\.ttl/);
  assert.match(String(resources.get(base + '/prefs').body), /storage\//);
  await evaluate(
    'document.querySelector(".preferences-dialog [data-simply-command=close]").click();document.querySelector("[data-simply-command=sync]").click();'
  );
  await wait(
    'document.querySelector(".muze-solid-design-toast").textContent.includes("Contacts synchronized")'
  );
  assert.match(
    String(resources.get(base + '/contacts.ttl').body),
    /Edited contact/
  );
  await visit('profile/');
  await wait(
    'window.solidProfile?.host.session && document.body.classList.contains("ds-darkmode")'
  );
  assert.equal(
    await evaluate('return document.documentElement.style.fontSize;'),
    '110%'
  );
  assert.equal(await evaluate('return document.documentElement.lang;'), 'nl');
  await wait(
    'document.querySelector(".account-name").textContent.trim()==="Remote Person"'
  );
  await evaluate(
    'document.querySelector("[data-simply-command=mine]").click();'
  );
  await wait(
    'document.querySelector(".profile-card h2")?.textContent==="Remote Person"'
  );
  await evaluate(
    'document.querySelector("[data-simply-command=editProfile]").click();'
  );
  await wait(
    'document.querySelector(".profile-card [name=email]").value==="owner@example.org"'
  );
  assert.doesNotMatch(
    await evaluate(
      'return document.querySelector(".profile-details").textContent;'
    ),
    /\[object Object\]|unresolved-email/
  );
  await submit('.profile-card form', { name: 'Changed remote profile' });
  await wait(
    'document.querySelector(".profile-card h2")?.textContent==="Changed remote profile"'
  );
  assert.match(String(resources.get(base + '/profile').body), /Keep me/);
  assert.match(
    String(resources.get(base + '/profile').body),
    /unresolved-email/
  );
  assert.match(
    String(resources.get(base + '/profile').body),
    /keep email metadata/
  );

  await capture('profile-desktop');
  assert.equal(
    await evaluate(`
      const button = document.querySelector('.account-name');
      return button.tagName === 'BUTTON' &&
        button.getAttribute('aria-haspopup') === 'dialog' &&
        button.getAttribute('aria-label').includes(button.textContent.trim()) &&
        getComputedStyle(button).textDecorationLine === 'none' &&
        getComputedStyle(button).color === getComputedStyle(button.parentElement).color;
    `),
    true,
    'Account name is a plain, labelled dialog button with inherited text color'
  );
  await evaluate('document.querySelector(".account-name").focus();');
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: ' ',
    code: 'Space',
    windowsVirtualKeyCode: 32
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: ' ',
    code: 'Space',
    windowsVirtualKeyCode: 32
  });
  await wait(
    '!document.querySelector(".muze-solid-ui-capability-dialog a").hidden'
  );
  assert.equal(
    await evaluate(
      'return new URL(document.querySelector(".muze-solid-ui-capability-dialog a").href).hash.includes("resource=");'
    ),
    true
  );
  await click('[data-simply-command=muzeSolidUiCloseCapability]');
  await wait(
    '!document.querySelector(".muze-solid-ui-capability-dialog").open'
  );
  assert.equal(
    await evaluate(
      'return /Selection cancelled|Task cancelled/.test(document.querySelector(".suite-status").textContent);'
    ),
    false,
    'Normal capability cancellation does not produce an error notice'
  );
  assert.equal(
    await evaluate('return document.activeElement.matches(".account-name");'),
    true,
    'Closing the profile dialog returns keyboard focus to its name button'
  );
  await visit('workbench/');
  await page.send('Page.navigate', { url: appBase });
  await wait('location.pathname === "/workbench/" && Boolean(window.solidLauncher)');
  await page.ready();
  assert.equal((await fetch(appBase + 'launcher/')).status, 404,
    'The retired Launcher route has no compatibility entry');
  await wait(
    'window.solidLauncher?.store && document.body.classList.contains("ds-darkmode")'
  );
  // Exercise the real shared host and Profile provider, not a copied editor.
  const profileFrame =
    'document.querySelector(".muze-solid-ui-capability-frame").contentWindow';
  await evaluate(`
    window.presentationMessages = [];
    addEventListener('message', event => {
      if (event.data?.type === 'solid-apps:presentation-ready' &&
          event.source === document.querySelector('.muze-solid-ui-capability-frame').contentWindow) {
        window.presentationMessages.push(event.data.id);
      }
    });
  `);
  await click('.account-name');
  await wait('document.querySelector(".muze-solid-ui-capability-dialog").open');
  await wait(profileFrame + '.solidProfile?.host.managed?.ready');
  await wait(
    profileFrame + '.document.querySelector(".profile-card")?.hidden===false'
  );
  await wait('window.presentationMessages.length > 0');
  await wait(
    'document.querySelector(".muze-solid-ui-capability-loading").hidden'
  );
  assert.equal(
    await evaluate(
      'return getComputedStyle(document.querySelector(".muze-solid-ui-capability-frame")).visibility;'
    ),
    'visible',
    'Profile signals presentation readiness after its initial view is bound'
  );
  assert.equal(
    await evaluate(
      'return ' + profileFrame + '.solidProfile.host.managed.embedded;'
    ),
    true
  );
  assert.equal(
    await evaluate('return ' + profileFrame + '.location.hash;'),
    '',
    'Task launch context is consumed before Metro authorization'
  );
  assert.equal(
    await evaluate(
      'return ' + profileFrame + '.solidProfile.host.launch.webId;'
    ),
    base + '/profile#me',
    'Task retains the launch WebID after consuming the URL'
  );
  assert.equal(
    await evaluate(`
      const provider = ${profileFrame};
      provider.solidProfile.host.message('Connection needs attention');
      return true;
    `),
    true
  );
  await wait(
    profileFrame +
      '.document.querySelector(".suite-status").textContent.includes("Connection needs attention")'
  );
  assert.equal(
    await evaluate(`
      const provider = ${profileFrame};
      const account = provider.document.querySelector('.account');
      const connect = provider.document.querySelector('.muze-solid-ui-task-connect');
      return account.getClientRects().length === 0 &&
        connect.getClientRects().length > 0;
    `),
    true,
    'Tasks hide the preferences dropdown while keeping connection reachable'
  );
  assert.equal(
    await evaluate(`
      const dialog = document.querySelector('.muze-solid-ui-capability-dialog');
      const close = dialog.querySelector('.muze-solid-design-dialog-close');
      const bounds = dialog.getBoundingClientRect();
      const button = close.getBoundingClientRect();
      const style = getComputedStyle(dialog);
      return Math.abs(button.top - bounds.top - parseFloat(style.borderTopWidth)) < 1 &&
        Math.abs(bounds.right - button.right - parseFloat(style.borderRightWidth)) < 1;
    `),
    true,
    'Close button meets the dialog top and right border'
  );
  assert.equal(
    await evaluate(`
      const provider = ${profileFrame};
      const edit = provider.document.querySelector('[data-simply-command=editProfile]');
      const buttonColor = provider.getComputedStyle(edit).backgroundColor;
      const surfaceColor = provider.getComputedStyle(provider.document.body).backgroundColor;
      return Boolean(edit.querySelector('svg use')) &&
        buttonColor !== 'rgba(0, 0, 0, 0)' && buttonColor !== surfaceColor;
    `),
    true,
    'Edit profile has an icon and a distinct button background'
  );
  await evaluate(profileFrame + '.solidProfile.host.message("");');
  await evaluate(
    profileFrame +
      '.document.querySelector("[data-simply-command=editProfile]").click();'
  );
  await wait(
    profileFrame +
      '.document.querySelector(".profile-card form").hidden===false'
  );
  await evaluate(
    'const input=' +
      profileFrame +
      '.document.querySelector(".profile-card [name=name]");input.value="Capability edited profile";input.dispatchEvent(new Event("input",{bubbles:true}));'
  );
  await capture('capability-profile-desktop');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await wait(profileFrame + '.innerWidth < 500');
  assert.equal(
    await evaluate(
      'const provider=' +
        profileFrame +
        ';const footer=provider.document.querySelector(".profile-card form .muze-solid-design-dialog-footer").getBoundingClientRect();return footer.top>=0 && footer.bottom<=provider.innerHeight;'
    ),
    true,
    'Profile actions stay visible on mobile without scrolling the form'
  );
  await capture('capability-profile-mobile');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  profileSaveDelay = 500;
  await evaluate(
    profileFrame +
      '.document.querySelector(".profile-card form").requestSubmit();'
  );
  await click('[data-simply-command=muzeSolidUiCloseCapability]');
  await wait(
    'document.querySelector(".muze-solid-ui-capability-dialog [role=status]").textContent.includes("Wait for the save")'
  );

  await wait(
    '!document.querySelector(".muze-solid-ui-capability-dialog").open'
  );
  assert.equal(
    await evaluate(
      'return /Selection cancelled|Task cancelled/.test(document.querySelector(".suite-status").textContent);'
    ),
    false,
    'Normal capability cancellation does not produce an error notice'
  );
  profileSaveDelay = 0;
  assert(
    String(resources.get(base + '/profile').body).includes(
      'keep email metadata'
    )
  );
  assert(String(resources.get(base + '/profile').body).includes('Keep me'));
  assert.equal(
    await evaluate(
      'return [...solidLauncher.workspace.instances.values()].some(record=>record.embedded);'
    ),
    false
  );

  const profileWrites = calls.filter(
    (call) => call.method === 'PUT' && call.url === base + '/profile'
  ).length;
  await click('.account-name');
  await wait(profileFrame + '.solidProfile?.host.managed?.ready');
  await wait(
    profileFrame + '.document.querySelector(".profile-card")?.hidden===false'
  );
  await evaluate(
    profileFrame +
      '.document.querySelector("[data-simply-command=editProfile]").click();'
  );
  await wait(
    profileFrame +
      '.document.querySelector(".profile-card form").hidden===false'
  );
  await evaluate(
    'const input=' +
      profileFrame +
      '.document.querySelector(".profile-card [name=name]");input.value="Unsaved capability name";input.dispatchEvent(new Event("input",{bubbles:true}));'
  );
  await click('[data-simply-command=muzeSolidUiCloseCapability]');
  await wait(
    '!document.querySelector(".muze-solid-ui-capability-dialog footer").hidden'
  );
  assert.equal(
    await evaluate(
      'return document.querySelector(".muze-solid-ui-capability-dialog").open;'
    ),
    true
  );
  await click('[data-simply-command=muzeSolidUiKeepCapability]');
  assert.equal(
    await evaluate(
      'return ' +
        profileFrame +
        '.document.querySelector(".profile-card [name=name]").value;'
    ),
    'Unsaved capability name'
  );
  await evaluate(
    'solidLauncher.workspace.endEmbedded(solidLauncher.host.view.runtime.muzeSolidUiCall.ticket.id);'
  );
  await wait('solidLauncher.host.view.runtime.muzeSolidUiCall.failed');
  assert.equal(
    await evaluate(
      'return ' +
        profileFrame +
        '.document.querySelector(".profile-card [name=name]").value;'
    ),
    'Unsaved capability name',
    'A routing failure must preserve the provider and its draft until explicit discard'
  );
  await click('[data-simply-command=muzeSolidUiCloseCapability]');
  await wait(
    '!document.querySelector(".muze-solid-ui-capability-dialog footer").hidden'
  );
  await click('[data-simply-command=muzeSolidUiDiscardCapability]');
  await wait(
    '!document.querySelector(".muze-solid-ui-capability-dialog").open'
  );
  assert.equal(
    await evaluate(
      'return /Selection cancelled|Task cancelled/.test(document.querySelector(".suite-status").textContent);'
    ),
    false,
    'Normal capability cancellation does not produce an error notice'
  );
  assert.equal(
    calls.filter(
      (call) => call.method === 'PUT' && call.url === base + '/profile'
    ).length,
    profileWrites
  );

  await click('[data-simply-command=pickResource]');
  await wait(
    'document.querySelector(".muze-solid-ui-capability-loading").hidden && document.querySelector(".muze-solid-ui-capability-frame").getAttribute("aria-busy")==="false"'
  );
  await wait(profileFrame + '.solidFiles?.host.managed?.ready');
  await wait(
    profileFrame + '.document.querySelector(".picker-request")?.hidden===false'
  );
  await wait(profileFrame + '.solidFiles.ui.runtime.current');
  await evaluate(
    profileFrame +
      '.document.querySelector("[data-simply-command=selectFolder]").click();'
  );
  await wait(
    '!document.querySelector(".muze-solid-ui-capability-dialog").open'
  );
  assert.equal(
    await evaluate(
      'return /Selection cancelled|Task cancelled/.test(document.querySelector(".suite-status").textContent);'
    ),
    false,
    'Normal capability cancellation does not produce an error notice'
  );
  assert.equal(
    await evaluate('return solidLauncher.ui.data.resource;'),
    base + '/storage/'
  );
  await evaluate('solidLauncher.ui.actions.setResource("");');

  const profileProvider = await evaluate(
    'return solidLauncher.workspace.embeddedProviders[0].url;'
  );
  await evaluate(`
    window.presentationRequest = null;
    addEventListener('message', event => {
      if (event.data?.type === 'fixture-presentation-request') {
        window.presentationRequest = event.data.id;
      }
    });
  `);
  for (const mode of ['manual', 'reduced', 'legacy', 'missing', 'cancel']) {
    await evaluate(
      'window.presentationRequest=null; solidLauncher.workspace.embeddedProviders[0].url=' +
        JSON.stringify(base + '/presentation-provider/?mode=' + mode) +
        ';'
    );
    await click('.account-name');
    await wait('window.presentationRequest');
    const loadingBounds = await evaluate(`
      const bounds = document.querySelector('.muze-solid-ui-capability-stage').getBoundingClientRect();
      return { width: document.querySelector('.muze-solid-ui-capability-stage').clientWidth,
        height: document.querySelector('.muze-solid-ui-capability-stage').clientHeight };
    `);
    if (mode !== 'legacy') {
      assert.equal(
        await evaluate(`
          const frame = document.querySelector('.muze-solid-ui-capability-frame');
          return !document.querySelector('.muze-solid-ui-capability-loading').hidden &&
            getComputedStyle(frame).visibility === 'hidden' && frame.inert &&
            frame.getAttribute('aria-hidden') === 'true' &&
            frame.getAttribute('aria-busy') === 'true' && frame.getBoundingClientRect().height > 100;
        `),
        true,
        'Loading preserves the frame layout while keeping it inaccessible'
      );
    }
    if (mode === 'manual' || mode === 'reduced') {
      await evaluate(`
        window.postMessage({type:'solid-apps:presentation-ready',id:window.presentationRequest},location.origin);
        document.querySelector('.muze-solid-ui-capability-frame').contentWindow.postMessage(
          {type:'fixture-present',id:'previous-task'}, ${JSON.stringify(base)});
      `);
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(
        await evaluate(
          'return document.querySelector(".muze-solid-ui-capability-loading").hidden;'
        ),
        false,
        'Wrong source and stale task ID cannot reveal the provider'
      );
      await page.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
      });
      assert.equal(
        await evaluate(
          'return getComputedStyle(document.querySelector(".muze-solid-ui-capability-spinner")).animationName;'
        ),
        'none',
        'Loading respects reduced motion'
      );
      await page.send('Emulation.setEmulatedMedia', {
        features:
          mode === 'reduced'
            ? [{ name: 'prefers-reduced-motion', value: 'reduce' }]
            : []
      });
      if (mode === 'manual') {
        await capture('capability-loading');
      }
      await evaluate(`
        document.querySelector('.muze-solid-ui-capability-frame').contentWindow.postMessage(
          {type:'fixture-present'}, ${JSON.stringify(base)});
      `);
      await wait(
        'document.querySelector(".muze-solid-ui-capability-frame").getAttribute("aria-busy")==="false"'
      );
      if (mode === 'manual') {
        assert.equal(
          await evaluate(`
            await new Promise(resolve => setTimeout(resolve, 100));
            const frame = document.querySelector('.muze-solid-ui-capability-frame');
            const loader = document.querySelector('.muze-solid-ui-capability-loading');
            const contentOpacity = Number(getComputedStyle(frame).opacity);
            const loadingOpacity = Number(getComputedStyle(loader).opacity);
            return getComputedStyle(frame).transitionDuration === '0.3s' &&
              !loader.hidden && contentOpacity > 0 && contentOpacity < 1 &&
              loadingOpacity > 0 && loadingOpacity < 1;
          `),
          true,
          'Loading fades out while provider content fades in over 0.3 seconds'
        );
      }
      else {
        await wait(
          'document.querySelector(".muze-solid-ui-capability-loading").hidden'
        );
        assert.equal(
          await evaluate(
            'return getComputedStyle(document.querySelector(".muze-solid-ui-capability-frame")).transitionDuration;'
          ),
          '0s',
          'Reduced motion reveals content without a fade'
        );
      }
    }
    if (mode === 'cancel') {
      await click('[data-simply-command=muzeSolidUiCloseCapability]');
    }
    else {
      const fallbackStart = Date.now();
      await wait(
        'document.querySelector(".muze-solid-ui-capability-loading").hidden'
      );
      if (mode === 'missing') {
        assert(
          Date.now() - fallbackStart >= 4000,
          'A provider promising readiness gets the bounded grace period'
        );
      }
      assert.deepEqual(
        await evaluate(`
          const frame = document.querySelector('.muze-solid-ui-capability-frame');
          const bounds = frame.getBoundingClientRect();
          return { width: frame.clientWidth, height: frame.clientHeight };
        `),
        loadingBounds,
        'Revealing content does not change the frame viewport'
      );
      assert.equal(
        await evaluate(
          `const frame=document.querySelector('.muze-solid-ui-capability-frame');return !frame.inert && !frame.hasAttribute('aria-hidden');`
        ),
        true
      );
      await click('[data-simply-command=muzeSolidUiCloseCapability]');
    }
    await wait(
      '!document.querySelector(".muze-solid-ui-capability-dialog").open'
    );
    await page.send('Emulation.setEmulatedMedia', { features: [] });
  }

  // A real framing refusal must offer a tab that completes the same request.
  await evaluate(
    'solidLauncher.workspace.embeddedProviders[0].url=' +
      JSON.stringify(base + '/embedded-profile/') +
      ';'
  );
  await click('.account-name');
  const framingDeadline = Date.now() + 26000;
  while (
    await evaluate(
      'return document.querySelector(".muze-solid-ui-capability-dialog a").hidden;'
    )
  ) {
    assert(
      Date.now() < framingDeadline,
      'Framing refusal must offer a top-level fallback'
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(
    await evaluate(
      'return document.querySelector(".muze-solid-ui-capability-loading").hidden;'
    ),
    true,
    'A framing failure replaces loading with actionable tab recovery'
  );
  const originalLauncher = page;
  const profileTab = await openApp('.muze-solid-ui-capability-dialog a');
  launchedPage = profileTab.page;
  page = launchedPage;
  await wait('window.solidProfile?.host.managed?.ready');
  await wait('document.querySelector(".profile-card")?.hidden===false');
  assert.equal(
    await evaluate('return solidProfile.host.managed.embedded;'),
    false
  );
  assert.equal(await evaluate('return solidProfile.host.managed.task;'), true);
  await click('[data-simply-command=editProfile]');
  await wait('document.querySelector(".profile-card form").hidden===false');
  await evaluate(
    'document.querySelector(".profile-card form").requestSubmit();'
  );
  page = originalLauncher;
  await wait(
    '!document.querySelector(".muze-solid-ui-capability-dialog").open'
  );
  assert.equal(
    await evaluate(
      'return /Selection cancelled|Task cancelled/.test(document.querySelector(".suite-status").textContent);'
    ),
    false,
    'Normal capability cancellation does not produce an error notice'
  );
  launchedPage.close();
  launchedPage = null;
  await evaluate(
    'solidLauncher.workspace.embeddedProviders[0].url=' +
      JSON.stringify(profileProvider) +
      ';'
  );

  assert.equal(
    await evaluate(
      'return document.querySelectorAll(".app-grid a[href]").length;'
    ),
    3
  );
  await submit('.saved-apps form', {
    name: 'Example app',
    url: 'https://example.org/app'
  });
  await wait(
    'document.querySelector(".saved-apps .person-list").textContent.includes("Example app")'
  );
  await evaluate(
    'document.querySelector("[data-simply-command=sync]").click();'
  );
  await wait(
    'document.querySelector(".muze-solid-design-toast").textContent.includes("Shortcuts synchronized")'
  );
  assert.match(
    String(resources.get(base + '/launcher.ttl').body),
    /Example app/
  );
  await wait(
    'document.querySelector(".account-name").textContent.trim()==="Capability edited profile"'
  );
  await wait(
    'new URLSearchParams(new URL(document.querySelector(".app-grid a[href*=profile]").href).hash.slice(1)).get("webid")===' +
      JSON.stringify(webId)
  );
  const savedLaunchUrl =
    appBase +
    'profile/#foo?' +
    new URLSearchParams({
      webid: otherWebId,
      resource: launchResource
    });
  await submit('.saved-apps form', {
    name: 'Profile launch example',
    url: savedLaunchUrl
  });
  await wait(
    '[...document.querySelectorAll(".saved-apps a")].some(a=>a.textContent==="Profile launch example")'
  );
  const currentLaunch = await evaluate(
    'return [...document.querySelectorAll(".saved-apps a")].find(a=>a.textContent==="Profile launch example").href;'
  );
  const savedFragment = new URL(currentLaunch).hash;
  assert(savedFragment.startsWith('#foo?'));
  const savedParameters = new URLSearchParams(
    savedFragment.slice(savedFragment.indexOf('?') + 1)
  );
  assert.equal(savedParameters.get('webid'), webId);
  assert.equal(savedParameters.get('resource'), launchResource);

  const writesBeforeLaunch = calls.filter(
    (call) => call.method === 'PUT'
  ).length;
  const preferencesBeforeLaunch = String(resources.get(base + '/prefs').body);
  const resourceBeforeLaunch = String(resources.get(launchDocument).body);
  await evaluate(
    'document.querySelector(".launch-profile [name=resource]").value=' +
      JSON.stringify(launchResource) +
      ';'
  );
  const launcherPage = page;
  const profileWindow = await openApp('.launch-profile button');
  const launchTarget = profileWindow.target;
  launchedPage = profileWindow.page;
  page = launchedPage;
  await page.ready();
  await wait(
    'window.solidProfile?.host.session && document.querySelector(".profile-card h2")?.textContent==="Launch Alice"'
  );
  assert.equal(
    await evaluate('return window.solidProfile.host.session.webId;'),
    webId
  );
  assert.equal(
    await evaluate(
      'return new URLSearchParams(location.hash.slice(1)).get("resource");'
    ),
    launchResource
  );
  assert.equal(
    calls.filter((call) => call.method === 'PUT').length,
    writesBeforeLaunch
  );
  assert.equal(
    String(resources.get(base + '/prefs').body),
    preferencesBeforeLaunch
  );
  assert.equal(
    String(resources.get(launchDocument).body),
    resourceBeforeLaunch
  );
  assert.equal(await evaluate('return Boolean(window.opener);'), true);
  assert.equal(
    await launcherPage.evaluate(() => location.pathname),
    '/workbench/'
  );
  assert.equal(
    await launcherPage.evaluate(() => window.solidLauncher.host.session.webId),
    webId
  );
  // A managed child delegates an embedded task through the same Launcher broker.
  await wait('window.solidProfile.host.managed?.ready');
  await click('.account-name');
  await wait(profileFrame + '.solidProfile?.host.managed?.ready');
  await wait(profileFrame + '.solidProfile.ui.runtime.muzeSolidProfileRequest');
  await click('[data-simply-command=muzeSolidUiCloseCapability]');
  await wait(
    '!document.querySelector(".muze-solid-ui-capability-dialog").open'
  );
  assert.equal(
    await evaluate(
      'return /Selection cancelled|Task cancelled/.test(document.querySelector(".suite-status").textContent);'
    ),
    false,
    'Normal capability cancellation does not produce an error notice'
  );
  assert.equal(
    await evaluate(
      'return document.querySelector(".profile-card h2").textContent;'
    ),
    'Launch Alice'
  );
  await capture('profile-launched');
  page.close();
  await launcherPage.send('Target.closeTarget', {
    targetId: launchTarget.targetId
  });
  launchedPage = null;
  page = launcherPage;

  await account('preferences');
  assert.equal(
    await evaluate(
      'return document.querySelector(".preferences-dialog [name=launchTarget]").value;'
    ),
    'tab'
  );
  await submit('.preferences-dialog form', { launchTarget: 'window' });
  await wait(
    'document.querySelector(".preferences-dialog .muze-solid-design-toast").textContent.includes("saved")'
  );
  await click('.preferences-dialog [data-simply-command=close]');
  await reload();
  await wait(
    'window.solidLauncher?.host.session && ' +
      'window.solidLauncher.host.preferences.launchTarget==="window"'
  );
  const contactsWindow = await openApp('.app-grid a[href*=contacts]', 'window');
  contactsWindow.page.close();
  await page.send('Target.closeTarget', {
    targetId: contactsWindow.target.targetId
  });
  await account('preferences');
  assert.equal(
    await evaluate(
      'return document.querySelector(".preferences-dialog [name=launchTarget]").value;'
    ),
    'window'
  );
  await submit('.preferences-dialog form', { launchTarget: 'tab' });
  await wait('window.solidLauncher.host.preferences.launchTarget==="tab"');
  await click('.preferences-dialog [data-simply-command=close]');

  const declaredLink =
    '[...document.querySelectorAll(".saved-apps a")]' +
    '.find(a=>a.textContent==="Declared server app")';
  await wait(declaredLink);
  assert.equal(
    await evaluate(
      'return ' + declaredLink + '.closest("li").querySelector("select").value;'
    ),
    ''
  );
  let declaredUrl = new URL(
    await evaluate('return ' + declaredLink + '.href;')
  );
  assert.equal(declaredUrl.searchParams.get('webid'), webId);
  assert.equal(declaredUrl.searchParams.get('resource'), launchResource);
  assert.equal(declaredUrl.hash, '#landing');

  await evaluate(
    'const select=' +
      declaredLink +
      '.closest("li").querySelector("select");select.value="fragment";' +
      'select.dispatchEvent(new Event("change",{bubbles:true}));'
  );
  await wait('new URL(' + declaredLink + '.href).hash.includes("webid=")');
  assert.equal(
    await evaluate(
      'const node=window.solidLauncher.store.collection.get(' +
        JSON.stringify(describedAppId) +
        ');return String(node[node.graph.propertyName(' +
        JSON.stringify(
          'https://vocab.muze.nl/solid-apps#launchParameterLocation'
        ) +
        ')]);'
    ),
    'query'
  );
  await click('.saved-apps [data-simply-command=sync]');
  await wait(
    'document.querySelector(".muze-solid-design-toast").textContent.includes("Shortcuts synchronized")'
  );
  await visit('workbench/');
  await wait(
    'window.solidLauncher?.host.session && ' +
      declaredLink +
      '?.closest("li").querySelector("select").value==="fragment"'
  );
  declaredUrl = new URL(await evaluate('return ' + declaredLink + '.href;'));
  assert.equal(declaredUrl.searchParams.has('webid'), false);
  assert.equal(declaredUrl.searchParams.has('resource'), false);

  await evaluate(
    'const select=' +
      declaredLink +
      '.closest("li").querySelector("select");select.value="";' +
      'select.dispatchEvent(new Event("change",{bubbles:true}));'
  );
  await wait('new URL(' + declaredLink + '.href).searchParams.has("webid")');
  assert(
    await evaluate(
      'const node=window.solidLauncher.store.collection.get(' +
        JSON.stringify(describedAppId) +
        ');return node[node.graph.propertyName(' +
        JSON.stringify(
          'https://vocab.muze.nl/solid-apps#launchParameterLocationOverride'
        ) +
        ')]===undefined;'
    )
  );
  await click('.saved-apps [data-simply-command=sync]');
  await wait(
    'document.querySelector(".muze-solid-design-toast").textContent.includes("Shortcuts synchronized")'
  );
  assert.match(
    String(resources.get(base + '/launcher.ttl').body),
    /preserve app metadata/
  );
  assert.match(
    String(resources.get(base + '/launcher.ttl').body),
    /preserve other subject/
  );
  await visit('workbench/');
  await wait(
    'window.solidLauncher?.host.session && ' +
      declaredLink +
      '?.closest("li").querySelector("select").value===""'
  );
  await wait('new URL(' + declaredLink + '.href).searchParams.has("webid")');

  await submit('.saved-apps form', {
    name: 'User query app',
    url: serverAppUrl,
    launchMode: 'query'
  });
  await wait(
    '[...document.querySelectorAll(".saved-apps a")].some(a=>a.textContent==="User query app")'
  );
  const userUrl = new URL(
    await evaluate(
      'return [...document.querySelectorAll(".saved-apps a")].find(a=>a.textContent==="User query app").href;'
    )
  );
  assert.equal(userUrl.searchParams.get('webid'), webId);
  assert.equal(userUrl.searchParams.get('resource'), launchResource);

  const serverLauncher = page;
  const serverWindow = await openApp('.saved-apps a[href*="/server-app"]');
  launchedPage = serverWindow.page;
  page = launchedPage;
  await wait('document.body.innerText.includes("Server-side app received")');
  const received = calls.filter(
    (call) => new URL(call.url).pathname === '/server-app'
  );
  assert.equal(received.length, 1);
  const requestUrl = new URL(received[0].url);
  assert.equal(requestUrl.searchParams.get('webid'), webId);
  assert.equal(requestUrl.searchParams.get('resource'), launchResource);
  assert.equal(requestUrl.searchParams.get('view'), 'full');
  assert.equal(requestUrl.hash, '');
  assert.equal(await evaluate('return location.hash;'), '#landing');
  page.close();
  await serverLauncher.send('Target.closeTarget', {
    targetId: serverWindow.target.targetId
  });
  launchedPage = null;
  page = serverLauncher;

  await submit('.saved-apps form', {
    name: 'Anonymous query app',
    url: serverAppUrl,
    launchMode: 'query',
    anonymous: true
  });
  const anonymousLink =
    '[...document.querySelectorAll(".saved-apps a")]' +
    '.find(a=>a.textContent==="Anonymous query app")';
  await wait(anonymousLink + '?.closest("li").querySelector("input").checked');
  assert.equal(
    new URL(
      await evaluate('return ' + anonymousLink + '.href;')
    ).searchParams.has('webid'),
    false
  );

  await evaluate(
    'const input=' +
      anonymousLink +
      '.closest("li").querySelector("input");input.checked=false;' +
      'input.dispatchEvent(new Event("change",{bubbles:true}));'
  );
  await wait('new URL(' + anonymousLink + '.href).searchParams.has("webid")');
  await click('.saved-apps [data-simply-command=sync]');
  await wait(
    'document.querySelector(".muze-solid-design-toast").textContent.includes("Shortcuts synchronized")'
  );
  await visit('workbench/');
  await wait(
    'window.solidLauncher?.host.session && ' +
      anonymousLink +
      ' && !' +
      anonymousLink +
      '.closest("li").querySelector("input").checked'
  );
  await evaluate(
    'const input=' +
      anonymousLink +
      '.closest("li").querySelector("input");input.checked=true;' +
      'input.dispatchEvent(new Event("change",{bubbles:true}));'
  );
  await wait(
    '!' + 'new URL(' + anonymousLink + '.href).searchParams.has("webid")'
  );
  await click('.saved-apps [data-simply-command=sync]');
  await wait(
    'document.querySelector(".muze-solid-design-toast").textContent.includes("Shortcuts synchronized")'
  );
  await visit('workbench/');
  await wait(
    'window.solidLauncher?.host.session && ' +
      anonymousLink +
      '?.closest("li").querySelector("input").checked'
  );
  const identifiedLink =
    '[...document.querySelectorAll(".saved-apps a")]' +
    '.find(a=>a.textContent==="User query app")';
  assert.equal(
    new URL(
      await evaluate('return ' + identifiedLink + '.href;')
    ).searchParams.get('webid'),
    webId
  );
  const anonymousLauncher = page;
  const anonymousWindow = await openApp(
    '.saved-apps a[href*="/server-app"]:not([href*="webid="])'
  );
  launchedPage = anonymousWindow.page;
  page = launchedPage;
  await wait('document.body.innerText.includes("Server-side app received")');
  const anonymousRequest = new URL(
    calls
      .filter((call) => new URL(call.url).pathname === '/server-app')
      .at(-1).url
  );
  assert.equal(anonymousRequest.searchParams.has('webid'), false);
  assert.equal(anonymousRequest.searchParams.get('resource'), launchResource);
  page.close();
  await anonymousLauncher.send('Target.closeTarget', {
    targetId: anonymousWindow.target.targetId
  });
  launchedPage = null;
  page = anonymousLauncher;

  const anonymousBase = base + '/server-app?view=plain#landing';
  await submit('.saved-apps form', {
    name: 'Anonymous no resource',
    url: anonymousBase,
    launchMode: 'query',
    anonymous: true
  });
  const bareSelector = '.saved-apps a[href*="view=plain"]';
  await wait('document.querySelector(' + JSON.stringify(bareSelector) + ')');
  const bareWindow = await openApp(bareSelector);
  launchedPage = bareWindow.page;
  page = launchedPage;
  await wait('document.body.innerText.includes("Server-side app received")');
  const bareRequest = new URL(
    calls
      .filter((call) => new URL(call.url).pathname === '/server-app')
      .at(-1).url
  );
  assert.equal(bareRequest.searchParams.has('webid'), false);
  assert.equal(bareRequest.searchParams.has('resource'), false);
  page.close();
  await anonymousLauncher.send('Target.closeTarget', {
    targetId: bareWindow.target.targetId
  });
  launchedPage = null;
  page = anonymousLauncher;
  await capture('launcher-desktop');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await evaluate(
    'document.querySelector(".saved-apps").scrollIntoView({block:"start"});'
  );
  assert(
    await evaluate('return document.documentElement.scrollWidth<=innerWidth;')
  );
  await capture('launcher-mobile');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await visit('files/');
  await wait(
    'document.querySelector("tbody").textContent.includes("test.txt")'
  );
  await evaluate(
    'document.querySelector("[data-simply-command=remove]").click();'
  );
  await wait(
    'document.querySelector(".muze-solid-design-toast").textContent.includes("Marked deleted")'
  );
  assert(
    !(await evaluate(
      'return document.querySelector("tbody").textContent.includes("test.txt");'
    ))
  );
  assert.equal(resources.get(base + '/storage/test.txt').body, 'file contents');
  assert.match(
    String(resources.get(base + '/storage/metadata').body),
    /deleted/
  );
  assert(!calls.some((call) => call.method === 'DELETE'));
  await evaluate(
    `const input=document.querySelector('input[type=file]');const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array([0,255,7,128])],'bytes.bin',{type:'application/octet-stream'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));`
  );
  await wait(
    'document.querySelector(".muze-solid-design-toast").textContent.includes("1 files uploaded")'
  );
  assert.deepEqual(
    [...resources.get(base + '/storage/bytes.bin').body],
    [0, 255, 7, 128]
  );
  await capture('files-desktop');
  await visit('contacts/');
  await wait('window.solidContacts?.store');
  await wait('document.querySelector(".person-list button")');
  await evaluate('document.querySelector(".person-list button").click();');
  await wait('!document.querySelector(".contact-actions .actions").hidden');
  await evaluate('document.querySelector(".contact-actions button").click();');
  await wait(
    'document.querySelector(".contacts-list .empty").textContent.includes("No contacts")'
  );
  await evaluate(
    'document.querySelector("[data-simply-command=newContact]").click();'
  );
  await submit('.contacts-list form', {
    name: '<img src=x onerror="window.injected=true">'
  });
  await wait(
    'document.querySelector(".profile-card h2").textContent.includes("<img")'
  );
  assert.equal(
    await evaluate(
      'return Boolean(window.injected || document.querySelector(".profile-card img, .person-list img"));'
    ),
    false
  );
  await evaluate(
    'document.querySelector("[data-simply-command=editProfile]").click();'
  );
  await submit('.profile-card form', {
    name: 'Robin de Vries',
    email: 'robin@example.org',
    phone: '+31205550123',
    website: 'https://example.org/',
    notes: 'Met at the Solid meetup.'
  });
  await wait(
    'document.querySelector(".profile-card h2").textContent==="Robin de Vries"'
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await fs.mkdir('/tmp/solid-apps-review', { recursive: true });
  const desktop = await page.send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(
    '/tmp/solid-apps-review/contacts-desktop.png',
    Buffer.from(desktop.data, 'base64')
  );
  await wait('!document.querySelector("dialog:modal")');
  await evaluate(`window.solidContacts.host.view.actions.muzeSolidDesignHideToast();`);
  await wait('document.querySelector(".muze-solid-design-toast").hidden');
  await evaluate(`
    document.querySelector('.contact-search input').focus();
    window.solidContacts.host.message('Persistent recovery guidance');
    window.solidContacts.host.notify('Contact changes saved.');
  `);
  await wait(
    'document.querySelector(".muze-solid-design-toast").hidden===false'
  );
  assert.equal(await evaluate(`
    const toast = document.querySelector('.muze-solid-design-toast');
    const style = getComputedStyle(toast);
    return parseFloat(style.opacity) < 1 &&
      new DOMMatrixReadOnly(style.transform).m42 > 0 &&
      toast.getAnimations().some(animation => animation.playState === 'running');
  `), true, 'Toast enters from below with a fade');
  assert.equal(
    await evaluate(`
      const region = document.querySelector('.muze-solid-design-toasts');
      return region.getAttribute('role') === 'status' &&
        region.getAttribute('aria-live') === 'polite' &&
        document.activeElement.matches('.contact-search input') &&
        document.querySelector('.suite-status').textContent === 'Persistent recovery guidance';
    `),
    true,
    'Toast announces politely without stealing focus or replacing recovery guidance'
  );
  await capture('contacts-toast');
  await evaluate(
    `document.querySelector('.muze-solid-design-toast button').focus();`
  );
  await new Promise((resolve) => setTimeout(resolve, 8200));
  assert.equal(
    await evaluate(
      'return document.querySelector(".muze-solid-design-toast").hidden;'
    ),
    false,
    'A focused toast does not disappear on its timer'
  );
  await click('.muze-solid-design-toast button');
  await wait('document.querySelector(".muze-solid-design-toast").hasAttribute("data-muze-solid-design-toast-closing")');
  assert.equal(await evaluate(`
    const toast = document.querySelector('.muze-solid-design-toast');
    return !toast.hidden && toast.inert &&
      toast.textContent.includes('Contact changes saved.') &&
      toast.getAnimations().some(animation => animation.playState === 'running');
  `), true, 'Dismissal animates before removing the notification');
  await wait('document.querySelector(".muze-solid-design-toast").hidden');
  assert.equal(
    await evaluate(
      'return document.activeElement.matches(".contact-search input");'
    ),
    true,
    'Dismissing a keyboard-focused toast restores the previous focus'
  );
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: 10,
    y: 100
  });
  await evaluate(
    `window.solidContacts.host.notify('Nonessential confirmation');`
  );
  await wait(
    'document.querySelector(".muze-solid-design-toast").hidden===false'
  );
  await new Promise((resolve) => setTimeout(resolve, 8200));
  await wait('document.querySelector(".muze-solid-design-toast").hidden');
  await evaluate(`window.solidContacts.host.notify('First notification');`);
  await wait('!document.querySelector(".muze-solid-design-toast").hidden');
  await evaluate(`window.solidContacts.host.view.actions.muzeSolidDesignHideToast();`);
  await wait('document.querySelector(".muze-solid-design-toast").hasAttribute("data-muze-solid-design-toast-closing")');
  await evaluate(`window.solidContacts.host.notify('Replacement notification');`);
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(await evaluate(`
    const toast = document.querySelector('.muze-solid-design-toast');
    return !toast.hidden && !toast.inert &&
      toast.textContent.includes('Replacement notification');
  `), true, 'A replacement survives an earlier notification exit');
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });
  await evaluate(`window.solidContacts.host.view.actions.muzeSolidDesignHideToast();`);
  await wait('document.querySelector(".muze-solid-design-toast").hidden');
  await evaluate(`window.solidContacts.host.notify('Reduced motion notification');`);
  await wait('!document.querySelector(".muze-solid-design-toast").hidden');
  assert.equal(await evaluate(`
    return document.querySelector('.muze-solid-design-toast').getAnimations().length;
  `), 0, 'Reduced motion skips toast animation');
  await evaluate(`window.solidContacts.host.view.actions.muzeSolidDesignHideToast();`);
  await wait('document.querySelector(".muze-solid-design-toast").hidden');
  await page.send('Emulation.setEmulatedMedia', { features: [] });
  await evaluate(`window.solidContacts.host.message('');`);
  await click('.account-button');
  await wait(
    'document.querySelector("#muze-solid-ui-account-menu").matches(":popover-open")'
  );
  assert.equal(
    await evaluate(`
      const menu = document.querySelector('#muze-solid-ui-account-menu');
      return !menu.contains(document.activeElement) &&
        [...menu.querySelectorAll('button')].every(item =>
          getComputedStyle(item).backgroundColor === 'rgba(0, 0, 0, 0)');
    `),
    true,
    'Pointer opening does not select or highlight the first row'
  );
  await evaluate('document.querySelector(".account-button").focus();');
  async function menuArrow(key) {
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      code: key
    });
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code: key
    });
  }
  await menuArrow('ArrowDown');
  assert.equal(
    await evaluate('return document.activeElement.dataset.simplyCommand;'),
    'connectDialog'
  );
  await menuArrow('ArrowDown');
  assert.equal(
    await evaluate('return document.activeElement.dataset.simplyCommand;'),
    'preferences'
  );
  await menuArrow('ArrowDown');
  assert.equal(
    await evaluate('return document.activeElement.dataset.simplyCommand;'),
    'connectDialog',
    'Arrow Down wraps to the first row'
  );
  await menuArrow('ArrowUp');
  assert.equal(
    await evaluate('return document.activeElement.dataset.simplyCommand;'),
    'preferences',
    'Arrow Up wraps to the last row'
  );
  await menuArrow('ArrowDown');
  assert.equal(
    await evaluate(`
      const item = document.activeElement;
      return item.matches(':focus-visible') &&
        getComputedStyle(item).backgroundColor !== 'rgba(0, 0, 0, 0)';
    `),
    true,
    'Arrow navigation provides a visible keyboard highlight'
  );
  await capture('contacts-muze-solid-ui-account-menu');
  const preferencesPoint = await evaluate(`
    const item = document.querySelector('#muze-solid-ui-account-menu [data-simply-command=preferences]');
    const bounds = item.getBoundingClientRect();
    return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  `);
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    ...preferencesPoint
  });
  assert.equal(
    await evaluate(`
      const menu = document.querySelector('#muze-solid-ui-account-menu');
      const [first, second] = menu.querySelectorAll('button');
      return getComputedStyle(first).backgroundColor === 'rgba(0, 0, 0, 0)' &&
        getComputedStyle(second).backgroundColor !== 'rgba(0, 0, 0, 0)';
    `),
    true,
    'Hover highlights only Preferences even while the first row retains focus'
  );
  assert.equal(
    await evaluate(`
      const menu = document.querySelector('#muze-solid-ui-account-menu');
      const bounds = menu.getBoundingClientRect();
      const rows = [...menu.querySelectorAll('button')].map(item => item.getBoundingClientRect());
      return rows.every(row => Math.abs(row.left - bounds.left) < 1 &&
        Math.abs(row.right - bounds.right) < 1) &&
        Math.abs(rows[0].top - bounds.top) < 1 &&
        Math.abs(rows[0].bottom - rows[1].top) < 1 &&
        Math.abs(rows[1].bottom - bounds.bottom) < 1;
    `),
    true,
    'Menu rows meet each other and all popover edges without gaps'
  );
  await capture('contacts-menu-hover');
  await click('[data-simply-command=preferences]');
  assert.equal(
    await evaluate(`
      return ['.account-button', '.preferences-dialog .muze-solid-design-dialog-close'].every(selector => {
        const button = document.querySelector(selector).getBoundingClientRect();
        const icon = document.querySelector(selector + ' svg').getBoundingClientRect();
        return Math.abs((icon.top + icon.bottom) / 2 - (button.top + button.bottom) / 2) < 1;
      });
    `),
    true,
    'User and dialog close icons are vertically centered in their buttons'
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  const mobile = await page.send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(
    '/tmp/solid-apps-review/preferences-mobile.png',
    Buffer.from(mobile.data, 'base64')
  );
  assert(
    await evaluate(
      'return document.documentElement.scrollWidth<=document.documentElement.clientWidth;'
    )
  );
  assert(
    await evaluate(
      'const dialog=document.querySelector(' +
        '".preferences-dialog");return dialog.scrollWidth<=dialog.clientWidth;'
    )
  );
  await evaluate(
    'document.querySelector(' +
      '".preferences-dialog [name=contactsResource]")' +
      '.scrollIntoView({block:"center"});'
  );
  await capture('preferences-storage-mobile');
  await click('.preferences-dialog [data-simply-command=close]');
  await wait('!document.querySelector(".preferences-dialog").open');
  assert.equal(
    await evaluate(
      'const pane=document.querySelector(".contacts-list");const layout=document.querySelector(".split-view");return pane.clientWidth<=layout.clientWidth && [...pane.querySelectorAll(".contacts-toolbar button")].every(button=>button.getBoundingClientRect().right<=innerWidth);'
    ),
    true,
    'All mobile Contacts toolbar actions must fit in the visible pane'
  );
  assert.equal(
    await evaluate(
      'const range=document.createRange();range.selectNodeContents(document.querySelector("h1"));return range.getBoundingClientRect().right<=document.querySelector(".account-name").getBoundingClientRect().left;'
    ),
    true,
    'The account name must not overlap the mobile app title'
  );
  await capture('contacts-mobile');
  assert(
    await evaluate(
      'return document.documentElement.scrollWidth<=document.documentElement.clientWidth;'
    )
  );
  await account('preferences');
  await submit('.preferences-dialog form', { theme: 'light' });
  await wait('document.body.classList.contains("ds-lightmode")');
  await click('.preferences-dialog [data-simply-command=close]');
  await wait('!document.querySelector(".preferences-dialog").open');
  await capture('contacts-mobile-light');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await capture('contacts-desktop-light');
  const tombstone = await evaluate(
    'return await window.solidContacts.store.service.workspace.graph("contacts").write();'
  );
  assert.match(tombstone, /deleted/);
  const otherTarget = await page.send('Target.createTarget', {
    url: appBase + 'workbench/'
  });
  otherPage = await chrome.page(otherTarget.targetId);
  await otherPage.ready();
  assert(
    await otherPage.evaluate(async () => {
      for (let attempt = 0; attempt < 150; attempt++) {
        if (
          window.solidLauncher?.host.session &&
          document.body.classList.contains('ds-lightmode')
        ) {
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      return false;
    })
  );
  const beforeLogout = calls.length;
  await account('connectDialog');
  await wait('!document.querySelector(".logout-section").hidden');
  const reloaded = page.once('Page.loadEventFired');
  const otherReloaded = otherPage.once('Page.loadEventFired');
  await click('[data-simply-command=logout]');
  await Promise.all([reloaded, otherReloaded]);
  await page.ready();
  await otherPage.ready();
  await wait(
    'window.solidContacts?.store && !window.solidContacts.host.session'
  );
  assert.equal(
    await otherPage.evaluate(() => window.solidLauncher.host.session),
    null
  );
  assert.equal(
    await evaluate(
      'return document.querySelector(".account-name").textContent.trim();'
    ),
    ''
  );
  await wait(
    'document.querySelector(".person-list").textContent.includes("Robin de Vries")'
  );
  await account('connectDialog');
  assert.equal(
    await evaluate('return document.querySelector(".logout-section").hidden;'),
    true
  );
  assert.equal(
    await evaluate(
      'return document.querySelector(".connect-dialog [name=webId]").value;'
    ),
    ''
  );
  await click('[data-simply-command=closeConnect]');
  await click('[data-simply-command=sync]');
  await wait(
    'document.querySelector(".suite-status").textContent.includes("Connect to Solid first")'
  );
  assert.equal(calls.length, beforeLogout);
  await visit('workbench/');
  await wait(
    'window.solidLauncher?.store && [...document.querySelectorAll(".saved-apps a")].some(a=>a.textContent==="Profile launch example")'
  );
  assert.equal(
    await evaluate(
      'return [...document.querySelectorAll(".saved-apps a")].find(a=>a.textContent==="Profile launch example").hasAttribute("href");'
    ),
    false
  );
  assert.equal(
    await evaluate(
      'return [...document.querySelectorAll(".saved-apps a")].find(a=>a.textContent==="Example app").href;'
    ),
    'https://example.org/app'
  );
  assert.equal(
    new URL(
      await evaluate('return ' + anonymousLink + '.href;')
    ).searchParams.has('webid'),
    false
  );
  await evaluate(
    'const form=document.querySelector(".launch-profile form");' +
      'form.elements.resource.value="";form.elements.anonymous.checked=true;'
  );
  const loggedOutLauncher = page;
  const bareProfile = await openApp('.launch-profile button');
  launchedPage = bareProfile.page;
  page = launchedPage;
  await wait('window.solidProfile');
  assert.equal(await evaluate('return location.hash;'), '');
  assert.equal(
    await evaluate('return window.solidProfile.host.session;'),
    null
  );
  page.close();
  await loggedOutLauncher.send('Target.closeTarget', {
    targetId: bareProfile.target.targetId
  });
  launchedPage = null;
  page = loggedOutLauncher;

  console.log(
    'PASS: all four apps, shared profiles, persistence, preferences, sync, ' +
      'metadata deletion, binary upload, logout, and launch context in a ' +
      'separate Profile tab with current WebID, preserved fragments, ' +
      'read-only resource opening, query-mode HTTP delivery, editable ' +
      'application defaults, saved anonymous links, managed opener links ' +
      'and failure recovery.'
  );
}
catch (error) {
  console.error('Pod requests:', calls);
  console.error(
    'Current app:',
    await page.evaluate(() => ({
      errors: window.__fixtureErrors,
      frame: document.querySelector('iframe')?.contentDocument?.body?.innerText,
      frameErrors:
        document.querySelector('iframe')?.contentWindow?.__fixtureErrors,
      url: location.href,
      launch: window.solidProfile?.host.launch,
      connected: Boolean(window.solidProfile?.host.session)
    }))
  );
  console.error(
    await page.evaluate(() => document.querySelector('tbody')?.outerHTML)
  );
  throw error;
}
finally {
  page?.close();
  otherPage?.close();
  launchedPage?.close();
  await chrome.close();
  appServer.kill('SIGTERM');
  await waitForExit({ process: appServer, isClosed: () => appServerClosed });
  await new Promise((resolve) => server.close(resolve));
}
