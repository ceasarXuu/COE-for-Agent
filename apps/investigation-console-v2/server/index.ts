import { randomBytes } from 'node:crypto';
import { userInfo } from 'node:os';

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

const ALLOWED_LOCAL_ROLES = new Set(['Viewer', 'Operator', 'Reviewer', 'Admin']);

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

function safeOsUsername(): string {
  try {
    const info = userInfo();
    if (typeof info.username === 'string' && info.username.length > 0) {
      return info.username;
    }
  } catch {
    // userInfo() may throw on minimal environments; fall through
  }
  return 'console-local';
}

interface DefaultActor {
  actorType: 'user';
  actorId: string;
  role: 'Viewer' | 'Operator' | 'Reviewer' | 'Admin';
  issuer: string;
  authMode: 'local';
}

function resolveDefaultActor(): DefaultActor {
  const overrideId = process.env.CONSOLE_LOCAL_ACTOR_ID?.trim();
  const actorId = overrideId && overrideId.length > 0
    ? overrideId
    : `local:${safeOsUsername()}`;

  const overrideRole = process.env.CONSOLE_LOCAL_ROLE?.trim();
  let role: DefaultActor['role'] = 'Operator';
  if (overrideRole) {
    if (!ALLOWED_LOCAL_ROLES.has(overrideRole)) {
      throw new Error(`CONSOLE_LOCAL_ROLE must be one of Viewer|Operator|Reviewer|Admin (got ${overrideRole})`);
    }
    role = overrideRole as DefaultActor['role'];
  } else if (process.env.CONSOLE_REVIEWER_MODE === '1') {
    role = 'Reviewer';
  }

  if (role === 'Reviewer' || role === 'Admin') {
    console.warn(JSON.stringify({
      event: 'console_bff.default_actor.elevated',
      severity: 'warn',
      message: 'Console BFF is issuing default sessions with privileged role; restrict to single-user local environments.',
      actorId,
      role
    }));
  }

  return {
    actorType: 'user',
    actorId,
    role,
    issuer: 'local-console',
    authMode: 'local'
  };
}

const DEFAULT_SESSION_SECRET = resolveDefaultSessionSecret();
const DEFAULT_PORT = Number(process.env.CONSOLE_BFF_PORT ?? '4318');

export interface BuildConsoleServerOptions {
  mcpClient?: ConsoleMcpClient;
  sessionSecret?: string;
  defaultActor?: DefaultActor;
}

export async function buildConsoleServer(options: BuildConsoleServerOptions = {}) {
  const sessionSecret = options.sessionSecret ?? DEFAULT_SESSION_SECRET;
  const defaultActor = options.defaultActor ?? resolveDefaultActor();
  const mcpClient = options.mcpClient
    ? options.mcpClient
    : await import('./mcp-client.js').then((module) => module.createLocalMcpClient());
  const getDefaultSession = () => createLocalSession(defaultActor, sessionSecret);

  const app = Fastify({ logger: false });

  await registerCasesRoutes(app, {
    mcpClient,
    sessionSecret
  });
  await registerResourceRoutes(app, { mcpClient, sessionSecret });
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
  // The console BFF is intentionally local-only:
  //  - sessions are minted from the OS user (see resolveDefaultActor)
  //  - HMAC secrets default to a per-process ephemeral value
  //  - reviewer/operator role is granted by env, not a real identity
  // Binding to 127.0.0.1 is part of the security boundary; do NOT switch
  // this to 0.0.0.0 without first introducing real authentication.
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
