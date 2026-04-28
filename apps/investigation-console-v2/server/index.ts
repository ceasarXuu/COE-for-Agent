import { randomBytes } from 'node:crypto';

import Fastify from 'fastify';

import { createLocalSession } from './auth/session.js';
import type { ConsoleMcpClient } from './mcp-types.js';
import { registerCasesRoutes } from './routes/cases.js';
import { registerResourceRoutes } from './routes/resources.js';
import { registerStreamRoutes } from './routes/stream.js';
import { registerToolRoutes } from './routes/tools.js';

const INSECURE_PLACEHOLDER_SECRETS = new Set([
  'local-dev-secret',
  'dev-local-issuer-secret',
  'changeme',
  'secret'
]);

function resolveDefaultSessionSecret(): string {
  const provided = process.env.LOCAL_ISSUER_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (provided && provided.length > 0) {
    if (isProduction && (provided.length < 32 || INSECURE_PLACEHOLDER_SECRETS.has(provided))) {
      throw new Error('LOCAL_ISSUER_SECRET is missing or insecure in production');
    }
    return provided;
  }

  if (isProduction) {
    throw new Error('LOCAL_ISSUER_SECRET is required when NODE_ENV=production');
  }

  const ephemeral = randomBytes(32).toString('base64url');
  console.warn(JSON.stringify({
    event: 'console_bff.local_issuer_secret.ephemeral',
    severity: 'warn',
    message: 'LOCAL_ISSUER_SECRET not set; generated ephemeral per-process secret. Cross-process verification (server <-> console BFF) requires both sides to share the same LOCAL_ISSUER_SECRET.'
  }));
  return ephemeral;
}

const DEFAULT_SESSION_SECRET = resolveDefaultSessionSecret();
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
  const getDefaultSession = () => createLocalSession(
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
    sessionSecret
  });
  await registerResourceRoutes(app, { mcpClient });
  await registerToolRoutes(app, {
    mcpClient,
    sessionSecret,
    getDefaultSession
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
