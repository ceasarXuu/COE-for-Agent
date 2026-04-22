export interface TimelineEvent {
  eventId: string;
  eventType: string;
  caseRevision: number;
  occurredAt: string;
  summary: string;
}

export interface FixtureGraphNode {
  id: string;
  kind: string;
  displayKind?: string;
  issueKind?: string | null;
  label: string;
  payload?: Record<string, unknown>;
  summary?: string | null;
  status: string | null;
  revision: number;
}

export interface FixtureGraphEdge {
  key: string;
  type: string;
  fromId: string;
  toId: string;
}

export interface RevisionState {
  revision: number;
  caseRecord: {
    id: string;
    title: string;
    severity: string;
    status: string;
    revision: number;
    objective: string;
    summary: string;
  };
  counts: {
    problems: number;
    hypotheses: number;
    blockers: number;
    repairAttempts: number;
    evidenceRefs: number;
  };
  nodes: FixtureGraphNode[];
  edges: FixtureGraphEdge[];
  timeline: TimelineEvent[];
  guardrails: {
    aggregate: {
      kind: string;
      warnings: Array<{ code: string; message: string; nodeIds: string[] }>;
      violations: Array<{ code: string; message: string; nodeIds: string[] }>;
    };
    stall: {
      kind: string;
      stall: boolean;
      reason: string | null;
      inquiryIds: string[];
    };
    readyToPatch: {
      kind: string;
      pass: boolean;
      candidateHypothesisIds: string[];
      candidatePatchRefs: string[];
      blockingGapIds: string[];
      blockingResidualIds: string[];
      uncoveredCriticalSymptomIds: string[];
      incompleteExperimentIds: string[];
      reasons: string[];
    };
    closeCase: {
      kind: string;
      pass: boolean;
      blockingInquiryIds: string[];
      blockingResidualIds: string[];
      missingValidationRefs: string[];
      reasons: string[];
    };
  };
}

export interface ManualCaseState {
  caseId: string;
  problemId: string;
  title: string;
  objective: string;
  severity: string;
  projectDirectory: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  headRevision: number;
  counts: RevisionState['counts'];
  nodes: RevisionState['nodes'];
  edges: RevisionState['edges'];
  timeline: TimelineEvent[];
  nextHypothesisSequence: number;
  nextBlockerSequence: number;
  nextRepairAttemptSequence: number;
  nextEvidenceSequence: number;
  nextEvidenceRefSequence: number;
  evidencePool: Array<{
    id: string;
    title: string;
    summary: string | null;
  }>;
}

export interface ToolResult {
  ok: boolean;
  headRevisionBefore: number;
  headRevisionAfter: number;
  projectionScheduled: boolean;
  createdIds?: string[];
  updatedIds?: string[];
  warnings: Array<{ code: string; message: string; nodeIds: string[] }>;
  violations: Array<{ code: string; message: string; nodeIds: string[] }>;
}
