import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

describe('case workspace layout', () => {
  test('renders a top revision strip above the graph and node editor instead of a left timeline rail', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    const timelineIndex = source.indexOf('<TimelineView');
    const graphIndex = source.indexOf('<GraphCanvas');
    const editorIndex = source.indexOf('<CaseNodeEditor');

    expect(source).toContain('className="workspace-topbar"');
    expect(source).toContain('className="workspace-grid workspace-grid-editor"');
    expect(source).not.toContain('workspace-rail-left');
    expect(source).not.toContain('timeline-edge-toggle');
    expect(timelineIndex).toBeGreaterThan(-1);
    expect(graphIndex).toBeGreaterThan(-1);
    expect(editorIndex).toBeGreaterThan(-1);
    expect(timelineIndex).toBeLessThan(graphIndex);
    expect(timelineIndex).toBeLessThan(editorIndex);
  });

  test('removes inspector, next-actions, guardrails, and left-rail timeline state from the workspace route', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    expect(source).not.toContain('<InspectorPanel');
    expect(source).not.toContain('<CanonicalActionPanel');
    expect(source).not.toContain('<CanonicalGuardrailSummary');
    expect(source).not.toContain('getGuardrails(');
    expect(source).not.toContain('timelineCollapsed');
    expect(source).not.toContain('timeline-collapse-button');
  });

  test('passes revision controls into the top strip and keeps revision bubble behavior inside the timeline strip', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    expect(source).toContain('revisionControls={{');
    expect(source).toContain('selectedNodeId={selectedNodeId}');
    expect(source).toContain('draftNodes={draftNodes}');
    expect(source).toContain('onCreateDraftNode={handleCreateDraftNode}');
  });

  test('keeps the workspace toolbar focused on breadcrumb navigation without legacy title rows or snapshot panels', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases.$caseId.tsx'),
      'utf8'
    );

    expect(source).toContain('className="workspace-header-copy"');
    expect(source).not.toContain('className="workspace-title-row"');
    expect(source).not.toContain('<SnapshotView');
    expect(source).not.toContain('data-testid="snapshot-panel"');
    expect(source).not.toContain('data-testid="historical-mode"');
    expect(source).not.toContain("t('snapshot.historical')");
  });

  test('keeps the top strip and editor stretched to the viewport height without collapsed rail placeholders', () => {
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

    expect(source).toContain('className="workspace-topbar"');
    expect(css).toContain('.workspace-topbar');
    expect(css).toContain('.timeline-strip');
    expect(css).toContain('.node-editor-panel');
    expect(css).not.toContain('.workspace-rail-left');
    expect(css).not.toContain('.timeline-edge-toggle');
    expect(css).toContain('flex: 1 1 auto;');
    expect(layoutCss).toContain('height: 100vh;');
    expect(layoutCss).toContain('overflow: hidden;');
  });
});
