import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { InspectorPanel } from '../src/components/inspector-panel.js';

describe('inspector panel', () => {
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