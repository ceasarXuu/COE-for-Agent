import { describe, expect, test } from 'vitest';

import { advanceCaseStage } from '../src/state-machines/case.js';
import { closeInquiry } from '../src/state-machines/inquiry.js';
import { transitionHypothesisStatus } from '../src/state-machines/hypothesis.js';
import { transitionExperimentStatus } from '../src/state-machines/experiment.js';
import { transitionGapStatus } from '../src/state-machines/gap.js';
import { transitionResidualStatus } from '../src/state-machines/residual.js';

describe('state machines', () => {
  test('rejects invalid case stage jumps and allows closing from repair validation', () => {
    expect(() =>
      advanceCaseStage({ status: 'active', stage: 'scoping' }, 'repair_validation')
    ).toThrow(/invalid case stage transition/i);

    expect(
      advanceCaseStage({ status: 'validating', stage: 'repair_validation' }, 'closed')
    ).toEqual({ status: 'closed', stage: 'closed' });
  });

  test('allows inquiry.close from open and rejects closing a closed inquiry again', () => {
    expect(closeInquiry({ status: 'open' }, 'answered')).toEqual({
      status: 'closed',
      resolutionKind: 'answered'
    });

    expect(() => closeInquiry({ status: 'closed' }, 'answered')).toThrow(/invalid inquiry transition/i);
  });

  test('enforces hypothesis, experiment, gap, and residual lifecycle transitions', () => {
    expect(transitionHypothesisStatus('active', 'confirmed')).toBe('confirmed');
    expect(() => transitionHypothesisStatus('rejected', 'active')).toThrow(/invalid hypothesis transition/i);

    expect(transitionExperimentStatus('planned', 'running')).toBe('running');
    expect(() => transitionExperimentStatus('completed', 'running')).toThrow(/invalid experiment transition/i);

    expect(transitionGapStatus('open', 'resolved')).toBe('resolved');
    expect(() => transitionGapStatus('resolved', 'open')).toThrow(/invalid gap transition/i);

    expect(transitionResidualStatus('open', 'accepted')).toBe('accepted');
    expect(() => transitionResidualStatus('accepted', 'open')).toThrow(/invalid residual transition/i);
  });
});