import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

describe('case workspace layout', () => {
  test('renders the case graph in the main column and mounts the timeline in the side rail', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    const graphIndex = source.indexOf('<GraphCanvas');
    const timelineIndex = source.indexOf('<TimelineView');
    const sideRailIndex = source.indexOf('workspace-rail workspace-rail-side');

    expect(graphIndex).toBeGreaterThan(-1);
    expect(timelineIndex).toBeGreaterThan(-1);
    expect(sideRailIndex).toBeGreaterThan(-1);
    expect(graphIndex).toBeLessThan(sideRailIndex);
    expect(timelineIndex).toBeGreaterThan(sideRailIndex);
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

  test('does not render inspector or action modules in the case detail layout', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    expect(source).not.toContain('<InspectorPanel');
    expect(source).not.toContain('<ActionPanel');
    expect(source).not.toContain('getCaseCoverage(');
    expect(source).not.toContain('getGuardrails(');
    expect(source).not.toContain('getHypothesisPanel(');
    expect(source).not.toContain('getInquiryPanel(');
  });
});
