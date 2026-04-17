import { describe, expect, test } from 'vitest';

import {
  allowedCanonicalChildKinds,
  validateCanonicalGraphStructure,
  wouldIntroduceCanonicalCycle
} from '../src/canonical-case-graph.js';

describe('canonical case graph model', () => {
  test('only allows hypothesis children from problem roots', () => {
    expect(allowedCanonicalChildKinds({ parentKind: 'problem', parentStatus: 'open' })).toEqual(['hypothesis']);
  });

  test('gates repair attempts by parent status', () => {
    expect(allowedCanonicalChildKinds({ parentKind: 'hypothesis', parentStatus: 'unverified' })).toEqual([
      'hypothesis',
      'evidence_ref',
      'blocker'
    ]);
    expect(allowedCanonicalChildKinds({ parentKind: 'hypothesis', parentStatus: 'confirmed' })).toEqual([
      'hypothesis',
      'evidence_ref',
      'blocker',
      'repair_attempt'
    ]);
    expect(allowedCanonicalChildKinds({ parentKind: 'repair_attempt', parentStatus: 'running' })).toEqual([
      'evidence_ref'
    ]);
    expect(allowedCanonicalChildKinds({ parentKind: 'repair_attempt', parentStatus: 'ineffective' })).toEqual([
      'evidence_ref',
      'repair_attempt'
    ]);
  });

  test('detects cycles for single-parent structural graphs', () => {
    const nodes = [
      { id: 'problem_1', parentId: null },
      { id: 'hypothesis_1', parentId: 'problem_1' },
      { id: 'repair_attempt_1', parentId: 'hypothesis_1' }
    ];

    expect(wouldIntroduceCanonicalCycle(nodes, 'repair_attempt_1', 'problem_1')).toBe(true);
    expect(wouldIntroduceCanonicalCycle(nodes, 'repair_attempt_1', 'hypothesis_1')).toBe(true);
    expect(wouldIntroduceCanonicalCycle(nodes, 'problem_1', 'repair_attempt_1')).toBe(false);
  });

  test('validates a legal canonical graph and rejects invalid roots', () => {
    expect(() =>
      validateCanonicalGraphStructure([
        { id: 'problem_1', kind: 'problem', parentId: null, parentKind: null, status: 'open' },
        { id: 'hypothesis_1', kind: 'hypothesis', parentId: 'problem_1', parentKind: 'problem', status: 'confirmed' },
        { id: 'repair_attempt_1', kind: 'repair_attempt', parentId: 'hypothesis_1', parentKind: 'hypothesis', status: 'running' },
        { id: 'evidence_ref_1', kind: 'evidence_ref', parentId: 'repair_attempt_1', parentKind: 'repair_attempt', status: null }
      ])
    ).not.toThrow();

    expect(() =>
      validateCanonicalGraphStructure([
        { id: 'problem_1', kind: 'problem', parentId: null, parentKind: null, status: 'open' },
        { id: 'problem_2', kind: 'problem', parentId: null, parentKind: null, status: 'open' }
      ])
    ).toThrow('exactly one problem root');
  });
});
