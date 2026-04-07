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
      const factEvent = exported.events.find((event) => event.type === 'fact.asserted');

      expect(factEvent).toMatchObject({
        dataschema: 'https://schemas.coe.local/events/v1/fact.asserted.data.schema.json',
        data: {
          eventId: expect.any(String),
          caseId: scenario.caseId,
          caseRevision: 3,
          factId: scenario.factId,
          statement: 'measured fact',
          factKind: 'direct_observation',
          polarity: 'positive'
        }
      });
      expect(factEvent?.data).not.toHaveProperty('payload');
      expect(factEvent?.data).not.toHaveProperty('metadata');
    } finally {
      await app.close();
    }
  });
});