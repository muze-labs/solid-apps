import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as path from 'node:path';
export { startChrome, freePort, waitForExit, formatBrowserException };
async function startChrome(url, { allowPopups = false } = {}) {
  const debugPort = await freePort();
  const userDataDir = path.join(
    '/tmp',
    `solid-apps-chrome-${process.pid}-${Date.now()}`
  );
  const chrome = spawn(
    'google-chrome',
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      ...(allowPopups ? ['--disable-popup-blocking'] : []),
      url
    ],
    {
      stdio: ['ignore', 'ignore', 'ignore']
    }
  );

  let closed = false;
  chrome.once('exit', () => {
    closed = true;
  });

  await waitForEndpoint({ debugPort, isClosed: () => closed });

  return {
    async page(targetId) {
      const targets = await fetchJson(
        `http://127.0.0.1:${debugPort}/json/list`
      );
      const target = targets.find((item) =>
        targetId ? item.id === targetId : item.type === 'page'
      );
      if (!target?.webSocketDebuggerUrl) {
        throw new Error('No Chrome page target found');
      }
      return connectPage(target.webSocketDebuggerUrl);
    },

    async close() {
      if (!closed) {
        chrome.kill('SIGTERM');
        await waitForExit({ process: chrome, isClosed: () => closed });
      }
      await fs.rm(userDataDir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100
      });
    }
  };
}

async function connectPage(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const events = new Map();
  let id = 0;

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message));
      }
      else {
        resolve(message.result);
      }
      return;
    }

    const listeners = events.get(message.method) || [];
    listeners.forEach((listener) => listener(message.params));
  });

  const page = {
    send(method, params = {}) {
      id += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    },

    once(method) {
      return new Promise((resolve) => {
        const listener = (params) => {
          events.set(
            method,
            (events.get(method) || []).filter((item) => item !== listener)
          );
          resolve(params);
        };
        events.set(method, [...(events.get(method) || []), listener]);
      });
    },

    async ready() {
      await this.send('Runtime.enable');
      await this.send('Page.enable');
      // Inspect and subscribe in one browser task: load can otherwise fire
      // between receiving readyState and registering the CDP listener.
      await this.evaluate(() => new Promise((resolve, reject) => {
        if (document.readyState === 'complete') {
          resolve();
          return;
        }
        const loaded = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          window.removeEventListener('load', loaded);
          reject(new Error('chrome-test: Page load timed out: ' + location.href));
        }, 8000);
        window.addEventListener('load', loaded, { once: true });
      }));
    },

    async evaluate(fn) {
      const result = await this.send('Runtime.evaluate', {
        expression: `(${fn})()`,
        awaitPromise: true,
        returnByValue: true
      });
      if (result.exceptionDetails) {
        throw new Error(formatBrowserException(result.exceptionDetails));
      }
      return result.result.value;
    },

    close() {
      socket.close();
    }
  };

  return page;
}

async function waitForEndpoint({ debugPort, isClosed }) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (isClosed()) {
      throw new Error('Chrome exited before DevTools became available');
    }
    try {
      await fetchJson(`http://127.0.0.1:${debugPort}/json/version`);
      return;
    }
    catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error('Timed out waiting for Chrome DevTools');
}

async function waitForExit({ process, isClosed }) {
  if (isClosed()) {
    return;
  }

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      process.kill('SIGKILL');
      resolve();
    }, 2000);
    process.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function fetchJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  });
}

async function freePort() {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function formatBrowserException(details) {
  const description = details.exception?.description || details.text;
  const frames = details.stackTrace?.callFrames || [];
  const stack = frames
    .map(
      (frame) =>
        `    at ${frame.functionName || '<anonymous>'} (${frame.url}:${frame.lineNumber + 1}:${frame.columnNumber + 1})`
    )
    .join('\n');

  return stack ? `${description}\n${stack}` : description;
}
