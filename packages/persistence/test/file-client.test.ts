import { existsSync, mkdtempSync, renameSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { createPersistenceClient } from '../src/client.js';

describe('file persistence client', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        if (existsSync(dir)) {
          renameSync(dir, `${dir}.completed`);
        }
      }
    }
  });

  test('initializes a file-backed persistence directory without any database server', async () => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'coe-persistence-'));
    tempDirs.push(dataDir);

    const client = createPersistenceClient({ dataDir });

    expect(client.dataDir).toBe(dataDir);
    expect(typeof client.destroy).toBe('function');

    await client.destroy();
  });
});
