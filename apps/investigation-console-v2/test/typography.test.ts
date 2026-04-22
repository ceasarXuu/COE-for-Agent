import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

describe('v2 typography defaults', () => {
  test('forces lining and tabular numerals so digits do not wobble vertically', () => {
    const css = readFileSync(
      resolve(import.meta.dirname, '../../../packages/ui/src/styles/globals.css'),
      'utf8'
    );

    expect(css).toContain('font-variant-numeric: lining-nums tabular-nums;');
    expect(css).toContain('font-feature-settings: "lnum" 1, "tnum" 1;');
  });
});
