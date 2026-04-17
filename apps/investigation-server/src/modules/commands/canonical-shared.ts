import type { CanonicalGraphNodeKind, CanonicalNodeStatus } from '@coe/domain';
import { assertCanonicalChildCreation } from '@coe/domain';
import { CurrentStateRepository } from '@coe/persistence';

import type { InvestigationServerTransaction } from '../../services.js';
import { recordPayload, stringValue } from '../shared/record-helpers.js';

export interface CanonicalParentContext {
  id: string;
  kind: CanonicalGraphNodeKind;
  status: CanonicalNodeStatus;
}

export async function requireCanonicalParent(
  trx: InvestigationServerTransaction,
  caseId: string,
  parentNodeId: string
): Promise<CanonicalParentContext> {
  const currentState = new CurrentStateRepository(trx);

  const problem = await currentState.getRecord('problems', parentNodeId);
  if (problem && problem.caseId === caseId) {
    return {
      id: problem.id,
      kind: 'problem',
      status: (problem.status ?? 'open') as CanonicalNodeStatus
    };
  }

  const hypothesis = await currentState.getRecord('hypotheses', parentNodeId);
  if (hypothesis && hypothesis.caseId === caseId) {
    const payload = recordPayload(hypothesis);
    if (stringValue(payload.canonicalKind) === 'hypothesis') {
      return {
        id: hypothesis.id,
        kind: 'hypothesis',
        status: (hypothesis.status ?? 'unverified') as CanonicalNodeStatus
      };
    }
  }

  const repairAttempt = await currentState.getRecord('repair_attempts', parentNodeId);
  if (repairAttempt && repairAttempt.caseId === caseId) {
    return {
      id: repairAttempt.id,
      kind: 'repair_attempt',
      status: (repairAttempt.status ?? 'proposed') as CanonicalNodeStatus
    };
  }

  throw new Error(`Canonical parent not found: ${parentNodeId}`);
}

export function assertCanonicalChildUnderParent(
  parent: CanonicalParentContext,
  childKind: CanonicalGraphNodeKind
) {
  assertCanonicalChildCreation(
    {
      parentKind: parent.kind,
      parentStatus: parent.status
    },
    childKind
  );
}
