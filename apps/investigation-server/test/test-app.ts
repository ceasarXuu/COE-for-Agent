import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ActorContext } from '@coe/domain';
import { MUTATION_TOOL_NAMES } from '@coe/mcp-contracts/tool-names';

import { buildInvestigationApp, type InvestigationApp } from '../src/app.js';
import { issueConfirmToken, hashConfirmationReason } from '../src/auth/confirm-token.js';
import { getAuthorizationRequirement } from '../src/auth/policy.js';
import { issueSessionToken } from '../src/auth/session-token.js';
import { loadConfig } from '../src/config.js';

const TEST_DATA_ROOT = process.env.COE_SERVER_TEST_DATA_ROOT ?? path.join(os.tmpdir(), 'coe_for_agent_server_test');
const TEST_LOCAL_ISSUER_SECRET = 'local-test-secret';
const MUTATION_TOOL_NAME_SET = new Set<string>(MUTATION_TOOL_NAMES);

export const DEFAULT_TEST_ACTOR_CONTEXT: ActorContext = {
  actorType: 'user',
  actorId: 'reviewer-test-user',
  sessionId: 'reviewer-test-session',
  role: 'Reviewer',
  issuer: 'local-test',
  authMode: 'local'
};

export function issueTestSessionToken(actor: ActorContext = DEFAULT_TEST_ACTOR_CONTEXT): {
  sessionToken: string;
  actorContext: ActorContext;
} {
  const result = issueSessionToken(
    {
      actorType: actor.actorType,
      actorId: actor.actorId,
      sessionId: actor.sessionId,
      role: actor.role,
      issuer: actor.issuer,
      authMode: actor.authMode
    },
    TEST_LOCAL_ISSUER_SECRET
  );

  return {
    sessionToken: result.sessionToken,
    actorContext: result.actorContext
  };
}

export function issueTestAdminConfirmToken(caseId: string, actor: ActorContext = DEFAULT_TEST_ACTOR_CONTEXT): string {
  return issueConfirmToken(
    {
      commandName: 'admin.rebuild_projection',
      caseId,
      targetIds: [caseId],
      sessionId: actor.sessionId,
      role: actor.role,
      issuer: actor.issuer,
      reasonHash: hashConfirmationReason('rebuild-projection')
    },
    TEST_LOCAL_ISSUER_SECRET
  );
}

export function createAdminPool() {
  return {
    async end(): Promise<void> {
      return Promise.resolve();
    }
  };
}

export async function assertServerTestDatabaseAvailable(_pool: ReturnType<typeof createAdminPool>): Promise<void> {
  return Promise.resolve();
}

export async function resetServerTestDatabase(_pool: ReturnType<typeof createAdminPool>): Promise<void> {
  mkdirSync(TEST_DATA_ROOT, { recursive: true });
}

export async function createTestApp(): Promise<InvestigationApp> {
  mkdirSync(TEST_DATA_ROOT, { recursive: true });
  const testDataDir = mkdtempSync(path.join(TEST_DATA_ROOT, 'run-'));
  const app = await buildInvestigationApp({
    config: loadConfig({
      COE_DATA_DIR: testDataDir,
      MCP_TRANSPORT: 'stdio',
      LOCAL_ISSUER_SECRET: TEST_LOCAL_ISSUER_SECRET,
      APP_VERSION: '0.1.0-test'
    })
  });

  const baseInvokeTool = app.mcpServer.invokeTool.bind(app.mcpServer);
  const proxiedServer = Object.create(app.mcpServer) as InvestigationApp['mcpServer'];

  proxiedServer.invokeTool = ((name: string, input: Record<string, unknown>) => {
    const nextInput = MUTATION_TOOL_NAME_SET.has(name)
      ? withTestAuthEnvelope(name, input)
      : input;

    return baseInvokeTool(name as never, nextInput as never);
  }) as InvestigationApp['mcpServer']['invokeTool'];

  app.mcpServer = proxiedServer;
  return app;
}

function withTestAuthEnvelope(commandName: string, input: Record<string, unknown>): Record<string, unknown> {
  const actorContext = isActorContext(input.actorContext) ? input.actorContext : DEFAULT_TEST_ACTOR_CONTEXT;
  const nextInput: Record<string, unknown> = {
    ...input,
    actorContext
  };
  const requirement = getAuthorizationRequirement(commandName, nextInput);

  if (requirement.requiresConfirmToken && typeof nextInput.confirmToken !== 'string' && requirement.caseId) {
    nextInput.confirmToken = issueConfirmToken(
      {
        commandName,
        caseId: requirement.caseId,
        targetIds: requirement.targetIds,
        sessionId: actorContext.sessionId,
        role: actorContext.role,
        issuer: actorContext.issuer,
        reasonHash: hashConfirmationReason(requirement.reasonText)
      },
      TEST_LOCAL_ISSUER_SECRET
    );
  }

  return nextInput;
}

function isActorContext(value: unknown): value is ActorContext {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && typeof (value as Record<string, unknown>).actorType === 'string'
    && typeof (value as Record<string, unknown>).actorId === 'string'
    && typeof (value as Record<string, unknown>).sessionId === 'string'
    && typeof (value as Record<string, unknown>).role === 'string'
    && typeof (value as Record<string, unknown>).issuer === 'string'
    && typeof (value as Record<string, unknown>).authMode === 'string';
}
