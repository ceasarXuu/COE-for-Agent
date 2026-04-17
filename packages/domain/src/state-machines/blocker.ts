export type BlockerStatus = 'active' | 'closed';

const BLOCKER_TRANSITIONS: Record<BlockerStatus, ReadonlySet<BlockerStatus>> = {
  active: new Set(['closed']),
  closed: new Set([])
};

export function transitionBlockerStatus(current: BlockerStatus, next: BlockerStatus): BlockerStatus {
  if (!BLOCKER_TRANSITIONS[current].has(next)) {
    throw new Error(`Invalid blocker transition: ${current} -> ${next}`);
  }

  return next;
}
