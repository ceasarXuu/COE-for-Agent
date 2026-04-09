import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ConsoleMcpClient } from './mcp-types.js';
import { buildConsoleServer } from './index.js';
import { createLocalMcpClient } from './mcp-client.js';

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
  const mcpClient = await createLocalMcpClient();

  try {
    const seed = await seedRealBackendCase(mcpClient);
    await mkdir(path.dirname(SEED_STATE_FILE), { recursive: true });
    await writeFile(SEED_STATE_FILE, JSON.stringify(seed, null, 2));

    const app = await buildConsoleServer({
      mcpClient,
      sessionSecret: E2E_SECRET
    });

    const shutdown = async () => {
      await app.close();
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
    await mcpClient.close();
    throw error;
  }
}

async function seedRealBackendCase(mcpClient: ConsoleMcpClient) {
  const suffix = `${Date.now()}`;
  const opened = await invokeMutation(mcpClient, 'investigation.case.open', {
    idempotencyKey: `console-real-case-open-${suffix}`,
    title: `Real backend case ${suffix}`,
    objective: `Validate real backend console flow ${suffix}`,
    severity: 'critical'
  });
  const caseId = requiredId(opened, 'case_');
  const inquiryId = requiredId(opened, 'inquiry_');
  let revision = opened.headRevisionAfter;

  revision = (await invokeMutation(mcpClient, 'investigation.case.advance_stage', {
    idempotencyKey: `console-real-stage-${suffix}-scoping`,
    caseId,
    ifCaseRevision: revision,
    stage: 'scoping',
    reason: 'advance to scoping'
  })).headRevisionAfter;

  revision = (await invokeMutation(mcpClient, 'investigation.case.advance_stage', {
    idempotencyKey: `console-real-stage-${suffix}-evidence`,
    caseId,
    ifCaseRevision: revision,
    stage: 'evidence_collection',
    reason: 'advance to evidence collection'
  })).headRevisionAfter;

  const symptom = await invokeMutation(mcpClient, 'investigation.symptom.report', {
    idempotencyKey: `console-real-symptom-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    statement: `critical symptom ${suffix}`,
    severity: 'critical',
    reproducibility: 'always'
  });
  const symptomId = requiredId(symptom, 'symptom_');
  revision = symptom.headRevisionAfter;

  const entity = await invokeMutation(mcpClient, 'investigation.entity.register', {
    idempotencyKey: `console-real-entity-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    entityKind: 'service',
    name: `worker-service-${suffix}`,
    locator: {
      kind: 'service',
      name: `worker-service-${suffix}`
    }
  });
  const entityId = requiredId(entity, 'entity_');
  revision = entity.headRevisionAfter;

  const artifact = await invokeMutation(mcpClient, 'investigation.artifact.attach', {
    idempotencyKey: `console-real-artifact-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    artifactKind: 'log',
    title: `worker trace ${suffix}`,
    source: {
      uri: `file:///tmp/${suffix}.log`
    },
    excerpt: `trace excerpt ${suffix}`
  });
  const artifactId = requiredId(artifact, 'artifact_');
  revision = artifact.headRevisionAfter;

  const fact = await invokeMutation(mcpClient, 'investigation.fact.assert', {
    idempotencyKey: `console-real-fact-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    statement: `fact ${suffix}`,
    factKind: 'test_result',
    polarity: 'positive',
    sourceArtifactIds: [artifactId],
    aboutRefs: [symptomId, entityId],
    observationScope: {
      scopeType: 'manual_observation',
      query: `query ${suffix}`
    }
  });
  const factId = requiredId(fact, 'fact_');
  revision = fact.headRevisionAfter;

  const hypothesis = await invokeMutation(mcpClient, 'investigation.hypothesis.propose', {
    idempotencyKey: `console-real-hypothesis-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    inquiryId,
    title: `hypothesis ${suffix}`,
    statement: `statement ${suffix}`,
    level: 'mechanism',
    explainsSymptomIds: [symptomId],
    dependsOnFactIds: [factId],
    falsificationCriteria: [`falsify ${suffix}`]
  });
  const hypothesisId = requiredId(hypothesis, 'hypothesis_');
  revision = hypothesis.headRevisionAfter;

  revision = (await invokeMutation(mcpClient, 'investigation.case.advance_stage', {
    idempotencyKey: `console-real-stage-${suffix}-competition`,
    caseId,
    ifCaseRevision: revision,
    stage: 'hypothesis_competition',
    reason: 'advance to hypothesis competition'
  })).headRevisionAfter;

  revision = (await invokeMutation(mcpClient, 'investigation.hypothesis.update_status', {
    idempotencyKey: `console-real-hypothesis-status-${suffix}-active`,
    caseId,
    ifCaseRevision: revision,
    hypothesisId,
    newStatus: 'active',
    reason: 'set active'
  })).headRevisionAfter;

  revision = (await invokeMutation(mcpClient, 'investigation.hypothesis.update_status', {
    idempotencyKey: `console-real-hypothesis-status-${suffix}-favored`,
    caseId,
    ifCaseRevision: revision,
    hypothesisId,
    newStatus: 'favored',
    reason: 'set favored'
  })).headRevisionAfter;

  revision = (await invokeMutation(mcpClient, 'investigation.case.advance_stage', {
    idempotencyKey: `console-real-stage-${suffix}-testing`,
    caseId,
    ifCaseRevision: revision,
    stage: 'discriminative_testing',
    reason: 'advance to discriminative testing'
  })).headRevisionAfter;

  return {
    caseId,
    inquiryId,
    hypothesisId,
    searchTerm: suffix,
    title: `Real backend case ${suffix}`,
    headRevision: revision
  };
}

async function invokeMutation(mcpClient: ConsoleMcpClient, toolName: string, payload: Record<string, unknown>) {
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
