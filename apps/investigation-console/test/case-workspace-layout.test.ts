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

  test('passes revision slider controls into the timeline module instead of rendering them in the header', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    expect(source).toContain('<TimelineView');
    expect(source).toContain('revisionControls={{');
    expect(source).not.toContain('<RevisionSlider');
  });

  test('does not render the workspace mode kicker above the case title', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    expect(source).not.toContain("t('workspace.headMode')");
    expect(source).not.toContain("t('workspace.historicalMode'");
  });

  test('renders the severity pill next to the workspace title instead of inside the graph module', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    expect(source).toContain('className="workspace-header-copy"');
    expect(source).toContain('className="workspace-title-row"');
    expect(source).toContain('workspace?.snapshot.data.case?.severity ? (');
    expect(source).toContain('formatEnumLabel(workspace.snapshot.data.case.severity)');
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

  test('embeds snapshot tags into the graph module instead of rendering a separate snapshot panel', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    expect(source).toContain('snapshot={workspace.snapshot}');
    expect(source).not.toContain('<SnapshotView');
  });

  test('does not render guardrail or diff modules in the side rail', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    expect(source).not.toContain('<GuardrailView');
    expect(source).not.toContain('data-testid="workspace-diff-panel"');
    expect(source).not.toContain("t('workspace.diff')");
  });
});
