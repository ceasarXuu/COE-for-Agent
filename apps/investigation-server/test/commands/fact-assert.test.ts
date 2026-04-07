import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('fact.assert command', () => {
  const adminPool = createAdminPool();

  beforeAll(async () => {
    await assertServerTestDatabaseAvailable(adminPool);
  });

  beforeEach(async () => {
    await resetServerTestDatabase(adminPool);
  });

  afterAll(async () => {
    await adminPool.end();
  });

  test('rejects fact.assert without sourceArtifactIds', async () => {
    const app = await createTestApp();
    const opened = await app.mcpServer.invokeTool('investigation.case.open', {
      idempotencyKey: 'open-001',
      title: 'Duplicate delivery',
      objective: 'Find the duplication source',
      severity: 'high'
    });
    const caseId = opened.createdIds?.find((value) => value.startsWith('case_'));

    await expect(
      app.mcpServer.invokeTool('investigation.fact.assert', {
        idempotencyKey: 'fact-001',
        caseId,
        ifCaseRevision: 1,
        statement: 'duplicate messages observed',
        factKind: 'direct_observation',
        polarity: 'positive'
      })
    ).rejects.toThrow(/sourceArtifactIds/i);

    await app.close();
  });

  test('rejects negative fact.assert without observationScope', async () => {
    const app = await createTestApp();
    const opened = await app.mcpServer.invokeTool('investigation.case.open', {
      idempotencyKey: 'open-002',
      title: 'Cache invalidation',
      objective: 'Verify invalidation path',
      severity: 'medium'
    });
    const caseId = opened.createdIds?.find((value) => value.startsWith('case_'));

    await expect(
      app.mcpServer.invokeTool('investigation.fact.assert', {
        idempotencyKey: 'fact-002',
        caseId,
        ifCaseRevision: 1,
        statement: 'no invalidation found',
        factKind: 'absence_observation',
        polarity: 'negative',
        sourceArtifactIds: ['artifact_01AAAAAAAAAAAAAAAAAAAAAAAA']
      })
    ).rejects.toThrow(/observationScope/i);

    await app.close();
  });

  test('rejects existing case command without ifCaseRevision', async () => {
    const app = await createTestApp();
    const opened = await app.mcpServer.invokeTool('investigation.case.open', {
      idempotencyKey: 'open-003',
      title: 'Symptom missing revision',
      objective: 'Require optimistic concurrency',
      severity: 'low'
    });
    const caseId = opened.createdIds?.find((value) => value.startsWith('case_'));

    await expect(
      app.mcpServer.invokeTool('investigation.symptom.report', {
        idempotencyKey: 'symptom-001',
        caseId,
        statement: 'users see duplicate toasts',
        severity: 'medium',
        reproducibility: 'often'
      })
    ).rejects.toThrow(/ifCaseRevision/i);

    await app.close();
  });

  test('reuses the original fact.assert result for a duplicate idempotency key', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'open-004',
        title: 'Duplicate fact assertion',
        objective: 'Ensure retries do not write twice',
        severity: 'high'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;

      const artifact = await app.mcpServer.invokeTool('investigation.artifact.attach', {
        idempotencyKey: 'artifact-duplicate-001',
        caseId,
        ifCaseRevision: 1,
        artifactKind: 'log',
        title: 'application log',
        source: {
          uri: 'file:///tmp/app.log'
        },
        excerpt: 'duplicate retry record'
      });
      const artifactId = artifact.createdIds?.find((value) => value.startsWith('artifact_'))!;
      const input = {
        idempotencyKey: 'fact-duplicate-001',
        caseId,
        ifCaseRevision: 2,
        statement: 'duplicate retry observed once',
        factKind: 'direct_observation',
        polarity: 'positive' as const,
        sourceArtifactIds: [artifactId]
      };

      const first = await app.mcpServer.invokeTool('investigation.fact.assert', input);
      const second = await app.mcpServer.invokeTool('investigation.fact.assert', input);
      const snapshot = await app.mcpServer.readResource(`investigation://cases/${caseId}/snapshot`);
      const timeline = await app.mcpServer.readResource(`investigation://cases/${caseId}/timeline`);

      expect(second).toEqual(first);
      expect((snapshot.data as { data: { counts: { facts: number } } }).data.counts.facts).toBe(1);
      expect(
        (timeline.data as { data: { events: Array<{ eventType: string }> } }).data.events.filter(
          (event) => event.eventType === 'fact.asserted'
        )
      ).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});