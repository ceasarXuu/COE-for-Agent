import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

describe('case workspace layout', () => {
  test('renders the case graph before the timeline in the main column', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    const graphIndex = source.indexOf('<GraphCanvas');
    const timelineIndex = source.indexOf('<TimelineView');

    expect(graphIndex).toBeGreaterThan(-1);
    expect(timelineIndex).toBeGreaterThan(-1);
    expect(graphIndex).toBeLessThan(timelineIndex);
  });

  test('does not render the coverage preview module in the workspace rail', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    expect(source).not.toContain('<CoverageView');
  });

  test('does not request a focused subgraph when a node is selected', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    expect(source).toContain('getCaseGraph(caseId, { revision })');
    expect(source).not.toContain('focusId: selectedNodeId');
    expect(source).not.toContain('focusId={selectedNodeId}');
  });
});
