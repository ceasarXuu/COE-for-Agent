import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

describe('graph canvas mode', () => {
  test('supports draft-node creation from canonical graph handles without legacy overlays or autosave flows', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/components/graph/GraphCanvas.tsx'),
      'utf8'
    );

    expect(source).not.toContain('isCanonicalGraphProjection');
    expect(source).not.toContain('useGraphOverlay');
    expect(source).toContain('onCreateDraftNode');
    expect(source).toContain('pendingDraftCreate');
    expect(source).not.toContain('onPaneContextMenu=');
  });
});
