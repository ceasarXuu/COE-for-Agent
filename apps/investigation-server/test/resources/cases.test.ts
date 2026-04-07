import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('cases collection resource', () => {
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

  test('returns sorted and filtered cases from the case list projection', async () => {
    const app = await createTestApp();

    await app.mcpServer.invokeTool('investigation.case.open', {
      idempotencyKey: 'case-open-a',
      title: 'Zulu duplicate',
      objective: 'Investigate Zulu flow',
      severity: 'high'
    });
    await app.mcpServer.invokeTool('investigation.case.open', {
      idempotencyKey: 'case-open-b',
      title: 'Alpha timeout',
      objective: 'Investigate Alpha timeout',
      severity: 'medium'
    });
    await app.mcpServer.invokeTool('investigation.case.open', {
      idempotencyKey: 'case-open-c',
      title: 'Beta timeout',
      objective: 'Investigate Beta timeout',
      severity: 'low'
    });

    const resource = await app.mcpServer.readResource(
      'investigation://cases?status=active&search=timeout&sort=title:asc&page=1&pageSize=2'
    );

    expect(resource.data).toMatchObject({
      data: {
        items: [
          expect.objectContaining({ title: 'Alpha timeout', status: 'active' }),
          expect.objectContaining({ title: 'Beta timeout', status: 'active' })
        ]
      }
    });

    await app.close();
  });
});