import type { ConsoleMcpClient } from './mcp-types.js';
import { consoleTelemetry } from './telemetry.js';

interface HeadRevisionPayload {
  caseId: string;
  headRevision: number;
}

interface ProjectionPayload {
  caseId: string;
  projection: string;
  headRevision: number;
  projectionRevision: number;
}

export async function createLocalMcpClient(): Promise<ConsoleMcpClient> {
  const [{ buildInvestigationApp }, { loadConfig: loadInvestigationServerConfig }, { investigationTelemetry }] = await Promise.all([
    import('@coe/investigation-server/src/app.js'),
    import('@coe/investigation-server/src/config.js'),
    import('@coe/investigation-server/src/telemetry.js')
  ]);
  const app = await buildInvestigationApp({
    config: loadInvestigationServerConfig(process.env as Record<string, string | undefined>)
  });
  const unsubscribeHead = investigationTelemetry.subscribe('case.head_revision.changed', (payload) => {
    consoleTelemetry.emit('case.head_revision.changed', payload as HeadRevisionPayload);
  });
  const unsubscribeProjection = investigationTelemetry.subscribe('case.projection.updated', (payload) => {
    consoleTelemetry.emit('case.projection.updated', payload as ProjectionPayload);
  });

  return {
    readResource(uri) {
      return app.mcpServer.readResource(uri);
    },
    invokeTool(name, input) {
      return app.mcpServer.invokeTool(name as never, input as never);
    },
    async close() {
      unsubscribeHead();
      unsubscribeProjection();
      await app.close();
    }
  };
}