import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

import {
  DEFAULT_CONSOLE_BFF_PORT,
  DEFAULT_CONSOLE_WEB_PORT,
  isPortAvailable,
  resolvePortPlan
} from './run-e2e-ports.mjs';

const cwd = process.cwd();
const childProcesses = [];
const REQUESTED_CONSOLE_BFF_PORT = Number(process.env.CONSOLE_BFF_PORT ?? String(DEFAULT_CONSOLE_BFF_PORT));
const REQUESTED_CONSOLE_WEB_PORT = Number(process.env.CONSOLE_WEB_PORT ?? String(DEFAULT_CONSOLE_WEB_PORT));
const EXPLICIT_CONSOLE_BFF_PORT = Object.hasOwn(process.env, 'CONSOLE_BFF_PORT');
const EXPLICIT_CONSOLE_WEB_PORT = Object.hasOwn(process.env, 'CONSOLE_WEB_PORT');
const PLAYWRIGHT_BIN = path.join(cwd, 'node_modules', '.bin', 'playwright');
const TSX_BIN = path.join(cwd, 'node_modules', '.bin', 'tsx');
const VITE_BIN = path.join(cwd, 'node_modules', '.bin', 'vite');
const REAL_E2E_SEED_FILE = path.join(cwd, '.tmp', 'real-backend-seed.json');

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function startProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: 'inherit'
  });

  const handle = {
    child,
    label: options.label ?? `${command} ${args.join(' ')}`.trim()
  };

  childProcesses.push(handle);
  return handle;
}

async function waitForUrl(url, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling until the server is ready
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function waitForClose(child) {
  return new Promise((resolve) => {
    child.once('close', () => resolve());
    child.once('exit', () => resolve());
  });
}

async function stopProcess(handle) {
  if (handle.child.exitCode !== null || handle.child.signalCode !== null) {
    return;
  }

  handle.child.kill('SIGTERM');
  const graceful = Promise.race([
    waitForClose(handle.child),
    delay(5000).then(() => 'timeout')
  ]);

  if (await graceful === 'timeout') {
    handle.child.kill('SIGKILL');
    await waitForClose(handle.child);
  }
}

async function cleanup() {
  for (const child of childProcesses.reverse()) {
    await stopProcess(child);
  }
}

function waitForUrlOrExit(handle, url) {
  return Promise.race([
    waitForUrl(url),
    new Promise((_, reject) => {
      handle.child.once('exit', (code, signal) => {
        reject(new Error(`${handle.label} exited before becoming ready (code=${code ?? 'null'}, signal=${signal ?? 'null'})`));
      });
      handle.child.once('error', (error) => {
        reject(error);
      });
    })
  ]);
}

async function ensurePlaywrightRuntime() {
  const probeScript = `
    import { chromium } from '@playwright/test';
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    await browser.close();
  `;
  const probe = startProcess(process.execPath, ['--input-type=module', '-e', probeScript], {
    label: 'playwright chrome probe'
  });
  const exitCode = await new Promise((resolve, reject) => {
    probe.child.once('exit', (code) => resolve(code ?? 1));
    probe.child.once('error', reject);
  });

  if (Number(exitCode) !== 0) {
    throw new Error('Playwright could not launch local Chrome. Install Google Chrome and retry `pnpm --filter @coe/investigation-console-v2 test:e2e`.');
  }
}

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(130);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(143);
});

async function main() {
  await ensurePlaywrightRuntime();
  const { webPort, bffPort } = await resolvePortPlan({
    requestedWebPort: REQUESTED_CONSOLE_WEB_PORT,
    requestedBffPort: REQUESTED_CONSOLE_BFF_PORT,
    explicitWebPort: EXPLICIT_CONSOLE_WEB_PORT,
    explicitBffPort: EXPLICIT_CONSOLE_BFF_PORT,
    isPortAvailable
  });

  const sharedEnv = {
    CONSOLE_WEB_PORT: String(webPort),
    CONSOLE_BFF_PORT: String(bffPort),
    REAL_E2E_SEED_FILE
  };

  if (webPort !== REQUESTED_CONSOLE_WEB_PORT || bffPort !== REQUESTED_CONSOLE_BFF_PORT) {
    console.info('[investigation-console-v2] e2e-ports-selected', {
      requestedWebPort: REQUESTED_CONSOLE_WEB_PORT,
      requestedBffPort: REQUESTED_CONSOLE_BFF_PORT,
      webPort,
      bffPort
    });
  }

  const bff = startProcess(TSX_BIN, ['server/e2e-real.ts'], {
    label: 'real backend e2e bff',
    env: sharedEnv
  });
  const web = startProcess(VITE_BIN, ['--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], {
    label: 'vite v2 web server',
    env: sharedEnv
  });

  try {
    await Promise.all([
      waitForUrlOrExit(bff, `http://127.0.0.1:${bffPort}/api/session`),
      waitForUrlOrExit(web, `http://127.0.0.1:${webPort}`)
    ]);

    const runner = startProcess('sh', [PLAYWRIGHT_BIN, 'test', 'e2e/console-smoke.spec.ts', 'e2e/real-backend.spec.ts', '--reporter=line'], {
      label: 'playwright test',
      env: sharedEnv
    });
    const exitCode = await new Promise((resolve, reject) => {
      runner.child.once('exit', (code) => resolve(code ?? 1));
      runner.child.once('error', reject);
    });

    await cleanup();
    process.exit(Number(exitCode));
  } catch (error) {
    await cleanup();
    throw error;
  }
}

main().catch(async (error) => {
  console.error(error);
  await cleanup();
  process.exit(1);
});
