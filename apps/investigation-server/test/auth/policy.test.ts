import { describe, expect, test } from 'vitest';

import { authorizeMutationCommand } from '../../src/auth/authorize-command.js';

const baseActorContext = {
  actorId: 'user-1',
  sessionId: 'session-1',
  issuer: 'local-test',
  authMode: 'local' as const
};

describe('authorization policy', () => {
  test('viewer cannot execute any mutation tool', () => {
    expect(() =>
      authorizeMutationCommand({
        commandName: 'investigation.problem.update',
        input: {
          actorContext: {
            ...baseActorContext,
            actorType: 'user',
            role: 'Viewer'
          },
          caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
          ifCaseRevision: 1,
          problemId: 'problem_01AAAAAAAAAAAAAAAAAAAAA',
          description: 'latency spikes'
        },
        secret: 'local-test-secret'
      })
    ).toThrow(/viewer|not authorized/i);
  });

  test('operator cannot execute reviewer-only operations', () => {
    expect(() =>
      authorizeMutationCommand({
        commandName: 'investigation.case.close',
        input: {
          actorContext: {
            ...baseActorContext,
            actorType: 'user',
            role: 'Operator'
          },
          caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
          ifCaseRevision: 4,
          reason: 'close after validation'
        },
        secret: 'local-test-secret'
      })
    ).toThrow(/reviewer/i);
  });

  test('pure agent actors cannot execute reviewer-only operations', () => {
    expect(() =>
      authorizeMutationCommand({
        commandName: 'investigation.hypothesis.set_status',
        input: {
          actorContext: {
            ...baseActorContext,
            actorType: 'agent',
            actorId: 'copilot',
            role: 'Reviewer'
          },
          caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
          ifCaseRevision: 7,
          hypothesisId: 'hypothesis_01AAAAAAAAAAAAAAAAAAA',
          newStatus: 'confirmed',
          reason: 'evidence is sufficient'
        },
        secret: 'local-test-secret'
      })
    ).toThrow(/human|agent/i);
  });
});
