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
                {
                  id: 'symptom_01',
                  kind: 'symptom',
                  displayKind: 'issue',
                  issueKind: 'symptom',
                  label: 'queue depth spikes',
                  status: 'open',
                  revision: 4
                },
                { id: 'hypothesis_01', kind: 'hypothesis', label: 'worker pool starvation', status: 'favored', revision: 5 }
              ],
              edges: [
                { key: 'explains-1', type: 'explains', fromId: 'hypothesis_01', toId: 'symptom_01' }
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
    expect(html).toContain('实时切片');
    expect(html).not.toContain('缩放');
    expect(html).not.toContain('graph-meta-row');
    expect(html).not.toContain('严重');
    expect(html).toContain('graph-summary-row');
    expect(html).toContain('症状 1');
    expect(html).not.toContain('事项');
    expect(html).toContain('假设 1');
    expect(html).not.toContain('2 个节点');
    expect(html).not.toContain('1 条连线');
    expect(html).toContain('支撑');
    expect(html).toContain('解释');
    expect(html).toContain('验证');

    const nodes = capturedProps?.nodes as Array<{
      data: {
        isSelected?: boolean;
        isFocus?: boolean;
      };
    }> | undefined;

    expect(nodes?.every((node) => node.data.isSelected === undefined)).toBe(true);
    expect(nodes?.every((node) => node.data.isFocus === undefined)).toBe(true);
    expect(nodes?.some((node) => (node as { type?: string }).type === 'issue')).toBe(true);
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

  test('wires canvas context menus through the pane handler ReactFlow actually supports', () => {
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
              edges: [{ key: 'supports-1', type: 'supports', fromId: 'fact_01', toId: 'hypothesis_01' }]
            }
          },
          onSelectNode() {
            return;
          }
        })
      })
    );

    expect(typeof capturedProps?.onPaneContextMenu).toBe('function');
    expect(typeof capturedProps?.onInit).toBe('function');
    expect(capturedProps?.onContextMenu).toBeUndefined();
  });

  test('lets nodes drag while limiting canvas panning to blank-pane drags or holding space', () => {
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
              edges: [{ key: 'supports-1', type: 'supports', fromId: 'fact_01', toId: 'hypothesis_01' }]
            }
          },
          onSelectNode() {
            return;
          }
        })
      })
    );

    expect(capturedProps?.nodesDraggable).toBe(true);
    expect(capturedProps?.panOnDrag).toEqual([0]);
    expect(capturedProps?.panActivationKeyCode).toBe('Space');
    expect(capturedProps?.selectionOnDrag).toBe(false);
    expect(capturedProps?.autoPanOnNodeDrag).toBe(false);
    expect(typeof capturedProps?.onNodesChange).toBe('function');
  });

  test('logs node repositioning and viewport moves for graph interaction debugging', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

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
              edges: [{ key: 'supports-1', type: 'supports', fromId: 'fact_01', toId: 'hypothesis_01' }]
            }
          },
          onSelectNode() {
            return;
          }
        })
      })
    );

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
});
