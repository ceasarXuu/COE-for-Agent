import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { InspectorPanel } from '../src/components/inspector-panel.js';

describe('inspector panel', () => {
  test('renders hypothesis summary when it carries the selected branch statement', () => {
    const html = renderToStaticMarkup(
      createElement(InspectorPanel, {
        loading: false,
        inspector: {
          kind: 'hypothesis',
          title: 'worker pool starvation hypothesis',
          status: 'favored',
          summary: 'Queue starvation explains the burst fanout stall.',
          primaryItems: ['queue depth spikes on the new branch'],
          secondaryItems: ['synthetic replay under load']
        } as never
      })
    );

    expect(html).toContain('Queue starvation explains the burst fanout stall.');
  });

  test('renders generic summary for fallback and error-style inspector states', () => {
    const html = renderToStaticMarkup(
      createElement(InspectorPanel, {
        loading: false,
        inspector: {
          kind: 'node',
          title: 'hypothesis_01',
          status: null,
          summary: 'Selected node is outside the current graph slice.',
          primaryItems: [],
          secondaryItems: []
        } as never
      })
    );

    expect(html).toContain('Selected node is outside the current graph slice.');
  });

  test('renders experiment-specific sections instead of the generic fallback copy', () => {
    const html = renderToStaticMarkup(
      createElement(InspectorPanel, {
        loading: false,
        inspector: {
          kind: 'experiment',
          title: 'branch replay under synthetic load',
          status: 'completed',
          summary: 'Replay confirms the winning branch.',
          primaryItems: ['worker pool starvation hypothesis'],
          secondaryItems: ['duplicate branch exits after queue isolation']
        } as never
      })
    );

    expect(html).toContain('Linked hypotheses');
    expect(html).toContain('Expected outcomes');
    expect(html).toContain('branch replay under synthetic load');
  });

  test('renders residual-specific sections for unresolved risk review', () => {
    const html = renderToStaticMarkup(
      createElement(InspectorPanel, {
        loading: false,
        inspector: {
          kind: 'residual',
          title: 'regional failover still duplicates a small batch',
          status: 'open',
          summary: 'Residual risk remains after the primary fix path.',
          primaryItems: ['workers stall under burst fanout'],
          secondaryItems: ['accept, reduce, or resolve before closure']
        } as never
      })
    );

    expect(html).toContain('Related symptoms');
    expect(html).toContain('Risk treatment');
    expect(html).toContain('regional failover still duplicates a small batch');
  });
});
