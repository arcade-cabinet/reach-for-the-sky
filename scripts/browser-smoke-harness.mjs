import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_TIMEOUT_MS = 15_000;
const PROCESS_START_TIMEOUT_MS = 30_000;
export const HOST = '127.0.0.1';

export function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/opt/google/chrome/chrome',
  ].filter(Boolean);
  const chrome = candidates.find((candidate) => existsSync(candidate));
  if (!chrome) {
    throw new Error('Unable to find Chrome. Set CHROME_BIN to run browser smoke verification.');
  }
  return chrome;
}

export function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a local port')));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

export async function waitFor(description, probe, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await probe();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`${description} timed out${lastError ? `: ${lastError.message}` : ''}`);
}

export function spawnLogged(command, args) {
  const child = spawn(command, args, {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.output = () => output.trim();
  return child;
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;

  const signal = (value) => {
    try {
      if (process.platform !== 'win32' && child.pid) {
        process.kill(-child.pid, value);
      } else {
        child.kill(value);
      }
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };

  signal('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('close', resolve)),
    new Promise((resolve) =>
      setTimeout(() => {
        if (child.exitCode === null) signal('SIGKILL');
        resolve();
      }, 2_000),
    ),
  ]);

  child.stdout?.destroy();
  child.stderr?.destroy();
}

async function removeTemporaryDirectory(pathname) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(pathname, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

export async function waitForHttpJson(url) {
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json();
}

export class DevToolsSession {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    this.socket = new WebSocket(this.webSocketUrl);
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result.result?.value;
  }

  close() {
    this.socket?.close();
  }
}

export async function withDevPage(pathname, callback) {
  const vitePort = await getFreePort();
  const chromePort = await getFreePort();
  const url = new URL(pathname, `http://${HOST}:${vitePort}`).toString();
  const vite = spawnLogged('pnpm', [
    'exec',
    'vite',
    '--host',
    HOST,
    '--port',
    String(vitePort),
    '--strictPort',
  ]);
  const userDataDir = await mkdtemp(join(tmpdir(), 'reach-sky-chrome-'));
  let chrome;
  let devtools;

  try {
    await waitFor(
      'Vite dev server',
      async () => {
        const response = await fetch(url);
        return response.ok;
      },
      PROCESS_START_TIMEOUT_MS,
    );

    chrome = spawnLogged(findChrome(), [
      '--headless=new',
      '--disable-gpu',
      ...(process.env.CI ? ['--no-sandbox'] : []),
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      `--remote-debugging-address=${HOST}`,
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ]);

    const version = await waitFor(
      'Chrome DevTools endpoint',
      () => waitForHttpJson(`http://${HOST}:${chromePort}/json/version`),
      PROCESS_START_TIMEOUT_MS,
    );
    const target = await waitFor(
      'Chrome page target',
      async () => {
        const targets = await waitForHttpJson(`http://${HOST}:${chromePort}/json/list`);
        return targets?.find((candidate) => candidate.type === 'page');
      },
      PROCESS_START_TIMEOUT_MS,
    );

    devtools = new DevToolsSession(target.webSocketDebuggerUrl ?? version.webSocketDebuggerUrl);
    await devtools.open();
    await devtools.send('Runtime.enable');
    await devtools.send('Page.enable');
    await devtools.send('Page.navigate', { url });

    return await callback({ url, devtools });
  } finally {
    devtools?.close();
    await stopProcess(chrome);
    await stopProcess(vite);
    await removeTemporaryDirectory(userDataDir);
  }
}
