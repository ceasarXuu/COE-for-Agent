import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ConsoleMcpClient, ConsoleMcpToolName } from './mcp-types.js';
import { buildConsoleServer } from './index.js';
import { createLocalMcpClient } from './mcp-client.js';
import { prepareRealE2ERuntime } from './real-e2e-runtime.js';

const PORT = Number(process.env.CONSOLE_BFF_PORT ?? '4318');
const SEED_STATE_FILE = process.env.REAL_E2E_SEED_FILE ?? path.join(process.cwd(), 'test-results', 'real-backend-seed.json');
const E2E_SECRET = 'local-e2e-secret';

const ACTOR_CONTEXT = {
  actorType: 'user',
  actorId: 'console-reviewer',
  sessionId: 'console-e2e-real-session',
  role: 'Reviewer',
  issuer: 'local-console-e2e',
  authMode: 'local'
} as const;

async function main() {
  process.env.LOCAL_ISSUER_SECRET = E2E_SECRET;
  const runtime = await prepareRealE2ERuntime();
  process.env.COE_DATA_DIR = runtime.dataDir;
  process.env.ARTIFACT_ROOT = runtime.artifactRoot;

  console.info('[investigation-console] real-backend-e2e-runtime', {
    event: 'real_backend_e2e.runtime_prepared',
    runtimeRoot: runtime.runtimeRoot,
    dataDir: runtime.dataDir,
    artifactRoot: runtime.artifactRoot,
    shouldCleanup: runtime.shouldCleanup
  });

  let mcpClient: ConsoleMcpClient | null = null;

  try {
    mcpClient = await createLocalMcpClient();

    const seed = await seedRealBackendCase(mcpClient);
    await mkdir(path.dirname(SEED_STATE_FILE), { recursive: true });
    await writeFile(SEED_STATE_FILE, JSON.stringify(seed, null, 2));
    console.info('[investigation-console] real-backend-e2e-seeded', {
      event: 'real_backend_e2e.case_seeded',
      caseId: seed.caseId,
      problemId: seed.problemId,
      hypothesisId: seed.hypothesisId,
      searchTerm: seed.searchTerm,
      headRevision: seed.headRevision,
      seedFile: SEED_STATE_FILE
    });

    const app = await buildConsoleServer({
      mcpClient,
      sessionSecret: E2E_SECRET,
      defaultActor: {
        actorType: 'user',
        actorId: ACTOR_CONTEXT.actorId,
        role: ACTOR_CONTEXT.role,
        issuer: ACTOR_CONTEXT.issuer,
        authMode: ACTOR_CONTEXT.authMode
      }
    });

    const shutdown = async () => {
      await app.close();
      await runtime.cleanup();
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
  } catch (error) {
    await mcpClient?.close();
    await runtime.cleanup();
    throw error;
  }
}

async function seedRealBackendCase(mcpClient: ConsoleMcpClient) {
  const suffix = `${Date.now()}`;
  const opened = await invokeMutation(mcpClient, 'investigation.case.open', {
    idempotencyKey: `console-real-case-open-${suffix}`,
    title: `Real backend case ${suffix}`,
    objective: `Validate real backend console flow ${suffix}`,
    severity: 'critical',
    projectDirectory: `/workspace/real-backend-${suffix}`
  });
  const caseId = requiredId(opened, 'case_');
  const problemId = requiredId(opened, 'problem_');
  let revision = opened.headRevisionAfter;

  revision = (await invokeMutation(mcpClient, 'investigation.problem.update', {
    idempotencyKey: `console-real-problem-update-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    problemId,
    environment: `real-backend-env-${suffix}`,
    symptoms: [`critical symptom ${suffix}`],
    resolutionCriteria: [`resolution criteria ${suffix}`]
  })).headRevisionAfter;

  const hypothesis = await invokeMutation(mcpClient, 'investigation.hypothesis.create', {
    idempotencyKey: `console-real-hypothesis-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    parentNodeId: problemId,
    statement: `statement ${suffix}`,
    falsificationCriteria: [`falsify ${suffix}`]
  });
  const hypothesisId = requiredId(hypothesis, 'hypothesis_');
  revision = hypothesis.headRevisionAfter;

  return {
    caseId,
    problemId,
    hypothesisId,
    searchTerm: suffix,
    title: `Real backend case ${suffix}`,
    headRevision: revision
  };
}

async function invokeMutation(mcpClient: ConsoleMcpClient, toolName: ConsoleMcpToolName, payload: Record<string, unknown>) {
  return mcpClient.invokeTool(toolName, {
    ...payload,
    actorContext: ACTOR_CONTEXT
  }) as Promise<{
    headRevisionAfter: number;
    createdIds?: string[];
  }>;
}

function requiredId(result: { createdIds?: string[] }, prefix: string): string {
  const id = result.createdIds?.find((value) => value.startsWith(prefix));

  if (!id) {
    throw new Error(`Missing ${prefix} identifier in command result`);
  }

  return id;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
