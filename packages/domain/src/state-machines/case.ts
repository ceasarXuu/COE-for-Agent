export type CaseStatus = 'active' | 'closed';

const CASE_STATUS_TRANSITIONS: Record<CaseStatus, Set<CaseStatus>> = {
  active: new Set(['closed']),
  closed: new Set([])
};

export function transitionCaseStatus(current: CaseStatus, nextStatus: CaseStatus): CaseStatus {
  if (current === nextStatus) {
    return current;
  }

  const allowedTargets = CASE_STATUS_TRANSITIONS[current];
  if (!allowedTargets?.has(nextStatus)) {
    throw new Error(`Invalid case transition: ${current} -> ${nextStatus}`);
  }

  return nextStatus;
}
