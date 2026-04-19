import { describe, expect, test } from 'vitest';
import path from 'node:path';

import { loadConfig } from '../src/config.js';

describe('server config', () => {
  test('prefers COE_DATA_DIR over DATABASE_URL for local persistence', () => {
    const config = loadConfig({
      COE_DATA_DIR: './tmp/data'
    });

    expect(config.dataDir).toBe(path.resolve('/Volumes/XU-1TB-NPM/projects/COE-for-Agent', './tmp/data'));
  });
});
