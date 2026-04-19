import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

let capturedProps: Record<string, unknown> | null = null;

vi.mock('reactflow', () => ({
  __esModule: true,
  default: (props: { children?: ReactNode } & Record<string, unknown>) => {
    capturedProps = props;
    return createElement('div', { 'data-testid': 'mock-reactflow' }, props.children);
  },
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null
}));

import { GraphCanvas } from '../src/components/graph/GraphCanvas.js';
import { I18nProvider } from '../src/lib/i18n.js';

function renderGraphCanvas(props: Record<string, unknown>) {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      initialLocale: 'en',
      children: createElement(GraphCanvas, props as never)
    })
  );
}

describe('graph canvas selection', () => {
  beforeEach(() => {
    capturedProps = null;
  });

  test('does not render the legacy graph summary strip above the canvas', () => {
    const html = renderGraphCanvas({
      snapshot: {
        headRevision: 5,
        projectionRevision: 5,
        requestedRevision: null,
        stale: false,
        historical: false,
        data: {
          case: {
            id: 'case_01',
            title: 'debug',
            severity: 'critical',
            status: 'active',
            stage: 'intake',
            revision: 5,
            objective: 'debug'
          },
          counts: {
            problems: 1,
            hypotheses: 1,
            blockers: 1,
            repairAttempts: 0,
            evidenceRefs: 1
          },
          warnings: []
        }
      },
      graph: {
        headRevision: 5,
        projectionRevision: 5,
        requestedRevision: null,
        stale: false,
        historical: false,
        data: {
          focusId: null,
          nodes: [
            { id: 'problem_01', kind: 'problem', label: 'queue depth spikes', status: 'open', revision: 4 },
            { id: 'hypothesis_01', kind: 'hypothesis', label: 'worker pool starvation', status: 'favored', revision: 5 },
            { id: 'blocker_01', kind: 'blocker', label: 'approval pending', status: 'open', revision: 5 },
            { id: 'evidence_ref_01', kind: 'evidence_ref', label: 'pool saturation trace', status: null, revision: 5 }
          ],
          edges: [
            { key: 'supports-1', type: 'supports', fromId: 'evidence_ref_01', toId: 'hypothesis_01' },
            { key: 'structural-1', type: 'structural', fromId: 'problem_01', toId: 'hypothesis_01' },
            { key: 'blocks-1', type: 'blocks', fromId: 'hypothesis_01', toId: 'blocker_01' }
          ]
        }
      },
      onSelectNode() {
        return;
      }
    });

    expect(html).not.toContain('graph-summary-row');
    expect(html).not.toContain('Graph controls');
    expect(html).not.toContain('Graph legend');
    expect(html).not.toContain('Problem 1');
    expect(html).not.toContain('Hypothesis 1');
    expect(html).not.toContain('Symptom');
    expect(html).not.toContain('Artifact');
    expect(html).not.toContain('Fact');
  });

  test('only wires canonical drag-create handlers and never enables blank-canvas creation', () => {
    const onSelectNode = vi.fn();

    renderGraphCanvas({
      snapshot: {
        headRevision: 5,
        projectionRevision: 5,
        requestedRevision: null,
        stale: false,
        historical: false,
        data: {
          case: {
            id: 'case_01',
            title: 'debug',
            severity: 'critical',
            status: 'active',
            stage: 'intake',
            revision: 5,
            objective: 'debug'
          },
          counts: {
            problems: 1,
            hypotheses: 1,
            blockers: 0,
            repairAttempts: 0,
            evidenceRefs: 0
          },
          warnings: []
        }
      },
      graph: {
        headRevision: 5,
        projectionRevision: 5,
        requestedRevision: null,
        stale: false,
        historical: false,
        data: {
          focusId: null,
          nodes: [
            { id: 'problem_01', kind: 'problem', label: 'queue depth spikes', status: 'open', revision: 4 },
            { id: 'hypothesis_01', kind: 'hypothesis', label: 'worker pool starvation', status: 'favored', revision: 5 }
          ],
          edges: [
            { key: 'structural-1', type: 'structural', fromId: 'problem_01', toId: 'hypothesis_01' }
          ]
        }
      },
      onSelectNode
    });

    expect(capturedProps?.onPaneClick).toBeUndefined();
    expect(capturedProps?.onPaneContextMenu).toBeUndefined();
    expect(capturedProps?.onConnect).toBeUndefined();
    expect(typeof capturedProps?.onNodeClick).toBe('function');
    expect(typeof capturedProps?.onConnectStart).toBe('function');
    expect(typeof capturedProps?.onConnectEnd).toBe('function');
  });

  test('registers only canonical graph node types', () => {
    renderGraphCanvas({
      snapshot: {
        headRevision: 5,
        projectionRevision: 5,
        requestedRevision: null,
        stale: false,
        historical: false,
        data: {
          case: {
            id: 'case_01',
            title: 'debug',
            severity: 'critical',
            status: 'active',
            stage: 'intake',
            revision: 5,
            objective: 'debug'
          },
          counts: {
            problems: 1,
            hypotheses: 1,
            blockers: 1,
            repairAttempts: 1,
            evidenceRefs: 1
          },
          warnings: []
        }
      },
      graph: {
        headRevision: 5,
        projectionRevision: 5,
        requestedRevision: null,
        stale: false,
        historical: false,
        data: {
          focusId: null,
          nodes: [
            { id: 'case_01', kind: 'case', label: 'debug', status: 'active', revision: 5 },
            { id: 'problem_01', kind: 'problem', label: 'queue depth spikes', status: 'open', revision: 4 },
            { id: 'hypothesis_01', kind: 'hypothesis', label: 'worker pool starvation', status: 'favored', revision: 5 },
            { id: 'blocker_01', kind: 'blocker', label: 'approval pending', status: 'open', revision: 5 },
            { id: 'repair_attempt_01', kind: 'repair_attempt', label: 'increase pool size', status: 'planned', revision: 5 },
            { id: 'evidence_ref_01', kind: 'evidence_ref', label: 'pool saturation trace', status: null, revision: 5 }
          ],
          edges: [{ key: 'relates-1', type: 'structural', fromId: 'problem_01', toId: 'hypothesis_01' }]
        }
      },
      onSelectNode() {
        return;
      }
    });

    const nodeTypes = capturedProps?.nodeTypes as Record<string, unknown> | undefined;
    expect(nodeTypes?.case).toBeTypeOf('function');
    expect(nodeTypes?.problem).toBeTypeOf('function');
    expect(nodeTypes?.hypothesis).toBeTypeOf('function');
    expect(nodeTypes?.blocker).toBeTypeOf('function');
    expect(nodeTypes?.repair_attempt).toBeTypeOf('function');
    expect(nodeTypes?.evidence_ref).toBeTypeOf('function');
    expect(nodeTypes?.fact).toBeUndefined();
    expect(nodeTypes?.experiment).toBeUndefined();
    expect(nodeTypes?.decision).toBeUndefined();
    expect(nodeTypes?.gap).toBeUndefined();
    expect(nodeTypes?.residual).toBeUndefined();
    expect(nodeTypes?.inquiry).toBeUndefined();
    expect(nodeTypes?.symptom).toBeUndefined();
    expect(nodeTypes?.artifact).toBeUndefined();
    expect(nodeTypes?.entity).toBeUndefined();
    expect(nodeTypes?.issue).toBeUndefined();
  });

  test('keeps drag and viewport logging without overlay persistence writes', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    renderGraphCanvas({
      snapshot: {
        headRevision: 5,
        projectionRevision: 5,
        requestedRevision: null,
        stale: false,
        historical: false,
        data: {
          case: {
            id: 'case_01',
            title: 'debug',
            severity: 'critical',
            status: 'active',
            stage: 'intake',
            revision: 5,
            objective: 'debug'
          },
          counts: {
            problems: 1,
            hypotheses: 1,
            blockers: 0,
            repairAttempts: 0,
            evidenceRefs: 0
          },
          warnings: []
        }
      },
      graph: {
        headRevision: 5,
        projectionRevision: 5,
        requestedRevision: null,
        stale: false,
        historical: false,
        data: {
          focusId: null,
          nodes: [
            { id: 'problem_01', kind: 'problem', label: 'queue depth spikes', status: 'open', revision: 4 },
            { id: 'hypothesis_01', kind: 'hypothesis', label: 'worker pool starvation', status: 'favored', revision: 5 }
          ],
          edges: [{ key: 'structural-1', type: 'structural', fromId: 'problem_01', toId: 'hypothesis_01' }]
        }
      },
      onSelectNode() {
        return;
      }
    });

    const onNodeDragStop = capturedProps?.onNodeDragStop as ((event: unknown, node: { id: string; position: { x: number; y: number } }) => void) | undefined;
    const onMoveEnd = capturedProps?.onMoveEnd as ((event: unknown, viewport: { x: number; y: number; zoom: number }) => void) | undefined;

    expect(typeof onNodeDragStop).toBe('function');
    expect(typeof onMoveEnd).toBe('function');

    onNodeDragStop?.({}, { id: 'fact_01', position: { x: 144, y: 233 } });
    onMoveEnd?.({}, { x: -28, y: 64, zoom: 1.25 });

    expect(infoSpy).toHaveBeenCalledWith('[investigation-console] graph-node-repositioned', {
      caseId: 'case_01',
      nodeId: 'fact_01',
      position: { x: 144, y: 233 },
      source: 'graph-canvas'
    });
    expect(infoSpy).toHaveBeenCalledWith('[investigation-console] graph-viewport-updated', {
      caseId: 'case_01',
      source: 'graph-canvas',
      viewport: { x: -28, y: 64, zoom: 1.25 }
    });
  });

  test('renders unsaved draft nodes alongside persisted graph nodes and flags the selected draft in node data', () => {
    renderGraphCanvas({
      snapshot: {
        headRevision: 5,
        projectionRevision: 5,
        requestedRevision: null,
        stale: false,
        historical: false,
        data: {
          case: {
            id: 'case_01',
            title: 'debug',
            severity: 'critical',
            status: 'active',
            stage: 'intake',
            revision: 5,
            objective: 'debug'
          },
          counts: {
            problems: 1,
            hypotheses: 1,
            blockers: 0,
            repairAttempts: 0,
            evidenceRefs: 0
          },
          warnings: []
        }
      },
      graph: {
        headRevision: 5,
        projectionRevision: 5,
        requestedRevision: null,
        stale: false,
        historical: false,
        data: {
          focusId: null,
          nodes: [
            { id: 'problem_01', kind: 'problem', label: 'queue depth spikes', status: 'open', revision: 4 },
            { id: 'hypothesis_01', kind: 'hypothesis', label: 'worker pool starvation', status: 'unverified', revision: 5 }
          ],
          edges: [{ key: 'structural-1', type: 'structural', fromId: 'problem_01', toId: 'hypothesis_01' }]
        }
      },
      draftNodes: [
        {
          id: 'draft_hypothesis_01',
          kind: 'hypothesis',
          parentNodeId: 'problem_01',
          parentKind: 'problem',
          position: { x: 480, y: 220 },
          status: 'draft',
          label: 'Unsaved hypothesis',
          revision: 0,
          payload: {
            statement: 'Unsaved hypothesis'
          }
        }
      ],
      selectedNodeId: 'draft_hypothesis_01',
      onCreateDraftNode() {
        return;
      },
      onSelectNode() {
        return;
      }
    });

    const nodes = capturedProps?.nodes as Array<{ id: string; data: Record<string, unknown>; position: { x: number; y: number } }> | undefined;
    const draftNode = nodes?.find((node) => node.id === 'draft_hypothesis_01');

    expect(draftNode).toBeTruthy();
    expect(draftNode?.position).toEqual({ x: 480, y: 220 });
    expect(draftNode?.data.isDraft).toBe(true);
    expect(draftNode?.data.isSelected).toBe(true);
    expect(draftNode?.data.statusLabel).toBe('Unsaved');
  });

  test('does not inject revision bubble entries into graph nodes now that revision bubbles live on the timeline slider', () => {
    renderGraphCanvas({
      snapshot: {
        headRevision: 5,
        projectionRevision: 5,
        requestedRevision: null,
        stale: false,
        historical: false,
        data: {
          case: {
            id: 'case_01',
            title: 'debug',
            severity: 'critical',
            status: 'active',
            stage: 'intake',
            revision: 5,
            objective: 'debug'
          },
          counts: {
            problems: 1,
            hypotheses: 1,
            blockers: 0,
            repairAttempts: 0,
            evidenceRefs: 0
          },
          warnings: []
        }
      },
      graph: {
        headRevision: 5,
        projectionRevision: 5,
        requestedRevision: null,
        stale: false,
        historical: false,
        data: {
          focusId: null,
          nodes: [
            { id: 'hypothesis_01', kind: 'hypothesis', label: 'worker pool starvation', status: 'unverified', revision: 5 }
          ],
          edges: []
        }
      },
      onSelectNode() {
        return;
      }
    });

    const nodes = capturedProps?.nodes as Array<{ id: string; data: Record<string, unknown> }> | undefined;
    const hypothesisNode = nodes?.find((node) => node.id === 'hypothesis_01');

    expect(hypothesisNode?.data.revisionEvents).toBeUndefined();
  });
});
