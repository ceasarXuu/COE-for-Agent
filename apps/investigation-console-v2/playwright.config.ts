import { defineConfig } from '@playwright/test';

const consoleWebPort = Number(process.env.CONSOLE_WEB_V2_PORT ?? '4273');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${consoleWebPort}`,
    channel: 'chrome',
    headless: true,
    locale: 'en-US',
    trace: 'retain-on-failure'
  }
});
