import type { ActorContext, ActorRole, ActorType, AuthMode } from '@coe/domain';

const ROLE_RANK: Record<ActorRole, number> = {
  Viewer: 0,
  Operator: 1,
  Reviewer: 2,
  Admin: 3
};

const KNOWN_ACTOR_ROLES = new Set<ActorRole>(['Viewer', 'Operator', 'Reviewer', 'Admin']);
const KNOWN_ACTOR_TYPES = new Set<ActorType>(['agent', 'user', 'system', 'adapter', 'tool_runner']);
const KNOWN_AUTH_MODES = new Set<AuthMode>(['local', 'oidc', 'service']);

function assertActorRole(value: string): ActorRole {
  if (!KNOWN_ACTOR_ROLES.has(value as ActorRole)) {
    throw new Error(`Unknown actor role: ${value}`);
  }
  return value as ActorRole;
}

function assertActorType(value: string): ActorType {
  if (!KNOWN_ACTOR_TYPES.has(value as ActorType)) {
    throw new Error(`Unknown actorType: ${value}`);
  }
  return value as ActorType;
}

function assertAuthMode(value: string): AuthMode {
  if (!KNOWN_AUTH_MODES.has(value as AuthMode)) {
    throw new Error(`Unknown authMode: ${value}`);
  }
  return value as AuthMode;
}

export interface AuthorizationRequirement {
  minimumRole: ActorRole;
  reviewerOnly: boolean;
  requiresConfirmToken: boolean;
  caseId?: string;
  targetIds: string[];
  reasonText: string;
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  throw new Error('actorContext must be an object');
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function requireStringField(input: Record<string, unknown>, fieldName: string): string {
  const value = optionalString(input[fieldName]);
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }

  return value;
}

function buildRequirement(input: Record<string, unknown>, overrides: Partial<AuthorizationRequirement> = {}): AuthorizationRequirement {
  const caseId = optionalString(input.caseId);
  return {
    minimumRole: 'Operator',
    reviewerOnly: false,
    requiresConfirmToken: false,
    targetIds: caseId ? [caseId] : [],
    reasonText: '',
    ...(caseId ? { caseId } : {}),
    ...overrides
  };
}

export function parseActorContext(value: unknown): ActorContext {
  const actorContext = asObject(value);

  return {
    actorType: assertActorType(requireStringField(actorContext, 'actorType')),
    actorId: requireStringField(actorContext, 'actorId'),
    sessionId: requireStringField(actorContext, 'sessionId'),
    role: assertActorRole(requireStringField(actorContext, 'role')),
    issuer: requireStringField(actorContext, 'issuer'),
    authMode: assertAuthMode(requireStringField(actorContext, 'authMode'))
  };
}

export function getAuthorizationRequirement(
  commandName: string,
  input: Record<string, unknown>
): AuthorizationRequirement {
  switch (commandName) {
    case 'investigation.hypothesis.set_status': {
      const newStatus = optionalString(input.newStatus);
      return buildRequirement(input, {
        minimumRole: newStatus === 'confirmed' ? 'Reviewer' : 'Operator',
        reviewerOnly: newStatus === 'confirmed',
        requiresConfirmToken: newStatus === 'confirmed',
        targetIds: [requireStringField(input, 'hypothesisId')],
        reasonText: optionalString(input.reason) ?? ''
      });
    }
    case 'investigation.case.close': {
      return buildRequirement(input, {
        minimumRole: 'Reviewer',
        reviewerOnly: true,
        requiresConfirmToken: true,
        targetIds: [requireStringField(input, 'caseId')],
        reasonText: optionalString(input.reason) ?? 'close'
      });
    }
    default:
      return buildRequirement(input);
  }
}

export function assertAuthorizedActor(actorContext: ActorContext, requirement: AuthorizationRequirement): void {
  const actorRank = ROLE_RANK[actorContext.role];
  const requiredRank = ROLE_RANK[requirement.minimumRole];
  if (typeof actorRank !== 'number' || typeof requiredRank !== 'number' || actorRank < requiredRank) {
    throw new Error(`${actorContext.role} is not authorized for this command; minimum role is ${requirement.minimumRole}`);
  }

  if (requirement.reviewerOnly && actorContext.actorType === 'agent') {
    throw new Error('Reviewer-only commands require a human session');
  }
}
