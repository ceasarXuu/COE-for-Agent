import { describe, expect, test } from 'vitest';

import { authorizeMutationCommand } from '../../src/auth/authorize-command.js';
import { issueConfirmToken, verifyConfirmToken } from '../../src/auth/confirm-token.js';

const reviewerActorContext = {
  actorType: 'user' as const,
  actorId: 'reviewer-1',
  sessionId: 'reviewer-session-1',
  role: 'Reviewer' as const,
  issuer: 'local-test',
  authMode: 'local' as const
};

describe('confirm tokens', () => {
  test('rejects high-risk commands when confirmToken is missing', () => {
    expect(() =>
      authorizeMutationCommand({
        commandName: 'investigation.case.close',
        input: {
          actorContext: reviewerActorContext,
          caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
          ifCaseRevision: 5,
          reason: 'patch applied to staging successfully'
        },
        secret: 'local-test-secret'
      })
    ).toThrow(/confirmtoken/i);
  });

  test('invalidates expired confirmToken payloads', () => {
    const token = issueConfirmToken(
      {
        commandName: 'investigation.case.close',
        caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
        targetIds: ['case_01AAAAAAAAAAAAAAAAAAAAAAAA'],
        sessionId: reviewerActorContext.sessionId,
        role: reviewerActorContext.role,
        issuer: reviewerActorContext.issuer,
        reasonHash: 'reason-hash-1',
        expiresAt: new Date('2026-04-07T00:00:00.000Z')
      },
      'local-test-secret',
      new Date('2026-04-06T23:58:00.000Z')
    );

    expect(() =>
      verifyConfirmToken(token, {
        secret: 'local-test-secret',
        expectedCommandName: 'investigation.case.close',
        expectedCaseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
        expectedTargetIds: ['case_01AAAAAAAAAAAAAAAAAAAAAAAA'],
        expectedSessionId: reviewerActorContext.sessionId,
        expectedRole: reviewerActorContext.role,
        expectedReasonHash: 'reason-hash-1',
        now: new Date('2026-04-07T00:00:01.000Z')
      })
    ).toThrow(/expired/i);
  });
});
