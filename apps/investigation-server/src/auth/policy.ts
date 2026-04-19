import type { ActorContext, ActorRole } from '@coe/domain';

const ROLE_RANK: Record<ActorRole, number> = {
  Viewer: 0,
  Operator: 1,
  Reviewer: 2,
  Admin: 3
};

const REVIEWER_ONLY_CASE_STAGES = new Set(['repair_preparation', 'repair_validation', 'closed']);

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
    actorType: requireStringField(actorContext, 'actorType') as ActorContext['actorType'],
    actorId: requireStringField(actorContext, 'actorId'),
    sessionId: requireStringField(actorContext, 'sessionId'),
    role: requireStringField(actorContext, 'role') as ActorRole,
    issuer: requireStringField(actorContext, 'issuer'),
    authMode: requireStringField(actorContext, 'authMode') as ActorContext['authMode']
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
    case 'investigation.case.advance_stage': {
      const stage = optionalString(input.stage) ?? '';
      const reviewerOnly = REVIEWER_ONLY_CASE_STAGES.has(stage);
      return buildRequirement(input, {
        minimumRole: reviewerOnly ? 'Reviewer' : 'Operator',
        reviewerOnly,
        requiresConfirmToken: reviewerOnly,
        targetIds: [requireStringField(input, 'caseId')],
        reasonText: optionalString(input.reason) ?? stage
      });
    }
    default:
      return buildRequirement(input);
  }
}

export function assertAuthorizedActor(actorContext: ActorContext, requirement: AuthorizationRequirement): void {
  if (ROLE_RANK[actorContext.role] < ROLE_RANK[requirement.minimumRole]) {
    throw new Error(`${actorContext.role} is not authorized for this command; minimum role is ${requirement.minimumRole}`);
  }

  if (requirement.reviewerOnly && actorContext.actorType === 'agent') {
    throw new Error('Reviewer-only commands require a human session');
  }
}
