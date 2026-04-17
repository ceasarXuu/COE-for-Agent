import { describe, expect, test } from 'vitest';

import {
  transitionBlockerStatus,
  transitionProblemStatus,
  transitionRepairAttemptStatus
} from '../src/index.js';

describe('canonical state machines', () => {
  test('allows only legal problem transitions', () => {
    expect(transitionProblemStatus('open', 'resolved')).toBe('resolved');
    expect(() => transitionProblemStatus('resolved', 'open')).toThrow('Invalid problem transition');
  });

  test('allows only legal blocker transitions', () => {
    expect(transitionBlockerStatus('active', 'closed')).toBe('closed');
    expect(() => transitionBlockerStatus('closed', 'active')).toThrow('Invalid blocker transition');
  });

  test('allows only legal repair-attempt transitions', () => {
    expect(transitionRepairAttemptStatus('proposed', 'running')).toBe('running');
    expect(transitionRepairAttemptStatus('running', 'effective')).toBe('effective');
    expect(() => transitionRepairAttemptStatus('effective', 'running')).toThrow('Invalid repair attempt transition');
  });
});
