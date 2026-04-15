import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

describe('revision slider', () => {
  test('keeps a local draft value and avoids duplicate input handlers during drag', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/components/revision-slider.tsx'),
      'utf8'
    );

    expect(source).toContain("from 'react'");
    expect(source).toContain('useState(props.currentRevision)');
    expect(source).toContain('setDraftRevision(props.currentRevision);');
    expect(source).toContain('value={draftRevision}');
    expect(source).not.toContain('onInput=');
  });
});
