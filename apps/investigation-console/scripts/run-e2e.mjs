import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

const cwd = process.cwd();
const childProcesses = [];
const CONSOLE_BFF_PORT = Number(process.env.CONSOLE_BFF_PORT ?? '4318');
const CONSOLE_WEB_PORT = Number(process.env.CONSOLE_WEB_PORT ?? '4173');
const PLAYWRIGHT_BIN = path.join(cwd, 'node_modules', '.bin', 'playwright');
const TSX_BIN = path.join(cwd, 'node_modules', '.bin', 'tsx');
const VITE_BIN = path.join(cwd, 'node_modules', '.bin', 'vite');
const REAL_E2E_SEED_FILE = path.join(cwd, '.tmp', 'real-backend-seed.json');

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function ensurePortAvailable(port, label) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => {
      reject(new Error(`${label} port ${port} is already in use. Stop the existing process and retry.`));
    });
    server.once('listening', () => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    server.listen(port, '127.0.0.1');
  });
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
    throw new Error('Playwright could not launch local Chrome. Install Google Chrome and retry `pnpm --filter @coe/investigation-console test:e2e`.');
  }
}

async function runPlaywright(specs, env = {}) {
  const runner = startProcess('sh', [PLAYWRIGHT_BIN, 'test', ...specs, '--reporter=line'], {
    label: `playwright test ${specs.join(' ')}`,
    env
  });
  return new Promise((resolve, reject) => {
    runner.child.once('exit', (code) => resolve(code ?? 1));
    runner.child.once('error', reject);
  });
}

async function runFixturePhase() {
  await ensurePortAvailable(CONSOLE_BFF_PORT, 'Console BFF');
  const bff = startProcess(TSX_BIN, ['server/e2e.ts'], {
    label: 'fixture e2e bff'
  });
  try {
    await waitForUrlOrExit(bff, `http://127.0.0.1:${CONSOLE_BFF_PORT}/api/session`);
    return Number(await runPlaywright(['e2e/case-workspace.spec.ts', 'e2e/history-mode.spec.ts']));
  } finally {
    await stopProcess(bff);
  }
}

async function runRealBackendPhase() {
  await mkdir(path.dirname(REAL_E2E_SEED_FILE), { recursive: true });
  await ensurePortAvailable(CONSOLE_BFF_PORT, 'Console BFF');
  const bff = startProcess(TSX_BIN, ['server/e2e-real.ts'], {
    label: 'real backend e2e bff',
    env: {
      REAL_E2E_SEED_FILE
    }
  });
  try {
    await waitForUrlOrExit(bff, `http://127.0.0.1:${CONSOLE_BFF_PORT}/api/session`);
    return Number(await runPlaywright(['e2e/real-backend.spec.ts'], {
      REAL_E2E_SEED_FILE
    }));
  } finally {
    await stopProcess(bff);
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
  await ensurePortAvailable(CONSOLE_WEB_PORT, 'Console web');
  const web = startProcess(VITE_BIN, ['--host', '127.0.0.1', '--port', String(CONSOLE_WEB_PORT), '--strictPort'], {
    label: 'vite web server'
  });

  try {
    await waitForUrlOrExit(web, `http://127.0.0.1:${CONSOLE_WEB_PORT}`);
    const fixtureExitCode = await runFixturePhase();
    if (fixtureExitCode !== 0) {
      await cleanup();
      process.exit(fixtureExitCode);
    }

    const realExitCode = await runRealBackendPhase();
    await cleanup();
    process.exit(realExitCode);
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
