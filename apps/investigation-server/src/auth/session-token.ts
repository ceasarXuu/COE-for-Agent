import { randomUUID } from 'node:crypto';

import type { ActorContext, ActorRole, ActorType, AuthMode } from '@coe/domain';

import { issueSignedToken, verifySignedToken } from './token-codec.js';

const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

interface SessionTokenClaims {
  typ: 'session';
  actorType: ActorType;
  actorId: string;
  sessionId: string;
  role: ActorRole;
  issuer: string;
  authMode: AuthMode;
  issuedAt: string;
  expiresAt: string;
}

export interface IssueSessionTokenInput {
  actorType: ActorType;
  actorId: string;
  sessionId?: string;
  role: ActorRole;
  issuer: string;
  authMode: AuthMode;
  expiresAt?: Date;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }

  return value;
}

function toSessionClaims(value: Record<string, unknown>): SessionTokenClaims {
  return {
    typ: 'session',
    actorType: requireString(value.actorType, 'actorType') as ActorType,
    actorId: requireString(value.actorId, 'actorId'),
    sessionId: requireString(value.sessionId, 'sessionId'),
    role: requireString(value.role, 'role') as ActorRole,
    issuer: requireString(value.issuer, 'issuer'),
    authMode: requireString(value.authMode, 'authMode') as AuthMode,
    issuedAt: requireString(value.issuedAt, 'issuedAt'),
    expiresAt: requireString(value.expiresAt, 'expiresAt')
  };
}

export function issueSessionToken(
  input: IssueSessionTokenInput,
  secret: string,
  now: Date = new Date()
): { sessionToken: string; expiresAt: string; actorContext: ActorContext } {
  const sessionId = input.sessionId ?? randomUUID();
  const expiresAt = input.expiresAt ?? new Date(now.getTime() + DEFAULT_SESSION_TTL_MS);
  const claims: SessionTokenClaims = {
    typ: 'session',
    actorType: input.actorType,
    actorId: input.actorId,
    sessionId,
    role: input.role,
    issuer: input.issuer,
    authMode: input.authMode,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  return {
    sessionToken: issueSignedToken(claims as unknown as Record<string, unknown>, secret),
    expiresAt: claims.expiresAt,
    actorContext: {
      actorType: claims.actorType,
      actorId: claims.actorId,
      sessionId: claims.sessionId,
      role: claims.role,
      issuer: claims.issuer,
      authMode: claims.authMode
    }
  };
}

export function verifySessionToken(
  sessionToken: string,
  secret: string,
  now: Date = new Date()
): ActorContext {
  const claims = toSessionClaims(verifySignedToken(sessionToken, secret));

  if (claims.typ !== 'session') {
    throw new Error('Unexpected session token type');
  }

  if (new Date(claims.expiresAt).getTime() <= now.getTime()) {
    throw new Error('sessionToken expired');
  }

  return {
    actorType: claims.actorType,
    actorId: claims.actorId,
    sessionId: claims.sessionId,
    role: claims.role,
    issuer: claims.issuer,
    authMode: claims.authMode
  };
}