import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
import { buildEventExport } from '../../src/modules/export/events.js';
import { buildProvScenario } from '../support/resource-scenarios.js';

describe.sequential('event export', () => {
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

  test('emits CloudEvents that match the published event schema ids and flattened data shape', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildProvScenario(app);
      const exported = await buildEventExport(app.services, scenario.caseId);
      const evidenceAttachedEvent = exported.events.find((event) => event.type === 'canonical.evidence.attached');

      expect(evidenceAttachedEvent).toMatchObject({
        dataschema: 'https://schemas.coe.local/events/v1/canonical.evidence.attached.data.schema.json',
        data: {
          eventId: expect.any(String),
          caseId: scenario.caseId,
          caseRevision: 7,
          evidenceRefId: scenario.evidenceRefId,
          evidenceId: scenario.evidenceId,
          parentNodeId: scenario.repairAttemptId,
          effectOnParent: 'validates'
        }
      });
      expect(evidenceAttachedEvent?.data).not.toHaveProperty('payload');
      expect(evidenceAttachedEvent?.data).not.toHaveProperty('metadata');
    } finally {
      await app.close();
    }
  });
});
