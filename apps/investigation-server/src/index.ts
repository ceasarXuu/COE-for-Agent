import { buildInvestigationApp } from './app.js';
import { loadConfig } from './config.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildInvestigationApp({ config });

  await app.listen({
    host: '127.0.0.1',
    port: config.port
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});