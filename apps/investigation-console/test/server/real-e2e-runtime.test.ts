import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { prepareRealE2ERuntime } from '../../server/real-e2e-runtime.js';

describe('real backend e2e runtime', () => {
  test('uses isolated persistence and artifact directories by default', async () => {
    const runtime = await prepareRealE2ERuntime({
      cwd: '/tmp/coe-investigation',
      env: {}
    });

    expect(runtime.dataDir.startsWith(path.join('/tmp/coe-investigation', '.tmp', 'investigation-console-real-e2e-'))).toBe(true);
    expect(runtime.dataDir).toBe(path.join(runtime.runtimeRoot, 'data'));
    expect(runtime.artifactRoot).toBe(path.join(runtime.runtimeRoot, 'artifacts'));
    expect(runtime.dataDir).not.toBe(path.join('/tmp/coe-investigation', '.var', 'data'));
    expect(runtime.shouldCleanup).toBe(true);

    await runtime.cleanup();
  });
});
