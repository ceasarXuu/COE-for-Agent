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
        commandName: 'investigation.symptom.report',
        input: {
          actorContext: {
            ...baseActorContext,
            actorType: 'user',
            role: 'Viewer'
          },
          caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
          ifCaseRevision: 1,
          statement: 'latency spikes',
          severity: 'high',
          reproducibility: 'always'
        },
        secret: 'local-test-secret'
      })
    ).toThrow(/viewer|not authorized/i);
  });

  test('operator cannot execute reviewer-only operations', () => {
    expect(() =>
      authorizeMutationCommand({
        commandName: 'investigation.case.advance_stage',
        input: {
          actorContext: {
            ...baseActorContext,
            actorType: 'user',
            role: 'Operator'
          },
          caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
          ifCaseRevision: 4,
          stage: 'repair_preparation',
          reason: 'ready to patch'
        },
        secret: 'local-test-secret'
      })
    ).toThrow(/reviewer/i);
  });

  test('pure agent actors cannot execute reviewer-only operations', () => {
    expect(() =>
      authorizeMutationCommand({
        commandName: 'investigation.decision.record',
        input: {
          actorContext: {
            ...baseActorContext,
            actorType: 'agent',
            actorId: 'copilot',
            role: 'Reviewer'
          },
          caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
          ifCaseRevision: 7,
          title: 'ready to patch',
          decisionKind: 'ready_to_patch',
          statement: 'evidence is sufficient',
          supportingFactIds: ['fact_01AAAAAAAAAAAAAAAAAAAAAAAA']
        },
        secret: 'local-test-secret'
      })
    ).toThrow(/human|agent/i);
  });
});