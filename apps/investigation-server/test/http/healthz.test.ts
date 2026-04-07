import { afterAll, describe, expect, test } from 'vitest';

import { buildInvestigationApp } from '../../src/app.js';

describe('control plane health endpoints', () => {
  test('returns 200 for healthz and readyz', async () => {
    const app = await buildInvestigationApp();

    const healthz = await app.inject({
      method: 'GET',
      url: '/healthz'
    });
    const readyz = await app.inject({
      method: 'GET',
      url: '/readyz'
    });

    expect(healthz.statusCode).toBe(200);
    expect(healthz.json()).toMatchObject({ ok: true });
    expect(readyz.statusCode).toBe(200);
    expect(readyz.json()).toMatchObject({ ok: true });

    await app.close();
  });
});