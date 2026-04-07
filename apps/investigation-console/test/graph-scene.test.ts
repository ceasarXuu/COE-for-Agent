import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { GraphScene } from '../src/components/graph-scene.js';

describe('graph scene', () => {
  test('renders a visual case graph with an SVG edge layer instead of a flat node grid', () => {
    const html = renderToStaticMarkup(
      createElement(GraphScene, {
        graph: {
          headRevision: 5,
          projectionRevision: 5,
          requestedRevision: null,
          stale: false,
          historical: false,
          data: {
            focusId: 'hypothesis_01',
            nodes: [
              { id: 'symptom_01', kind: 'symptom', label: 'worker stalls under burst fanout', status: 'open', revision: 2 },
              { id: 'fact_01', kind: 'fact', label: 'queue depth spikes on the new branch', status: 'recorded', revision: 4 },
              { id: 'hypothesis_01', kind: 'hypothesis', label: 'worker pool starvation hypothesis', status: 'favored', revision: 5 },
              { id: 'experiment_01', kind: 'experiment', label: 'synthetic replay under load', status: 'completed', revision: 5 }
            ],
            edges: [
              { key: 'supports-1', type: 'supports', fromId: 'fact_01', toId: 'hypothesis_01' },
              { key: 'explains-1', type: 'explains', fromId: 'hypothesis_01', toId: 'symptom_01' },
              { key: 'tests-1', type: 'tests', fromId: 'experiment_01', toId: 'hypothesis_01' }
            ]
          }
        },
        selectedNodeId: 'hypothesis_01',
        onSelectNode() {
          return;
        }
      } as never)
    );

    expect(html).toContain('data-testid="graph-canvas"');
    expect(html).toContain('<svg');
    expect(html).toContain('supports');
    expect(html).toContain('explains');
    expect(html).toContain('tests');
    expect(html).toContain('graph-node-active');
  });
});