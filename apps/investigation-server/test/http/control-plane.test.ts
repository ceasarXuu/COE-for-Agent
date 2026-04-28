import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  issueTestAdminConfirmToken,
  issueTestSessionToken,
  resetServerTestDatabase
} from '../test-app.js';
import { CheckpointRepository } from '@coe/persistence';
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
      const { sessionToken } = issueTestSessionToken();
      const provResponse = await app.inject({
        method: 'GET',
        url: `/cases/${scenario.caseId}/export/prov`,
        headers: { 'x-session-token': sessionToken }
      });
      const eventsResponse = await app.inject({
        method: 'GET',
        url: `/cases/${scenario.caseId}/export/events`,
        headers: { 'x-session-token': sessionToken }
      });

      expect(provResponse.statusCode).toBe(200);
      expect(provResponse.json()).toMatchObject({
        caseId: scenario.caseId,
        entities: expect.arrayContaining([
          expect.objectContaining({ id: scenario.evidenceId, kind: 'evidence' }),
          expect.objectContaining({ id: scenario.evidenceRefId, kind: 'evidence_ref' })
        ])
      });

      expect(eventsResponse.statusCode).toBe(200);
      expect(eventsResponse.json()).toMatchObject({
        caseId: scenario.caseId,
        events: expect.arrayContaining([
          expect.objectContaining({ type: 'case.opened' }),
          expect.objectContaining({ type: 'canonical.evidence.captured' }),
          expect.objectContaining({ type: 'canonical.evidence.attached' })
        ])
      });
    } finally {
      await app.close();
    }
  });

  test('rejects export requests without a valid session token', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildProvScenario(app);

      const noToken = await app.inject({
        method: 'GET',
        url: `/cases/${scenario.caseId}/export/prov`
      });
      expect(noToken.statusCode).toBe(401);

      const badToken = await app.inject({
        method: 'GET',
        url: `/cases/${scenario.caseId}/export/events`,
        headers: { 'x-session-token': 'not-a-valid-token' }
      });
      expect(badToken.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  test('rebuilds a requested projection revision and persists a checkpoint', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildReplayScenario(app);
      const { sessionToken } = issueTestSessionToken();
      const confirmToken = issueTestAdminConfirmToken(scenario.caseId);
      const response = await app.inject({
        method: 'POST',
        url: '/admin/rebuild-projection',
        headers: { 'x-session-token': sessionToken },
        payload: {
          caseId: scenario.caseId,
          revision: 2,
          confirmToken
        }
      });

      const checkpoint = await new CheckpointRepository(app.services.db).loadNearest(scenario.caseId, 2);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        ok: true,
        caseId: scenario.caseId,
        requestedRevision: 2,
        projectionRevision: 2,
        headRevision: 3
      });
      expect(checkpoint).toMatchObject({
        caseId: scenario.caseId,
        revision: 2
      });
    } finally {
      await app.close();
    }
  });

  test('rejects admin rebuild without session, role, or confirm token', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildReplayScenario(app);
      const { sessionToken: reviewerToken } = issueTestSessionToken();

      const noSession = await app.inject({
        method: 'POST',
        url: '/admin/rebuild-projection',
        payload: { caseId: scenario.caseId, revision: 2 }
      });
      expect(noSession.statusCode).toBe(401);

      const operatorActor = {
        actorType: 'user' as const,
        actorId: 'operator-test',
        sessionId: 'operator-session',
        role: 'Operator' as const,
        issuer: 'local-test',
        authMode: 'local' as const
      };
      const { sessionToken: operatorToken } = issueTestSessionToken(operatorActor);
      const lowRole = await app.inject({
        method: 'POST',
        url: '/admin/rebuild-projection',
        headers: { 'x-session-token': operatorToken },
        payload: { caseId: scenario.caseId, revision: 2 }
      });
      expect(lowRole.statusCode).toBe(403);

      const missingConfirm = await app.inject({
        method: 'POST',
        url: '/admin/rebuild-projection',
        headers: { 'x-session-token': reviewerToken },
        payload: { caseId: scenario.caseId, revision: 2 }
      });
      expect(missingConfirm.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
