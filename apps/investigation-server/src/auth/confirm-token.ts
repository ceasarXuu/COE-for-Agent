import { createHash } from 'node:crypto';

import type { ActorRole } from '@coe/domain';

import { issueSignedToken, verifySignedToken } from './token-codec.js';

const DEFAULT_CONFIRM_TTL_MS = 120 * 1000;

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

export interface IssueConfirmTokenInput {
  commandName: string;
  caseId: string;
  targetIds: string[];
  sessionId: string;
  role: ActorRole;
  issuer: string;
  reasonHash: string;
  expiresAt?: Date;
}

export interface VerifyConfirmTokenOptions {
  secret: string;
  expectedCommandName: string;
  expectedCaseId: string;
  expectedTargetIds: string[];
  expectedSessionId: string;
  expectedRole: ActorRole;
  expectedReasonHash: string;
  now?: Date;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }

  return value;
}

function requireStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`${fieldName} must be a string array`);
  }

  return normalizeTargetIds(value);
}

function toConfirmClaims(value: Record<string, unknown>): ConfirmTokenClaims {
  return {
    typ: 'confirm',
    commandName: requireString(value.commandName, 'commandName'),
    caseId: requireString(value.caseId, 'caseId'),
    targetIds: requireStringArray(value.targetIds, 'targetIds'),
    sessionId: requireString(value.sessionId, 'sessionId'),
    role: requireString(value.role, 'role') as ActorRole,
    issuer: requireString(value.issuer, 'issuer'),
    reasonHash: requireString(value.reasonHash, 'reasonHash'),
    issuedAt: requireString(value.issuedAt, 'issuedAt'),
    expiresAt: requireString(value.expiresAt, 'expiresAt')
  };
}

function normalizeTargetIds(targetIds: string[]): string[] {
  return [...new Set(targetIds)].sort();
}

export function hashConfirmationReason(reason: string): string {
  return createHash('sha256').update(reason.trim()).digest('hex');
}

export function issueConfirmToken(
  input: IssueConfirmTokenInput,
  secret: string,
  now: Date = new Date()
): string {
  const expiresAt = input.expiresAt ?? new Date(now.getTime() + DEFAULT_CONFIRM_TTL_MS);
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
    expiresAt: expiresAt.toISOString()
  };

  return issueSignedToken(claims as unknown as Record<string, unknown>, secret);
}

export function verifyConfirmToken(token: string, options: VerifyConfirmTokenOptions): ConfirmTokenClaims {
  const claims = toConfirmClaims(verifySignedToken(token, options.secret));
  const now = options.now ?? new Date();

  if (claims.typ !== 'confirm') {
    throw new Error('Unexpected confirm token type');
  }

  if (new Date(claims.expiresAt).getTime() <= now.getTime()) {
    throw new Error('confirmToken expired');
  }

  if (claims.commandName !== options.expectedCommandName) {
    throw new Error('confirmToken command mismatch');
  }

  if (claims.caseId !== options.expectedCaseId) {
    throw new Error('confirmToken case mismatch');
  }

  if (claims.sessionId !== options.expectedSessionId) {
    throw new Error('confirmToken session mismatch');
  }

  if (claims.role !== options.expectedRole) {
    throw new Error('confirmToken role mismatch');
  }

  if (claims.reasonHash !== options.expectedReasonHash) {
    throw new Error('confirmToken rationale mismatch');
  }

  const expectedTargetIds = normalizeTargetIds(options.expectedTargetIds);
  if (claims.targetIds.length !== expectedTargetIds.length || claims.targetIds.some((value, index) => value !== expectedTargetIds[index])) {
    throw new Error('confirmToken targets mismatch');
  }

  return claims;
}
