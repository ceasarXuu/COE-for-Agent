import { Pool } from 'pg';

import type { ActorContext } from '@coe/domain';
import { MUTATION_TOOL_NAMES, type MutationToolName } from '@coe/mcp-contracts/tool-names';

import { buildInvestigationApp, type InvestigationApp } from '../src/app.js';
import { issueConfirmToken, hashConfirmationReason } from '../src/auth/confirm-token.js';
import { getAuthorizationRequirement } from '../src/auth/policy.js';
import { loadConfig } from '../src/config.js';

const ADMIN_DATABASE_URL = process.env.COE_SERVER_ADMIN_DATABASE_URL ?? 'postgresql:///postgres';
const TEST_DATABASE_NAME = process.env.COE_SERVER_TEST_DATABASE_NAME ?? 'coe_for_agent_test';
const TEST_DATABASE_URL = process.env.COE_SERVER_TEST_DATABASE_URL ?? `postgresql:///${TEST_DATABASE_NAME}`;
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

export function createAdminPool(): Pool {
  return new Pool({ connectionString: ADMIN_DATABASE_URL, max: 1 });
}

export async function assertServerTestDatabaseAvailable(pool: Pool): Promise<void> {
  await pool.query('select 1');
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export async function resetServerTestDatabase(pool: Pool): Promise<void> {
  await pool.query(
    'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
    [TEST_DATABASE_NAME]
  );
  await pool.query(`drop database if exists ${quoteIdentifier(TEST_DATABASE_NAME)}`);
  await pool.query(`create database ${quoteIdentifier(TEST_DATABASE_NAME)}`);
}

export async function createTestApp(): Promise<InvestigationApp> {
  const app = await buildInvestigationApp({
    config: loadConfig({
      DATABASE_URL: TEST_DATABASE_URL,
      MCP_TRANSPORT: 'stdio',
      LOCAL_ISSUER_SECRET: TEST_LOCAL_ISSUER_SECRET,
      ARTIFACT_ROOT: './tmp/artifacts',
      APP_VERSION: '0.1.0-test'
    })
  });

  const baseInvokeTool = app.mcpServer.invokeTool.bind(app.mcpServer);
  const proxiedServer = Object.create(app.mcpServer) as InvestigationApp['mcpServer'];

  proxiedServer.invokeTool = ((name: string, input: Record<string, unknown>) => {
    const nextInput = MUTATION_TOOL_NAME_SET.has(name)
      ? withTestAuthEnvelope(name as MutationToolName, input)
      : input;

    return baseInvokeTool(name as never, nextInput as never);
  }) as InvestigationApp['mcpServer']['invokeTool'];

  app.mcpServer = proxiedServer;
  return app;
}

export { TEST_DATABASE_URL };

function withTestAuthEnvelope(commandName: MutationToolName, input: Record<string, unknown>): Record<string, unknown> {
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