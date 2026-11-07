import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { startChrome } from './support/chrome.mjs';
import {
  StateGraph,
  named,
  literal
} from '../packages/solid-app-data/src/state-rdf.mjs';

let origin;
let body = '';
let version = 1;
let readStatus = 200;
let getValidator = true;
const writes = [];
const namespace = 'https://vocab.muze.nl/solid-apps#';
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, origin).pathname;
    if (path === '/fixture/profile') {
      response.setHeader('Content-Type', 'text/turtle');
      response.end(`<${origin}/fixture/profile#me>
        <http://xmlns.com/foaf/0.1/name> "Preferences fixture";
        <http://www.w3.org/ns/pim/space#preferencesFile> <${origin}/fixture/prefs>;
        <http://www.w3.org/ns/pim/space#storage> <${origin}/fixture/storage/>.`);
      return;
    }
    if (path === '/fixture/prefs') {
      if (request.method === 'PUT') {
        let source = '';
        for await (const chunk of request) {
          source += chunk;
        }
        if (request.headers['if-match'] !== '"' + version + '"') {
          response.writeHead(412).end();
          return;
        }
        writes.push({ source, etag: request.headers['if-match'] });
        body = source;
        version += 1;
        // Reproduce the reported provider pattern: acknowledged PUT without ETag.
        response.writeHead(205).end();
        return;
      }
      if (readStatus !== 200) {
        response.writeHead(readStatus).end();
        return;
      }
      response.setHeader('Content-Type', 'text/turtle');
      if (getValidator) {
        response.setHeader('ETag', '"' + version + '"');
      }
      response.end(body);
      return;
    }
    if (path === '/seed') {
      response.end('<!doctype html><title>Preferences fixture</title>');
      return;
    }
    if (path === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    const file = new URL(
      '../www' + path + (path.endsWith('/') ? 'index.html' : ''),
      import.meta.url
    );
    const content = await readFile(file);
    const type = path.endsWith('.js')
      ? 'text/javascript'
      : path.endsWith('.css')
        ? 'text/css'
        : path.endsWith('.svg')
          ? 'image/svg+xml'
          : 'text/html';
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Encoding': 'gzip'
    });
    response.end(gzipSync(content));
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      response.writeHead(404).end();
      return;
    }
    console.error(error);
    response.writeHead(500).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
body = `<${origin}/fixture/prefs#solid-apps> <${namespace}theme> "system".
  <#other> <https://example.org/unknown> "keep".`;
let browser;
let page;
async function wait(predicate) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (await page.evaluate(predicate)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  console.log(
    'Focus diagnostics:',
    await page.evaluate(() => ({
      active:
        document.activeElement.tagName +
        ':' +
        document.activeElement.getAttribute('data-simply-command'),
      restore: document.querySelector(
        '[data-simply-command="swb_preferences_restore"]'
      ).outerHTML,
      state:
        window.solidContacts.host.preferenceView.data.swb_preferences_restore,
      open: document.querySelector('.preferences-dialog').open,
      changes:
        window.solidContacts.host.preferenceView.runtime
          .swb_preferences_changes,
      error: String(
        window.solidContacts.host.preferenceView.runtime.swb_preferences_error
          ?.stack
      ),
      container: window.solidContacts.host.preferenceView.container.tagName
    }))
  );
  throw new Error(
    'preferences-browser: Timeout: ' +
      predicate +
      '\n' +
      (await page.evaluate(() => document.body.innerText))
  );
}
async function submit(theme) {
  await page.send('Runtime.evaluate', {
    expression: `(() => {
    const form = document.querySelector('.preferences-dialog form');
    form.elements.theme.value = ${JSON.stringify(theme)};
    form.elements.theme.dispatchEvent(new Event('change', { bubbles: true }));
    form.requestSubmit();
  })()`
  });
}
async function settled() {
  await wait(
    () =>
      document
        .querySelector('.preferences-dialog form')
        .getAttribute('aria-busy') === 'false' &&
      !document.querySelector('[data-simply-command="swb_preferences_review"]')
        .disabled &&
      !document.querySelector('.preferences-dialog footer .ds-button-primary')
        .disabled
  );
}
function remoteChange(theme, density) {
  const graph = new StateGraph(body, origin + '/fixture/prefs');
  const subject = named(origin + '/fixture/prefs#solid-apps');
  graph.set(subject, namespace + 'theme', literal(theme));
  graph.set(subject, namespace + 'density', literal(density));
  body = graph.write();
  version += 1;
}
try {
  browser = await startChrome(origin + '/seed');
  page = await browser.page();
  await page.ready();
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 50 * 1024,
    uploadThroughput: 25 * 1024
  });
  await page.evaluate(() => {
    localStorage.setItem(
      'solid-apps.webId',
      location.origin + '/fixture/profile#me'
    );
    location.href = '/contacts/';
  });
  await wait(() =>
    Boolean(window.solidContacts?.host.preferenceView.runtime.loaded)
  );
  await page.evaluate(() =>
    document.querySelector('[data-simply-command="preferences"]').click()
  );
  await wait(() => document.querySelector('.preferences-dialog').open);
  const cold = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    return {
      usableMilliseconds: Math.round(performance.now()),
      transferBytes:
        navigation.transferSize +
        resources.reduce((sum, entry) => sum + entry.transferSize, 0),
      requests: resources.length + 1
    };
  });
  console.log(
    'Cold Preferences interaction, gzip, 50 KiB/s down, 25 KiB/s up, 150ms latency:',
    cold
  );
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  assert.equal(
    await page.evaluate(() =>
      document
        .querySelector('.preferences-dialog')
        .textContent.includes('/fixture/prefs')
    ),
    false
  );
  await submit('light');
  await wait(
    () =>
      window.solidContacts.host.preferenceView.runtime.loaded.settings.theme ===
      'light'
  );
  await settled();
  assert.equal(writes.length, 1);
  await submit('system');
  await wait(
    () =>
      window.solidContacts.host.preferenceView.runtime.loaded.settings.theme ===
      'system'
  );
  await settled();
  assert.deepEqual(
    writes.map((write) => write.etag),
    ['"1"', '"2"']
  );

  await page.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await submit('light');
  await wait(() =>
    document
      .querySelector('.preferences-dialog [data-simply-field="message"]')
      .textContent.includes('still here')
  );
  await settled();
  assert.equal(
    await page.evaluate(
      () => document.querySelector('.preferences-dialog [name="theme"]').value
    ),
    'light'
  );
  assert.equal(writes.length, 2);
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await submit('light');
  await wait(
    () =>
      window.solidContacts.host.preferenceView.runtime.loaded.settings.theme ===
      'light'
  );
  await settled();
  assert.equal(writes.length, 3);

  getValidator = false;
  await submit('system');
  await wait(() =>
    document
      .querySelector('.preferences-dialog [data-simply-field="message"]')
      .textContent.includes('version information')
  );
  await settled();
  assert.equal(writes.length, 3);
  assert.equal(
    await page.evaluate(
      () => document.querySelector('.preferences-dialog [name="theme"]').value
    ),
    'system'
  );
  getValidator = true;
  await submit('system');
  await wait(
    () =>
      window.solidContacts.host.preferenceView.runtime.loaded.settings.theme ===
      'system'
  );
  await settled();

  remoteChange('dark', 'compact');
  const beforeConflict = writes.length;
  await submit('light');
  await wait(() =>
    document
      .querySelector('.preferences-dialog [data-simply-field="message"]')
      .textContent.includes('changed on your Pod')
  );
  await settled();
  assert.equal(writes.length, beforeConflict);
  assert.equal(
    await page.evaluate(
      () => document.querySelector('.preferences-dialog [name="theme"]').value
    ),
    'light'
  );
  const ax = await page.send('Accessibility.getFullAXTree');
  assert.ok(
    ax.nodes.some(
      (node) =>
        !node.ignored &&
        node.role?.value === 'button' &&
        node.name?.value === 'Review Pod settings'
    )
  );
  assert.ok(
    ax.nodes.some(
      (node) =>
        !node.ignored &&
        node.role?.value === 'combobox' &&
        node.name?.value === 'Theme'
    )
  );
  assert.ok(
    ax.nodes.some(
      (node) =>
        node.role?.value === 'status' &&
        node.properties?.some(
          (property) =>
            property.name === 'live' && property.value?.value === 'polite'
        )
    )
  );

  readStatus = 503;
  await page.evaluate(() =>
    document
      .querySelector('[data-simply-command="swb_preferences_review"]')
      .click()
  );
  await wait(() =>
    document
      .querySelector('.preferences-dialog [data-simply-field="message"]')
      .textContent.includes('could not complete')
  );
  await settled();
  assert.equal(
    await page.evaluate(
      () => document.querySelector('.preferences-dialog [name="theme"]').value
    ),
    'light'
  );
  readStatus = 200;
  await page.evaluate(() =>
    document
      .querySelector('[data-simply-command="swb_preferences_review"]')
      .click()
  );
  await wait(
    () =>
      document.querySelector('.preferences-dialog [name="theme"]').value ===
      'dark'
  );
  await settled();
  await wait(() =>
    document.activeElement.matches(
      '[data-simply-command="swb_preferences_restore"]'
    )
  );
  await page.evaluate(() =>
    document
      .querySelector('[data-simply-command="swb_preferences_restore"]')
      .click()
  );
  await wait(
    () =>
      document.querySelector('.preferences-dialog [name="theme"]').value ===
      'light'
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector('.preferences-dialog [name="density"]').value
    ),
    'compact',
    'Restoring user changes preserves other reviewed Pod settings.'
  );
  await submit('light');
  await wait(
    () =>
      window.solidContacts.host.preferenceView.runtime.loaded.settings.theme ===
      'light'
  );
  await settled();
  assert.equal(writes.length, beforeConflict + 1);
  assert.ok(body.includes('keep'));

  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 740,
    deviceScaleFactor: 1,
    mobile: true
  });
  remoteChange('dark', 'comfortable');
  await submit('system');
  await wait(() =>
    document
      .querySelector('.preferences-dialog [data-simply-field="message"]')
      .textContent.includes('changed on your Pod')
  );
  await settled();
  assert.equal(
    await page.evaluate(() => {
      const dialog = document.querySelector('.preferences-dialog');
      const footer = dialog.querySelector('footer').getBoundingClientRect();
      return (
        footer.bottom <= innerHeight &&
        footer.top >= 0 &&
        dialog.getBoundingClientRect().width <= innerWidth &&
        document.documentElement.scrollWidth <= innerWidth
      );
    }),
    true,
    'Phone recovery actions remain visible without scrolling.'
  );
  await page.evaluate(() =>
    document
      .querySelector('[data-simply-command="swb_preferences_review"]')
      .focus()
  );
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    text: '\r',
    unmodifiedText: '\r'
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13
  });
  await wait(
    () =>
      document.querySelector('.preferences-dialog [name="theme"]').value ===
      'dark'
  );
  await settled();
  await wait(() =>
    document.activeElement.matches(
      '[data-simply-command="swb_preferences_restore"]'
    )
  );
  await wait(
    () =>
      document.querySelector(
        '.preferences-dialog [data-simply-field="muzeSolidDesignNotice.visibility"]'
      ).hidden
  );
  assert.equal(
    await page.evaluate(() => {
      const footer = document.querySelector('.preferences-dialog footer');
      return [
        ...footer.querySelectorAll('button:not([hidden]), [role="status"]')
      ].every((element) => {
        const rect = element.getBoundingClientRect();
        const visible = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        );
        return (
          rect.top >= 0 &&
          rect.bottom <= innerHeight &&
          (visible === element || element.contains(visible))
        );
      });
    }),
    true,
    'Recovery status and actions are visible and unobscured on phones.'
  );
  const image = await page.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    '/tmp/cycle77-preferences-phone.png',
    Buffer.from(image.data, 'base64')
  );
  await page.send('Emulation.clearDeviceMetricsOverride');
  const desktop = await page.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    '/tmp/cycle77-preferences-desktop.png',
    Buffer.from(desktop.data, 'base64')
  );
  console.log(
    'PASS: Preferences repeated saves, offline retry, validators, conflict review/restore, RDF preservation, phone and keyboard/AX checks.'
  );
}
finally {
  page?.close();
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
