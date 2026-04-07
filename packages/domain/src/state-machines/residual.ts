export type ResidualStatus = 'open' | 'reduced' | 'resolved' | 'accepted';

const RESIDUAL_TRANSITIONS: Record<ResidualStatus, ReadonlySet<ResidualStatus>> = {
  open: new Set(['reduced', 'resolved', 'accepted']),
  reduced: new Set(['open', 'resolved', 'accepted']),
  resolved: new Set([]),
  accepted: new Set([])
};

export function transitionResidualStatus(
  current: ResidualStatus,
  next: ResidualStatus
): ResidualStatus {
  if (!RESIDUAL_TRANSITIONS[current].has(next)) {
    throw new Error(`Invalid residual transition: ${current} -> ${next}`);
  }

  return next;
}