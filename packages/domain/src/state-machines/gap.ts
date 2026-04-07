export type GapStatus = 'open' | 'in_progress' | 'blocked' | 'resolved' | 'waived';

const GAP_TRANSITIONS: Record<GapStatus, ReadonlySet<GapStatus>> = {
  open: new Set(['in_progress', 'blocked', 'resolved', 'waived']),
  in_progress: new Set(['blocked', 'resolved', 'waived']),
  blocked: new Set(['in_progress', 'resolved', 'waived']),
  resolved: new Set([]),
  waived: new Set([])
};

export function transitionGapStatus(current: GapStatus, next: GapStatus): GapStatus {
  if (!GAP_TRANSITIONS[current].has(next)) {
    throw new Error(`Invalid gap transition: ${current} -> ${next}`);
  }

  return next;
}