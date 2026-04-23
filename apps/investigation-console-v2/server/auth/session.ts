import type { ActorContext } from '@coe/domain';

import { createSessionToken, verifySessionToken } from './token-codec.js';

export function createLocalSession(
  actor: Omit<ActorContext, 'sessionId'> & { sessionId?: string },
  secret: string,
  now: Date = new Date()
) {
  return createSessionToken(actor, secret, now);
}

export function resolveLocalSession(
  sessionToken: string,
  secret: string,
  now: Date = new Date()
): ActorContext {
  return verifySessionToken(sessionToken, secret, now);
}