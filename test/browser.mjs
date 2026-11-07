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
const calls = [];
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,OPTIONS,DELETE');
  res.setHeader('Access-Control-Expose-Headers', 'ETag,Link,Location');
  const url = new URL(req.url, base).href;
  calls.push({ method: req.method, url });
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === 'PUT') {
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
    source: 'window.confirm=()=>true;'
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
    const name = path.split('/')[0];
    const exportedApp = 'window.solid' + name[0].toUpperCase() + name.slice(1);
    await wait(exportedApp);
    await evaluate('await ' + exportedApp + '.host.ready;');
    if (!inspectedFeatures.has(name)) {
      await checkFeatureSources(page, name);
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
      path.split('/')[0][0].toUpperCase() + path.split('/')[0].slice(1)
    );
    if (!path.startsWith('launcher/')) {
      assert.deepEqual(
        await evaluate(
          'return [...document.querySelectorAll("a[href]")].map(link=>link.getAttribute("href")).filter(href=>/^(?:\\.\\.\\/|\\/)(?:launcher|contacts|profile|files)(?:\\/|$)/.test(href));'
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
      'document.querySelector("#account-menu").matches(":popover-open")'
    );
    await click(`[data-simply-command=${command}]`);
    await wait(
      '!document.querySelector("#account-menu").matches(":popover-open")'
    );
  }
  async function capture(name) {
    await fs.mkdir('/tmp/solid-apps-review', { recursive: true });
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
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
    'document.querySelector("#account-menu").matches(":popover-open")'
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
    '!document.querySelector("#account-menu").matches(":popover-open")'
  );
  await click('.account-button');
  await wait(
    'document.querySelector("#account-menu").matches(":popover-open")'
  );
  await click('h1');
  await wait(
    '!document.querySelector("#account-menu").matches(":popover-open")'
  );
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
    'document.querySelector(".account-name").textContent==="Remote Person"'
  );
  assert.equal(
    await evaluate(
      'return document.querySelector("#account-menu").textContent.includes(window.solidContacts.host.session.webId);'
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
    'document.querySelector(".preferences-dialog [role=status]").textContent.includes("saved")'
  );
  assert.match(String(resources.get(base + '/prefs').body), /untouched/);
  assert.match(String(resources.get(base + '/prefs').body), /launcher\.ttl/);
  assert.match(String(resources.get(base + '/prefs').body), /storage\//);
  await evaluate(
    'document.querySelector(".preferences-dialog [data-simply-command=close]").click();document.querySelector("[data-simply-command=sync]").click();'
  );
  await wait(
    'document.querySelector(".suite-status").textContent.includes("Contacts synchronized")'
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
    'document.querySelector(".account-name").textContent==="Remote Person"'
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
  assert.doesNotMatch(await evaluate(
    'return document.querySelector(".profile-details").textContent;'
  ), /\[object Object\]|unresolved-email/);
  await submit('.profile-card form', { name: 'Changed remote profile' });
  await wait(
    'document.querySelector(".profile-card h2")?.textContent==="Changed remote profile"'
  );
  assert.match(String(resources.get(base + '/profile').body), /Keep me/);
  assert.match(String(resources.get(base + '/profile').body), /unresolved-email/);
  assert.match(String(resources.get(base + '/profile').body), /keep email metadata/);

  await capture('profile-desktop');
  await visit('launcher/');
  await wait(
    'window.solidLauncher?.store && document.body.classList.contains("ds-darkmode")'
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
    'document.querySelector(".suite-status").textContent.includes("Shortcuts synchronized")'
  );
  assert.match(
    String(resources.get(base + '/launcher.ttl').body),
    /Example app/
  );
  await wait(
    'document.querySelector(".account-name").textContent==="Changed remote profile"'
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
    '/launcher/'
  );
  assert.equal(
    await launcherPage.evaluate(() => window.solidLauncher.host.session.webId),
    webId
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
    'document.querySelector(".preferences-dialog [role=status]").textContent.includes("saved")'
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
    'document.querySelector(".suite-status").textContent.includes("Shortcuts synchronized")'
  );
  await visit('launcher/');
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
    'document.querySelector(".suite-status").textContent.includes("Shortcuts synchronized")'
  );
  assert.match(
    String(resources.get(base + '/launcher.ttl').body),
    /preserve app metadata/
  );
  assert.match(
    String(resources.get(base + '/launcher.ttl').body),
    /preserve other subject/
  );
  await visit('launcher/');
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
    'document.querySelector(".suite-status").textContent.includes("Shortcuts synchronized")'
  );
  await visit('launcher/');
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
    'document.querySelector(".suite-status").textContent.includes("Shortcuts synchronized")'
  );
  await visit('launcher/');
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
    'document.querySelector(".suite-status").textContent.includes("Marked deleted")'
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
    'document.querySelector(".suite-status").textContent.includes("1 files uploaded")'
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
  await click('.account-button');
  await wait(
    'document.querySelector("#account-menu").matches(":popover-open")'
  );
  await capture('contacts-account-menu');
  await click('[data-simply-command=preferences]');
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
    url: appBase + 'launcher/'
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
      'return document.querySelector(".account-name").textContent;'
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
  await visit('launcher/');
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
