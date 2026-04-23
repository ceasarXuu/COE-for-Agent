import { describe, expect, test } from 'vitest';

import { createLocalSession } from '../../server/auth/session.js';
import { handleConfirmIntentRequest } from '../../server/auth/confirm.js';

describe('confirm route', () => {
  test('issues a confirm token for reviewer confirmation intents', async () => {
    const now = new Date();
    const session = createLocalSession(
      {
        actorType: 'user',
        actorId: 'reviewer-1',
        role: 'Reviewer',
        issuer: 'local-test',
        authMode: 'local'
      },
      'local-test-secret',
      now
    );

    const response = await handleConfirmIntentRequest({
      sessionToken: session.sessionToken,
      secret: 'local-test-secret',
      body: {
        commandName: 'investigation.case.close',
        caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
        targetIds: ['case_01AAAAAAAAAAAAAAAAAAAAAAAA'],
        rationale: 'repair has passed staging verification'
      }
    });

    expect(response).toMatchObject({
      confirmToken: expect.any(String),
      expiresAt: expect.any(String)
    });
  });
});
