import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import type { ActorContext, ActorRole, ActorType, AuthMode } from '@coe/domain';

const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DEFAULT_CONFIRM_TTL_MS = 120 * 1000;

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

interface ConfirmTokenClaims {
  typ: 'confirm';
  commandName: string;
  caseId: string;
  targetIds: string[];
  sessionId: string;
  role: ActorRole;
  issuer: string;
  reasonHash: string;
  issuedAt: string;
  expiresAt: string;
}

function encodeJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeJson(encoded: string): Record<string, unknown> {
  const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
  const value = JSON.parse(decoded) as unknown;

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Token payload must be an object');
  }

  return value as Record<string, unknown>;
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function issueSignedToken(payload: Record<string, unknown>, secret: string): string {
  const encodedPayload = encodeJson(payload);
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

function verifySignedToken(token: string, secret: string): Record<string, unknown> {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Malformed signed token');
  }

  const expectedSignature = sign(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature, 'base64url');
  const expectedBuffer = Buffer.from(expectedSignature, 'base64url');
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error('Signed token signature mismatch');
  }

  return decodeJson(encodedPayload);
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }

  return value;
}

function normalizeTargetIds(targetIds: string[]): string[] {
  return [...new Set(targetIds)].sort();
}

export function createSessionToken(
  actor: Omit<ActorContext, 'sessionId'> & { sessionId?: string },
  secret: string,
  now: Date = new Date()
): { sessionToken: string; expiresAt: string; actorContext: ActorContext } {
  const sessionId = actor.sessionId ?? randomUUID();
  const expiresAt = new Date(now.getTime() + DEFAULT_SESSION_TTL_MS).toISOString();
  const claims: SessionTokenClaims = {
    typ: 'session',
    actorType: actor.actorType,
    actorId: actor.actorId,
    sessionId,
    role: actor.role,
    issuer: actor.issuer,
    authMode: actor.authMode,
    issuedAt: now.toISOString(),
    expiresAt
  };

  return {
    sessionToken: issueSignedToken(claims as unknown as Record<string, unknown>, secret),
    expiresAt,
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

export function verifySessionToken(sessionToken: string, secret: string, now: Date = new Date()): ActorContext {
  const payload = verifySignedToken(sessionToken, secret);
  const claims: SessionTokenClaims = {
    typ: 'session',
    actorType: requireString(payload.actorType, 'actorType') as ActorType,
    actorId: requireString(payload.actorId, 'actorId'),
    sessionId: requireString(payload.sessionId, 'sessionId'),
    role: requireString(payload.role, 'role') as ActorRole,
    issuer: requireString(payload.issuer, 'issuer'),
    authMode: requireString(payload.authMode, 'authMode') as AuthMode,
    issuedAt: requireString(payload.issuedAt, 'issuedAt'),
    expiresAt: requireString(payload.expiresAt, 'expiresAt')
  };

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

export function hashConfirmationReason(reason: string): string {
  return createHash('sha256').update(reason.trim()).digest('hex');
}

export function createConfirmToken(
  input: {
    commandName: string;
    caseId: string;
    targetIds: string[];
    sessionId: string;
    role: ActorRole;
    issuer: string;
    reasonHash: string;
  },
  secret: string,
  now: Date = new Date()
): { confirmToken: string; expiresAt: string } {
  const expiresAt = new Date(now.getTime() + DEFAULT_CONFIRM_TTL_MS).toISOString();
  const claims: ConfirmTokenClaims = {
    typ: 'confirm',
    commandName: input.commandName,
    caseId: input.caseId,
    targetIds: normalizeTargetIds(input.targetIds),
    sessionId: input.sessionId,
    role: input.role,
    issuer: input.issuer,
    reasonHash: input.reasonHash,
    issuedAt: now.toISOString(),
    expiresAt
  };

  return {
    confirmToken: issueSignedToken(claims as unknown as Record<string, unknown>, secret),
    expiresAt
  };
}