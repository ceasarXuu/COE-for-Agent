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

describe('graph canvas viewport defaults', () => {
  beforeEach(() => {
    capturedProps = null;
  });

  test('caps the initial fit view around sixty percent zoom', () => {
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

    expect(capturedProps?.defaultViewport).toEqual({ x: 0, y: 0, zoom: 0.6 });
    expect(capturedProps?.fitViewOptions).toEqual({ padding: 0.12, maxZoom: 0.6 });
  });
});
