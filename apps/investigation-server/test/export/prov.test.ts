import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
import { buildProvExport } from '../../src/modules/export/prov.js';
import { buildProvScenario } from '../support/resource-scenarios.js';

describe.sequential('prov export', () => {
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

  test('builds a PROV-compatible package for evidence lineage', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildProvScenario(app);
      const bundle = await buildProvExport(app.services, scenario.caseId);

      expect(bundle).toMatchObject({
        caseId: scenario.caseId,
        entities: expect.arrayContaining([
          expect.objectContaining({ id: scenario.evidenceId, kind: 'evidence' }),
          expect.objectContaining({ id: scenario.evidenceRefId, kind: 'evidence_ref' })
        ]),
        relations: {
          used: expect.arrayContaining([
            expect.objectContaining({ entityId: scenario.evidenceId })
          ]),
          wasGeneratedBy: expect.arrayContaining([
            expect.objectContaining({ entityId: scenario.evidenceRefId, activityType: 'canonical.evidence.attached' })
          ])
        }
      });
    } finally {
      await app.close();
    }
  });
});
