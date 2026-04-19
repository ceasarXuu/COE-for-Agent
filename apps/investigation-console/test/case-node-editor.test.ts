import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { CaseNodeEditor } from '../src/components/node-editor/CaseNodeEditor.js';
import { createDraftNode } from '../src/components/node-editor/case-node-drafts.js';
import { I18nProvider } from '../src/lib/i18n.js';

function renderEditor(props: Record<string, unknown>) {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      initialLocale: 'en',
      children: createElement(CaseNodeEditor, props as never)
    })
  );
}

describe('case node editor', () => {
  test('renders an empty editor state when no node is selected', () => {
    const html = renderEditor({
      caseId: 'case_01',
      currentRevision: 5,
      historical: false,
      selectedNode: null,
      selectedDraftNode: null,
      onPatchDraftNode() {
        return;
      },
      onDiscardDraftNode() {
        return;
      },
      onMutationComplete() {
        return;
      }
    });

    expect(html).toContain('data-testid="node-editor-empty"');
    expect(html).toContain('Node Editor');
  });

  test('renders save and discard controls for unsaved draft nodes', () => {
    const html = renderEditor({
      caseId: 'case_01',
      currentRevision: 5,
      historical: false,
      selectedNode: null,
      selectedDraftNode: createDraftNode({
        id: 'draft_hypothesis_01',
        kind: 'hypothesis',
        parentNodeId: 'problem_01',
        parentKind: 'problem',
        position: { x: 320, y: 120 },
        defaultLabel: 'Hypothesis'
      }),
      onPatchDraftNode() {
        return;
      },
      onDiscardDraftNode() {
        return;
      },
      onMutationComplete() {
        return;
      }
    });

    expect(html).toContain('data-testid="node-editor-save"');
    expect(html).toContain('data-testid="node-editor-discard"');
    expect(html).toContain('Unsaved');
  });

  test('renders manual-save problem fields instead of the legacy action panel', () => {
    const html = renderEditor({
      caseId: 'case_01',
      currentRevision: 5,
      historical: false,
      selectedNode: {
        id: 'problem_01',
        kind: 'problem',
        label: 'Checkout stalls under peak load',
        status: 'open',
        revision: 5,
        payload: {
          title: 'Checkout stalls under peak load',
          description: 'The issue remains unresolved in production.',
          environment: 'prod-us-east-1',
          symptoms: ['latency spikes after deploy'],
          resolutionCriteria: ['p95 under 300ms for 24h']
        }
      },
      selectedDraftNode: null,
      onPatchDraftNode() {
        return;
      },
      onDiscardDraftNode() {
        return;
      },
      onMutationComplete() {
        return;
      }
    });

    expect(html).toContain('data-testid="node-editor-problem-title"');
    expect(html).toContain('data-testid="node-editor-problem-description"');
    expect(html).toContain('data-testid="node-editor-problem-environment"');
    expect(html).toContain('data-testid="node-editor-problem-symptoms"');
    expect(html).toContain('data-testid="node-editor-problem-resolution"');
    expect(html).not.toContain('action-panel');
  });

  test('renders editable hypothesis fields for saved nodes instead of read-only content', () => {
    const html = renderEditor({
      caseId: 'case_01',
      currentRevision: 5,
      historical: false,
      selectedNode: {
        id: 'hypothesis_01',
        kind: 'hypothesis',
        label: 'Worker pool starvation',
        status: 'unverified',
        revision: 5,
        payload: {
          title: 'Worker pool starvation',
          statement: 'Worker pool starvation',
          falsificationCriteria: ['Queue depth stays flat under replay']
        }
      },
      selectedDraftNode: null,
      onPatchDraftNode() {
        return;
      },
      onDiscardDraftNode() {
        return;
      },
      onMutationComplete() {
        return;
      }
    });

    expect(html).toContain('data-testid="node-editor-hypothesis-statement"');
    expect(html).toContain('data-testid="node-editor-hypothesis-title"');
    expect(html).toContain('data-testid="node-editor-hypothesis-falsification"');
    expect(html).not.toContain('readonly');
  });
});
