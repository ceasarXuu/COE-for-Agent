import type { RevisionState } from './types.js';

import { consoleTelemetry } from '../../server/telemetry.js';

export const FIXTURE_IDS = {
  caseId: 'case_01FIXTUREINVESTIGATION0001',
  problemId: 'problem_01FIXTUREINVESTIGATION',
  hypothesisId: 'hypothesis_01FIXTUREINVESTIGATE',
  blockerId: 'blocker_01FIXTUREINVESTIGATIO',
  evidenceId: 'evidence_01FIXTUREINVESTIGATI',
  evidenceRefId: 'evidence_ref_01FIXTUREINVES',
  repairAttemptId: 'repair_attempt_01FIXTUREI'
} as const;

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function requireString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  throw new Error(`${key} is required`);
}

export function parseResourceUri(uri: string) {
  const url = new URL(uri);
  const segments = url.pathname.split('/').filter(Boolean);

  return {
    url,
    collection: url.hostname,
    segments
  };
}

export function pickRevision(states: RevisionState[], requestedRevision: number | null): RevisionState {
  const head = states[states.length - 1]!;
  if (requestedRevision === null || requestedRevision >= head.revision) {
    return head;
  }

  return states.find((state) => state.revision === requestedRevision) ?? head;
}

export function detectProjectionModel(nodes: Array<{ kind: string }>): 'legacy' | 'canonical' {
  return nodes.some((node) => node.kind === 'problem') ? 'canonical' : 'legacy';
}

export function pushRevision(revisions: RevisionState[], nextRevision: RevisionState) {
  revisions.push(nextRevision);
  consoleTelemetry.emit('case.head_revision.changed', {
    caseId: FIXTURE_IDS.caseId,
    headRevision: nextRevision.revision
  });
  consoleTelemetry.emit('case.projection.updated', {
    caseId: FIXTURE_IDS.caseId,
    projection: 'snapshot',
    headRevision: nextRevision.revision,
    projectionRevision: nextRevision.revision
  });
}
