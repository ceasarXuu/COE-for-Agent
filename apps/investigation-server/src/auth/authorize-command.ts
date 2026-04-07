import type { ActorContext } from '@coe/domain';
import type { MutationToolName } from '@coe/mcp-contracts/tool-names';

import { hashConfirmationReason, verifyConfirmToken } from './confirm-token.js';
import { assertAuthorizedActor, getAuthorizationRequirement, parseActorContext } from './policy.js';

export interface AuthorizeMutationCommandOptions {
  commandName: MutationToolName;
  input: Record<string, unknown>;
  secret: string;
  now?: Date;
}

export function authorizeMutationCommand({
  commandName,
  input,
  secret,
  now
}: AuthorizeMutationCommandOptions): ActorContext {
  const actorContext = parseActorContext(input.actorContext);
  const requirement = getAuthorizationRequirement(commandName, input);

  assertAuthorizedActor(actorContext, requirement);

  if (requirement.requiresConfirmToken) {
    const confirmToken = typeof input.confirmToken === 'string' ? input.confirmToken : '';
    if (!confirmToken) {
      throw new Error(`confirmToken is required for ${commandName}`);
    }

    if (!requirement.caseId) {
      throw new Error(`caseId is required for ${commandName}`);
    }

    const verifyOptions = {
      secret,
      expectedCommandName: commandName,
      expectedCaseId: requirement.caseId,
      expectedTargetIds: requirement.targetIds,
      expectedSessionId: actorContext.sessionId,
      expectedRole: actorContext.role,
      expectedReasonHash: hashConfirmationReason(requirement.reasonText),
      ...(now ? { now } : {})
    };

    verifyConfirmToken(confirmToken, verifyOptions);
  }

  return actorContext;
}