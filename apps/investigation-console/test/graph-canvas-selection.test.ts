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

describe('graph canvas selection', () => {
  beforeEach(() => {
    capturedProps = null;
  });

  test('keeps the graph presentation unchanged when a node is selected', () => {
    const html = renderToStaticMarkup(
      createElement(I18nProvider, {
        initialLocale: 'zh-CN',
        children: createElement(GraphCanvas, {
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
                inquiries: 1,
                symptoms: 0,
                artifacts: 0,
                facts: 0
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
                { id: 'fact_01', kind: 'fact', label: 'queue depth spikes', status: 'recorded', revision: 4 },
                { id: 'hypothesis_01', kind: 'hypothesis', label: 'worker pool starvation', status: 'favored', revision: 5 }
              ],
              edges: [
                { key: 'supports-1', type: 'supports', fromId: 'fact_01', toId: 'hypothesis_01' }
              ]
            }
          },
          onSelectNode() {
            return;
          }
        })
      })
    );

    expect(html).not.toContain('data-testid="graph-clear-focus"');
    expect(html).not.toContain('焦点 hypothesis');
    expect(html).not.toContain('受理');
    expect(html).not.toContain('实时切片');
    expect(html).not.toContain('缩放');
    expect(html).toContain('严重');
    expect(html).toContain('问题 1');
    expect(html).toContain('症状 0');
    expect(html).toContain('证据 0');
    expect(html).toContain('事实 0');

    const nodes = capturedProps?.nodes as Array<{
      data: {
        isSelected?: boolean;
        isFocus?: boolean;
      };
    }> | undefined;

    expect(nodes?.every((node) => node.data.isSelected === undefined)).toBe(true);
    expect(nodes?.every((node) => node.data.isFocus === undefined)).toBe(true);
  });

  test('only selects nodes through node click callbacks and does not clear on pane clicks', () => {
    const onSelectNode = vi.fn();

    renderToStaticMarkup(
      createElement(I18nProvider, {
        initialLocale: 'en',
        children: createElement(GraphCanvas, {
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
                inquiries: 1,
                symptoms: 0,
                artifacts: 0,
                facts: 0
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
                { id: 'fact_01', kind: 'fact', label: 'queue depth spikes', status: 'recorded', revision: 4 },
                { id: 'hypothesis_01', kind: 'hypothesis', label: 'worker pool starvation', status: 'favored', revision: 5 }
              ],
              edges: [
                { key: 'supports-1', type: 'supports', fromId: 'fact_01', toId: 'hypothesis_01' }
              ]
            }
          },
          onSelectNode
        })
      })
    );

    expect(capturedProps?.onPaneClick).toBeUndefined();
    expect(typeof capturedProps?.onNodeClick).toBe('function');
  });
});
