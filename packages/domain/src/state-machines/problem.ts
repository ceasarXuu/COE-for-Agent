export type ProblemStatus = 'open' | 'resolved' | 'abandoned';

const PROBLEM_TRANSITIONS: Record<ProblemStatus, ReadonlySet<ProblemStatus>> = {
  open: new Set(['resolved', 'abandoned']),
  resolved: new Set([]),
  abandoned: new Set([])
};

export function transitionProblemStatus(current: ProblemStatus, next: ProblemStatus): ProblemStatus {
  if (!PROBLEM_TRANSITIONS[current].has(next)) {
    throw new Error(`Invalid problem transition: ${current} -> ${next}`);
  }

  return next;
}
