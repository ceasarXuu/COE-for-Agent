import { describe, expect, test } from 'vitest';

import playwrightConfig from '../playwright.config.js';

describe('playwright config', () => {
  test('defaults the browser baseURL to the console web port', () => {
    expect(playwrightConfig.use?.baseURL).toBe('http://127.0.0.1:4173');
  });
});
