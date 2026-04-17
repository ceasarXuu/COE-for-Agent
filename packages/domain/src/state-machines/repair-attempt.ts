export type RepairAttemptStatus = 'proposed' | 'running' | 'effective' | 'ineffective';

const REPAIR_ATTEMPT_TRANSITIONS: Record<RepairAttemptStatus, ReadonlySet<RepairAttemptStatus>> = {
  proposed: new Set(['running']),
  running: new Set(['effective', 'ineffective']),
  effective: new Set([]),
  ineffective: new Set([])
};

export function transitionRepairAttemptStatus(
  current: RepairAttemptStatus,
  next: RepairAttemptStatus
): RepairAttemptStatus {
  if (!REPAIR_ATTEMPT_TRANSITIONS[current].has(next)) {
    throw new Error(`Invalid repair attempt transition: ${current} -> ${next}`);
  }

  return next;
}
