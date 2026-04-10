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

describe('graph canvas focus controls', () => {
  beforeEach(() => {
    capturedProps = null;
  });

  test('renders a clear-focus control in Chinese when the graph is focused', () => {
    const html = renderToStaticMarkup(
      createElement(I18nProvider, {
        initialLocale: 'zh-CN',
        children: createElement(GraphCanvas, {
          graph: {
            headRevision: 5,
            projectionRevision: 5,
            requestedRevision: null,
            stale: false,
            historical: false,
            data: {
              focusId: 'hypothesis_01',
              nodes: [
                { id: 'fact_01', kind: 'fact', label: 'queue depth spikes', status: 'recorded', revision: 4 },
                { id: 'hypothesis_01', kind: 'hypothesis', label: 'worker pool starvation', status: 'favored', revision: 5 }
              ],
              edges: [
                { key: 'supports-1', type: 'supports', fromId: 'fact_01', toId: 'hypothesis_01' }
              ]
            }
          },
          selectedNodeId: 'hypothesis_01',
          onSelectNode() {
            return;
          },
          focusId: 'hypothesis_01'
        })
      })
    );

    expect(html).toContain('data-testid="graph-clear-focus"');
    expect(html).toContain('返回全图');
  });

  test('clears the focused slice when the pane is clicked', () => {
    const onSelectNode = vi.fn();

    renderToStaticMarkup(
      createElement(I18nProvider, {
        initialLocale: 'en',
        children: createElement(GraphCanvas, {
          graph: {
            headRevision: 5,
            projectionRevision: 5,
            requestedRevision: null,
            stale: false,
            historical: false,
            data: {
              focusId: 'hypothesis_01',
              nodes: [
                { id: 'fact_01', kind: 'fact', label: 'queue depth spikes', status: 'recorded', revision: 4 },
                { id: 'hypothesis_01', kind: 'hypothesis', label: 'worker pool starvation', status: 'favored', revision: 5 }
              ],
              edges: [
                { key: 'supports-1', type: 'supports', fromId: 'fact_01', toId: 'hypothesis_01' }
              ]
            }
          },
          selectedNodeId: 'hypothesis_01',
          onSelectNode,
          focusId: 'hypothesis_01'
        })
      })
    );

    expect(typeof capturedProps?.onPaneClick).toBe('function');
    (capturedProps?.onPaneClick as (() => void) | undefined)?.();
    expect(onSelectNode).toHaveBeenCalledWith(null);
  });

  test('passes localized node badges to React Flow when the locale is Chinese', () => {
    renderToStaticMarkup(
      createElement(I18nProvider, {
        initialLocale: 'zh-CN',
        children: createElement(GraphCanvas, {
          graph: {
            headRevision: 5,
            projectionRevision: 5,
            requestedRevision: null,
            stale: false,
            historical: false,
            data: {
              focusId: null,
              nodes: [
                { id: 'fact_01', kind: 'fact', label: 'queue depth spikes', status: 'recorded', revision: 4 }
              ],
              edges: []
            }
          },
          selectedNodeId: 'fact_01',
          onSelectNode() {
            return;
          }
        })
      })
    );

    const nodes = capturedProps?.nodes as Array<{
      data: {
        kindLabel?: string;
        revisionLabel?: string;
        statusLabel?: string;
      };
    }> | undefined;

    expect(nodes?.[0]?.data.kindLabel).toBe('事实');
    expect(nodes?.[0]?.data.statusLabel).toBe('已记录');
    expect(nodes?.[0]?.data.revisionLabel).toBe('修订 4');
  });
});
