import { describe, expect, test } from 'vitest';

import { computeGraphLayout } from '../src/components/graph/useGraphLayout.js';

function createGraph(nodeCount: 2 | 3) {
  return {
    headRevision: nodeCount === 3 ? 3 : 2,
    projectionRevision: nodeCount === 3 ? 3 : 2,
    requestedRevision: null,
    stale: false,
    historical: false,
    data: {
      focusId: null,
      nodes: [
        { id: 'case_01', kind: 'case', label: 'Debug case', status: 'active', revision: 1 },
        { id: 'problem_01', kind: 'problem', label: 'Queue depth spikes', status: 'open', revision: 1 },
        { id: 'hypothesis_01', kind: 'hypothesis', label: 'Worker pool starvation', status: 'unverified', revision: 2 },
        ...(nodeCount === 3
          ? [{ id: 'hypothesis_02', kind: 'hypothesis', label: 'Cache thrash', status: 'unverified', revision: 3 }]
          : [])
      ],
      edges: [
        { key: 'structural:case_01:problem_01', type: 'structural', fromId: 'case_01', toId: 'problem_01' },
        { key: 'structural:problem_01:hypothesis_01', type: 'structural', fromId: 'problem_01', toId: 'hypothesis_01' },
        ...(nodeCount === 3
          ? [{ key: 'structural:problem_01:hypothesis_02', type: 'structural', fromId: 'problem_01', toId: 'hypothesis_02' }]
          : [])
      ]
    }
  };
}

describe('graph layout stability', () => {
  test('keeps existing node positions stable when a new sibling node is added', () => {
    const initialLayout = computeGraphLayout(createGraph(2));
    const nextLayout = computeGraphLayout(createGraph(3));

    const caseBefore = initialLayout.nodes.find((node) => node.id === 'case_01');
    const problemBefore = initialLayout.nodes.find((node) => node.id === 'problem_01');
    const hypothesisBefore = initialLayout.nodes.find((node) => node.id === 'hypothesis_01');

    const caseAfter = nextLayout.nodes.find((node) => node.id === 'case_01');
    const problemAfter = nextLayout.nodes.find((node) => node.id === 'problem_01');
    const hypothesisAfter = nextLayout.nodes.find((node) => node.id === 'hypothesis_01');

    expect(caseAfter?.position).toEqual(caseBefore?.position);
    expect(problemAfter?.position).toEqual(problemBefore?.position);
    expect(hypothesisAfter?.position).toEqual(hypothesisBefore?.position);
  });
});
