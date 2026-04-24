import { createInProcessInvestigationMcpClient } from '@coe/investigation-server/console-adapter';

import type { ConsoleMcpClient } from './mcp-types.js';
import { consoleTelemetry } from './telemetry.js';

export async function createLocalMcpClient(): Promise<ConsoleMcpClient> {
  return createInProcessInvestigationMcpClient({
    env: process.env as Record<string, string | undefined>,
    onHeadRevisionChanged(payload) {
      consoleTelemetry.emit('case.head_revision.changed', payload);
    },
    onProjectionUpdated(payload) {
      consoleTelemetry.emit('case.projection.updated', payload);
    }
  });
}
