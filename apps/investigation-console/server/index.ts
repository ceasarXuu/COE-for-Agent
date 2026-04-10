import Fastify from 'fastify';

import { createLocalSession } from './auth/session.js';
import type { ConsoleMcpClient } from './mcp-types.js';
import { registerCasesRoutes } from './routes/cases.js';
import { registerResourceRoutes } from './routes/resources.js';
import { registerStreamRoutes } from './routes/stream.js';
import { registerToolRoutes } from './routes/tools.js';

const DEFAULT_SESSION_SECRET = process.env.LOCAL_ISSUER_SECRET ?? 'local-dev-secret';
const DEFAULT_PORT = Number(process.env.CONSOLE_BFF_PORT ?? '4318');

export interface BuildConsoleServerOptions {
  mcpClient?: ConsoleMcpClient;
  sessionSecret?: string;
}

export async function buildConsoleServer(options: BuildConsoleServerOptions = {}) {
  const sessionSecret = options.sessionSecret ?? DEFAULT_SESSION_SECRET;
  const mcpClient = options.mcpClient
    ? options.mcpClient
    : await import('./mcp-client.js').then((module) => module.createLocalMcpClient());
  const defaultSession = createLocalSession(
    {
      actorType: 'user',
      actorId: 'console-reviewer',
      role: 'Reviewer',
      issuer: 'local-console',
      authMode: 'local'
    },
    sessionSecret
  );

  const app = Fastify({ logger: false });

  await registerCasesRoutes(app, {
    mcpClient,
    sessionSecret,
    defaultSession
  });
  await registerResourceRoutes(app, { mcpClient });
  await registerToolRoutes(app, {
    mcpClient,
    sessionSecret,
    defaultSession
  });
  await registerStreamRoutes(app);

  app.addHook('onClose', async () => {
    await mcpClient.close();
  });

  return app;
}

async function main(): Promise<void> {
  const app = await buildConsoleServer();
  await app.listen({
    host: '127.0.0.1',
    port: DEFAULT_PORT
  });
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file:').href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
