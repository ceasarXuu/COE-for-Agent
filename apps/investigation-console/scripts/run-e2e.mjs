import { spawn } from 'node:child_process';
import process from 'node:process';

const cwd = process.cwd();
const childProcesses = [];

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function startProcess(command, args) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit'
  });

  childProcesses.push(child);
  return child;
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

function stopProcess(child) {
  if (!child.killed) {
    child.kill('SIGTERM');
  }
}

async function cleanup() {
  for (const child of childProcesses.reverse()) {
    stopProcess(child);
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
  const bff = startProcess('pnpm', ['exec', 'tsx', 'server/e2e.ts']);
  const web = startProcess('pnpm', ['exec', 'vite', '--host', '127.0.0.1', '--port', '4173', '--strictPort']);

  try {
    await waitForUrl('http://127.0.0.1:4318/api/session');
    await waitForUrl('http://127.0.0.1:4173');

    const testRunner = spawn('pnpm', ['exec', 'playwright', 'test'], {
      cwd,
      env: process.env,
      stdio: 'inherit'
    });

    const exitCode = await new Promise((resolve, reject) => {
      testRunner.on('exit', (code) => resolve(code ?? 1));
      testRunner.on('error', reject);
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