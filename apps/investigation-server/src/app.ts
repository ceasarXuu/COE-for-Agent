import Fastify, { type FastifyInstance } from 'fastify';

import { createPersistenceClient, migrateToLatest } from '@coe/persistence';

import { loadConfig, type InvestigationServerConfig } from './config.js';
import { registerControlPlane } from './http/control-plane.js';
import { createInvestigationMcpServer, type InvestigationMcpServer } from './mcp/server.js';
import type { InvestigationServerServices } from './services.js';

export interface InvestigationApp extends FastifyInstance {
  mcpServer: InvestigationMcpServer;
  services: InvestigationServerServices;
}

export interface BuildInvestigationAppOptions {
  config?: InvestigationServerConfig;
}

export async function buildInvestigationApp(
  options: BuildInvestigationAppOptions = {}
): Promise<InvestigationApp> {
  const config = options.config ?? loadConfig();
  const app = Fastify({ logger: false }) as unknown as InvestigationApp;
  const persistence = createPersistenceClient({ dataDir: config.dataDir });

  await migrateToLatest(persistence.db);

  app.services = {
    db: persistence.db
  };

  app.mcpServer = createInvestigationMcpServer({ config, services: app.services });
  await registerControlPlane(app, config, app.services);
  app.addHook('onClose', async () => {
    await persistence.destroy();
  });

  return app;
}
