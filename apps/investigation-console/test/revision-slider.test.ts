import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

describe('revision slider', () => {
  test('keeps a local draft value, avoids duplicate input handlers, and makes each revision marker a clickable hover target', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/components/revision-slider.tsx'),
      'utf8'
    );
    const css = readFileSync(
      resolve(import.meta.dirname, '../src/styles/app.css'),
      'utf8'
    );

    expect(source).toContain("from 'react'");
    expect(source).toContain('useState(props.currentRevision)');
    expect(source).toContain('setDraftRevision(props.currentRevision);');
    expect(source).toContain('value={draftRevision}');
    expect(source).toContain('revision-marker-row');
    expect(source).toContain('revision-marker-slot');
    expect(source).toContain('revision-hover-bubble');
    expect(source).toContain('onClick={() => handleRevisionChange(String(marker))}');
    expect(source).toContain('type="button"');
    expect(source).toContain('data-testid={`revision-marker-${marker}`}');
    expect(css).toContain('inset: 50% 0 auto 0;');
    expect(source).not.toContain('revision-scale');
    expect(source).not.toContain('onInput=');
  });
});
