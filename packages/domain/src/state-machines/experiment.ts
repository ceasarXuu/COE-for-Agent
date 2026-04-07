export type ExperimentStatus = 'planned' | 'running' | 'completed' | 'inconclusive' | 'canceled';

const EXPERIMENT_TRANSITIONS: Record<ExperimentStatus, ReadonlySet<ExperimentStatus>> = {
  planned: new Set(['running', 'completed', 'inconclusive', 'canceled']),
  running: new Set(['completed', 'inconclusive', 'canceled']),
  completed: new Set([]),
  inconclusive: new Set([]),
  canceled: new Set([])
};

export function transitionExperimentStatus(
  current: ExperimentStatus,
  next: ExperimentStatus
): ExperimentStatus {
  if (!EXPERIMENT_TRANSITIONS[current].has(next)) {
    throw new Error(`Invalid experiment transition: ${current} -> ${next}`);
  }

  return next;
}