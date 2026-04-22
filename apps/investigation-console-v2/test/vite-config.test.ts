import { describe, expect, test } from 'vitest';

import viteConfig from '../vite.config.js';

describe('vite dev server config', () => {
  test('binds the v2 dev server to 127.0.0.1 with the dedicated v2 port', () => {
    expect(viteConfig.server?.host).toBe('127.0.0.1');
    expect(viteConfig.server?.port).toBe(4273);
  });
});
