import type { CaseHeadRevisionChangedEvent, ProjectionTelemetryEvent } from '@coe/telemetry';
import {
  GUARDRAIL_TOOL_NAMES,
  MUTATION_TOOL_NAMES,
  type GuardrailToolName,
  type MutationToolName
} from '@coe/mcp-contracts/tool-names';

import { buildInvestigationApp } from './app.js';
import { loadConfig } from './config.js';
import type { ResourceReadResult } from './mcp/register-resources.js';
import { investigationTelemetry } from './telemetry.js';

export type ConsoleMcpToolName = MutationToolName | GuardrailToolName;

export interface ConsoleMcpClient {
  readResource(uri: string): Promise<ResourceReadResult>;
  invokeTool(name: ConsoleMcpToolName, input: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

export interface CreateInProcessInvestigationMcpClientOptions {
  env?: Record<string, string | undefined>;
  onHeadRevisionChanged?: (payload: CaseHeadRevisionChangedEvent) => void;
  onProjectionUpdated?: (payload: ProjectionTelemetryEvent) => void;
}

const CONSOLE_TOOL_NAMES = new Set<string>([
  ...MUTATION_TOOL_NAMES,
  ...GUARDRAIL_TOOL_NAMES
]);

export function isConsoleMcpToolName(value: string): value is ConsoleMcpToolName {
  return CONSOLE_TOOL_NAMES.has(value);
}

export async function createInProcessInvestigationMcpClient(
  options: CreateInProcessInvestigationMcpClientOptions = {}
): Promise<ConsoleMcpClient> {
  const app = await buildInvestigationApp({
    config: loadConfig(options.env ?? process.env)
  });
  const unsubscribeHead = investigationTelemetry.subscribe('case.head_revision.changed', (payload) => {
    options.onHeadRevisionChanged?.(payload);
  });
  const unsubscribeProjection = investigationTelemetry.subscribe('case.projection.updated', (payload) => {
    options.onProjectionUpdated?.(payload);
  });

  return {
    readResource(uri) {
      return app.mcpServer.readResource(uri);
    },
    invokeTool(name, input) {
      return app.mcpServer.invokeTool(name, input as never);
    },
    async close() {
      unsubscribeHead();
      unsubscribeProjection();
      await app.close();
    }
  };
}
