export type HypothesisStatus = 'proposed' | 'active' | 'favored' | 'weakened' | 'rejected' | 'confirmed';

const HYPOTHESIS_TRANSITIONS: Record<HypothesisStatus, ReadonlySet<HypothesisStatus>> = {
  proposed: new Set(['active', 'rejected']),
  active: new Set(['favored', 'weakened', 'rejected', 'confirmed']),
  favored: new Set(['weakened', 'rejected', 'confirmed']),
  weakened: new Set(['active', 'rejected']),
  rejected: new Set([]),
  confirmed: new Set([])
};

export function transitionHypothesisStatus(
  current: HypothesisStatus,
  next: HypothesisStatus
): HypothesisStatus {
  if (!HYPOTHESIS_TRANSITIONS[current].has(next)) {
    throw new Error(`Invalid hypothesis transition: ${current} -> ${next}`);
  }

  return next;
}