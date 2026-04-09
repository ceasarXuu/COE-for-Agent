import { buildConsoleServer } from './index.js';
import { createFixtureMcpClient } from '../e2e/fixture-mcp-client.js';

const PORT = Number(process.env.CONSOLE_BFF_PORT ?? '4318');

async function main() {
  const app = await buildConsoleServer({
    mcpClient: createFixtureMcpClient(),
    sessionSecret: 'local-e2e-secret'
  });

  const shutdown = async () => {
    await app.close();
  };

  process.once('SIGINT', () => {
    void shutdown().finally(() => process.exit(130));
  });
  process.once('SIGTERM', () => {
    void shutdown().finally(() => process.exit(143));
  });

  await app.listen({
    host: '127.0.0.1',
    port: PORT
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
