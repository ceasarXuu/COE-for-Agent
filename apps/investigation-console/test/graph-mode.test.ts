import { describe, expect, test } from 'vitest';

import { isCanonicalGraphProjection } from '../src/components/graph/isCanonicalGraphProjection.js';

describe('graph mode detection', () => {
  test('treats a problem-plus-hypothesis graph without legacy node kinds as canonical', () => {
    expect(isCanonicalGraphProjection({
      data: {
        focusId: 'hypothesis_01',
        nodes: [
          { id: 'problem_01', kind: 'problem', label: 'Checkout stalls', status: 'open', revision: 1 },
          { id: 'hypothesis_01', kind: 'hypothesis', label: 'Pool starvation', status: 'unverified', revision: 2 }
        ],
        edges: [
          { key: 'structural:problem_01:hypothesis_01', type: 'structural', fromId: 'problem_01', toId: 'hypothesis_01' }
        ]
      }
    })).toBe(true);
  });

  test('keeps mixed legacy graphs in legacy mode when the canonical root is only sidecar state', () => {
    expect(isCanonicalGraphProjection({
      data: {
        focusId: 'hypothesis_01',
        nodes: [
          { id: 'problem_01', kind: 'problem', label: 'Checkout stalls', status: 'open', revision: 1 },
          { id: 'symptom_01', kind: 'symptom', label: 'Checkout timeout', status: 'open', revision: 2 },
          { id: 'fact_01', kind: 'fact', label: 'Pool saturates', status: 'recorded', revision: 3 },
          { id: 'hypothesis_01', kind: 'hypothesis', label: 'Pool starvation', status: 'favored', revision: 4 }
        ],
        edges: [
          { key: 'supports:fact_01:hypothesis_01', type: 'supports', fromId: 'fact_01', toId: 'hypothesis_01' },
          { key: 'explains:hypothesis_01:symptom_01', type: 'explains', fromId: 'hypothesis_01', toId: 'symptom_01' }
        ]
      }
    })).toBe(false);
  });
});
