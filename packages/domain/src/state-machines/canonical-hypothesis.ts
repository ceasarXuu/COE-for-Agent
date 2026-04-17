export type CanonicalHypothesisStatus = 'unverified' | 'blocked' | 'confirmed' | 'rejected';

const CANONICAL_HYPOTHESIS_TRANSITIONS: Record<CanonicalHypothesisStatus, ReadonlySet<CanonicalHypothesisStatus>> = {
  unverified: new Set(['blocked', 'confirmed', 'rejected']),
  blocked: new Set(['unverified']),
  confirmed: new Set([]),
  rejected: new Set([])
};

export function transitionCanonicalHypothesisStatus(
  current: CanonicalHypothesisStatus,
  next: CanonicalHypothesisStatus
): CanonicalHypothesisStatus {
  if (!CANONICAL_HYPOTHESIS_TRANSITIONS[current].has(next)) {
    throw new Error(`Invalid canonical hypothesis transition: ${current} -> ${next}`);
  }

  return next;
}
