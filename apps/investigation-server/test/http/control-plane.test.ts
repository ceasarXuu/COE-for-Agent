import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
import { buildProvScenario, buildReplayScenario } from '../support/resource-scenarios.js';

describe.sequential('control plane routes', () => {
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

  test('serves health, readiness, and version metadata', async () => {
    const app = await createTestApp();

    try {
      const [healthz, readyz, version] = await Promise.all([
        app.inject({ method: 'GET', url: '/healthz' }),
        app.inject({ method: 'GET', url: '/readyz' }),
        app.inject({ method: 'GET', url: '/version' })
      ]);

      expect(healthz.statusCode).toBe(200);
      expect(healthz.json()).toMatchObject({ ok: true, service: 'investigation-server' });
      expect(readyz.statusCode).toBe(200);
      expect(readyz.json()).toMatchObject({ ok: true, transport: 'stdio' });
      expect(version.statusCode).toBe(200);
      expect(version.json()).toMatchObject({ version: '0.1.0-test' });
    } finally {
      await app.close();
    }
  });

  test('serves PROV and event exports over the control plane', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildProvScenario(app);
      const provResponse = await app.inject({
        method: 'GET',
        url: `/cases/${scenario.caseId}/export/prov`
      });
      const eventsResponse = await app.inject({
        method: 'GET',
        url: `/cases/${scenario.caseId}/export/events`
      });

      expect(provResponse.statusCode).toBe(200);
      expect(provResponse.json()).toMatchObject({
        caseId: scenario.caseId,
        entities: expect.arrayContaining([
          expect.objectContaining({ id: scenario.artifactId, kind: 'artifact' }),
          expect.objectContaining({ id: scenario.factId, kind: 'fact' })
        ])
      });

      expect(eventsResponse.statusCode).toBe(200);
      expect(eventsResponse.json()).toMatchObject({
        caseId: scenario.caseId,
        events: expect.arrayContaining([
          expect.objectContaining({ type: 'case.opened' }),
          expect.objectContaining({ type: 'artifact.attached' }),
          expect.objectContaining({ type: 'fact.asserted' })
        ])
      });
    } finally {
      await app.close();
    }
  });

  test('rebuilds a requested projection revision and persists a checkpoint', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildReplayScenario(app);
      const response = await app.inject({
        method: 'POST',
        url: '/admin/rebuild-projection',
        payload: {
          caseId: scenario.caseId,
          revision: 2
        }
      });

      const checkpoint = await app.services.db
        .selectFrom('case_projection_checkpoints')
        .select(['case_id', 'revision'])
        .where('case_id', '=', scenario.caseId)
        .where('revision', '=', 2)
        .executeTakeFirst();

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        ok: true,
        caseId: scenario.caseId,
        requestedRevision: 2,
        projectionRevision: 2,
        headRevision: 3
      });
      expect(checkpoint).toEqual({
        case_id: scenario.caseId,
        revision: 2
      });
    } finally {
      await app.close();
    }
  });
});