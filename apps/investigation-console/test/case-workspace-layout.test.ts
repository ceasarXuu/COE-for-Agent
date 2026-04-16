import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

describe('case workspace layout', () => {
  test('renders the case graph in the main column and keeps only the control rail alongside it', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    const graphIndex = source.indexOf('<GraphCanvas');
    const actionIndex = source.indexOf('<ActionPanel');
    const sideRailIndex = source.indexOf('workspace-rail workspace-rail-side');

    expect(graphIndex).toBeGreaterThan(-1);
    expect(actionIndex).toBeGreaterThan(-1);
    expect(sideRailIndex).toBeGreaterThan(-1);
    expect(source).not.toContain('<SnapshotView');
    expect(source).not.toContain('workspace-rail workspace-rail-summary');
    expect(graphIndex).toBeLessThan(sideRailIndex);
    expect(actionIndex).toBeGreaterThan(sideRailIndex);
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

  test('does not render the snapshot panel while still feeding snapshot context into the graph and action rail', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    expect(source).toContain('snapshot={workspace.snapshot}');
    expect(source).not.toContain('<SnapshotView');
    expect(source).not.toContain('data-testid="snapshot-panel"');
  });

  test('renders the guardrail module in the side rail and leaves the diff module removed', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    expect(source).toContain('<GuardrailView');
    expect(source).not.toContain('data-testid="workspace-diff-panel"');
    expect(source).not.toContain("t('workspace.diff')");
  });

  test('renders inspector and action modules and loads their data from panel resources', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    expect(source).toContain('<InspectorPanel');
    expect(source).toContain('<ActionPanel');
    expect(source).toContain('getGuardrails(');
    expect(source).toContain('getHypothesisPanel(');
    expect(source).toContain('getInquiryPanel(');
  });

  test('stretches the graph and timeline stages to the available viewport height', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );
    const css = readFileSync(
      resolve(import.meta.dirname, '../src/styles/app.css'),
      'utf8'
    );
    const layoutCss = readFileSync(
      resolve(import.meta.dirname, '../src/styles/molecules/layout.css'),
      'utf8'
    );

    expect(source).toContain('className="workspace-grid"');
    expect(source).toContain('className="panel graph-stage workspace-stage-fill"');
    expect(css).toContain('grid-template-rows: minmax(0, 1fr);');
    expect(css).toContain('align-items: stretch;');
    expect(css).toContain('.workspace-stage-fill');
    expect(css).toContain('.timeline-stage');
    expect(css).toContain('overflow: auto;');
    expect(layoutCss).toContain('height: 100vh;');
    expect(layoutCss).toContain('overflow: hidden;');
  });
});
