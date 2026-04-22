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
  MiniMap: () => null,
  applyNodeChanges: (_changes: unknown, nodes: unknown) => nodes
}));

import { GraphCanvas } from '../src/components/workspace/graph/graph-canvas.js';
import { I18nProvider } from '../src/lib/i18n.js';

function renderGraphCanvas(props: Record<string, unknown>) {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      initialLocale: 'en',
      children: createElement(GraphCanvas, props as never)
    })
  );
}

describe('v2 graph canvas behavior', () => {
  beforeEach(() => {
    capturedProps = null;
  });

  test('selects the dragged node when dragging starts', () => {
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
      onSelectNode
    });

    const onNodeDragStart = capturedProps?.onNodeDragStart as ((event: unknown, node: { id: string }) => void) | undefined;

    expect(typeof onNodeDragStart).toBe('function');
    onNodeDragStart?.({}, { id: 'hypothesis_01' });
    expect(onSelectNode).toHaveBeenCalledWith('hypothesis_01');
  });

  test('writes dragged persisted node positions into local storage on drag stop', () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn()
    };

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: storage
      }
    });

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
            { id: 'problem_01', kind: 'problem', label: 'queue depth spikes', status: 'open', revision: 4 }
          ],
          edges: []
        }
      },
      onSelectNode() {
        return;
      }
    });

    const onNodeDragStop = capturedProps?.onNodeDragStop as ((event: unknown, node: { id: string; position: { x: number; y: number } }) => void) | undefined;

    expect(typeof onNodeDragStop).toBe('function');
    onNodeDragStop?.({}, { id: 'problem_01', position: { x: 444, y: 333 } });

    expect(storage.setItem).toHaveBeenCalledWith(
      'investigation-console-v2.graph-node-positions:case_01:head',
      JSON.stringify({ problem_01: { x: 444, y: 333 } })
    );
  });
});
