import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
import { buildCoverageScenario } from '../support/resource-scenarios.js';

describe.sequential('coverage resource', () => {
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

  test('classifies direct, indirect, and uncovered symptoms', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildCoverageScenario(app);
      const coverage = await app.mcpServer.readResource(`investigation://cases/${scenario.caseId}/coverage`);
      const items = (coverage.data as { data: { items: Array<{ symptomId: string; coverage: string }> } }).data.items;

      expect(items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ symptomId: scenario.directSymptomId, coverage: 'direct' }),
          expect.objectContaining({ symptomId: scenario.indirectSymptomId, coverage: 'indirect' }),
          expect.objectContaining({ symptomId: scenario.uncoveredSymptomId, coverage: 'none' })
        ])
      );
      expect(coverage.data).toMatchObject({
        data: {
          summary: {
            direct: 1,
            indirect: 1,
            none: 1
          }
        }
      });
    } finally {
      await app.close();
    }
  });
});