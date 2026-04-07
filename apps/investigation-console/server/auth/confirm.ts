import { createConfirmToken, hashConfirmationReason, verifySessionToken } from './token-codec.js';

export interface ConfirmIntentRequestBody {
  commandName: string;
  caseId: string;
  targetIds: string[];
  rationale: string;
}

export interface ConfirmIntentRequest {
  sessionToken: string;
  secret: string;
  body: ConfirmIntentRequestBody;
  now?: Date;
}

export async function handleConfirmIntentRequest({
  sessionToken,
  secret,
  body,
  now = new Date()
}: ConfirmIntentRequest): Promise<{ confirmToken: string; expiresAt: string }> {
  const actorContext = verifySessionToken(sessionToken, secret, now);

  if ((actorContext.role !== 'Reviewer' && actorContext.role !== 'Admin') || actorContext.actorType === 'agent') {
    throw new Error('Reviewer confirmation requires a human reviewer session');
  }

  return createConfirmToken(
    {
      commandName: body.commandName,
      caseId: body.caseId,
      targetIds: body.targetIds,
      sessionId: actorContext.sessionId,
      role: actorContext.role,
      issuer: actorContext.issuer,
      reasonHash: hashConfirmationReason(body.rationale)
    },
    secret,
    now
  );
}