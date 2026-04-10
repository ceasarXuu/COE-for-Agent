import { describe, expect, test } from 'vitest';

import viteConfig from '../vite.config.ts';

describe('vite dev server config', () => {
  test('binds the dev server to 127.0.0.1 so start.sh can open the same URL', () => {
    expect(viteConfig.server?.host).toBe('127.0.0.1');
    expect(viteConfig.server?.port).toBe(4173);
  });
});
