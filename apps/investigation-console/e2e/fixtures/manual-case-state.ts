import type { ManualCaseState, ToolResult } from './types.js';

import { requireString } from './helpers.js';

export function buildManualCaseState(input: Record<string, unknown>, sequence: number): ManualCaseState {
  const suffix = String(sequence).padStart(24, '0');
  const caseId = `case_${suffix}`;
  const problemId = `problem_${String(sequence).padStart(22, '0')}`;
  const createdAt = new Date(Date.UTC(2025, 0, 2, 8, sequence, 0)).toISOString();
  const labels = Array.isArray(input.labels)
    ? input.labels.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];

  return {
    caseId,
    problemId,
    title: requireString(input, 'title'),
    objective: requireString(input, 'objective'),
    severity: typeof input.severity === 'string' ? input.severity : 'high',
    projectDirectory: requireString(input, 'projectDirectory'),
    labels,
    createdAt,
    updatedAt: createdAt,
    headRevision: 1,
    counts: {
      problems: 1,
      hypotheses: 0,
      blockers: 0,
      repairAttempts: 0,
      evidenceRefs: 0
    },
    nodes: [
      {
        id: problemId,
        kind: 'problem',
        label: requireString(input, 'title'),
        status: 'open',
        revision: 1,
        summary: requireString(input, 'objective'),
        payload: {
          title: requireString(input, 'title'),
          description: requireString(input, 'objective'),
          environment: '',
          symptoms: [],
          resolutionCriteria: []
        }
      }
    ],
    edges: [],
    timeline: [
      {
        eventId: `event_${caseId}_opened`,
        eventType: 'case.opened',
        caseRevision: 1,
        occurredAt: createdAt,
        summary: 'Canonical case opened with a problem root.'
      }
    ],
    nextHypothesisSequence: 1,
    nextBlockerSequence: 1,
    nextRepairAttemptSequence: 1,
    nextEvidenceSequence: 1,
    nextEvidenceRefSequence: 1,
    evidencePool: []
  };
}

function nextTimestamp(manualCase: ManualCaseState, nextRevision: number) {
  return new Date(Date.parse(manualCase.createdAt) + nextRevision * 60_000).toISOString();
}

export function recordManualHypothesis(manualCase: ManualCaseState, input: Record<string, unknown>): ToolResult {
  const revision = manualCase.headRevision + 1;
  const hypothesisId = `hypothesis_${manualCase.caseId}_${String(manualCase.nextHypothesisSequence++).padStart(4, '0')}`;
  const parentNodeId = requireString(input, 'parentNodeId');
  const statement = requireString(input, 'statement');
  const occurredAt = nextTimestamp(manualCase, revision);

  manualCase.headRevision = revision;
  manualCase.updatedAt = occurredAt;
  manualCase.nodes.push({
    id: hypothesisId,
    kind: 'hypothesis',
    label: statement,
    status: 'unverified',
    revision,
    summary: statement,
    payload: {
      title: statement,
      statement,
      falsificationCriteria: Array.isArray(input.falsificationCriteria)
        ? input.falsificationCriteria.filter((value): value is string => typeof value === 'string' && value.length > 0)
        : []
    }
  });
  manualCase.edges.push({
    key: `structural:${parentNodeId}:${hypothesisId}`,
    type: 'structural',
    fromId: parentNodeId,
    toId: hypothesisId
  });
  manualCase.timeline.push({
    eventId: `event_${hypothesisId}_created`,
    eventType: 'canonical.hypothesis.created',
    caseRevision: revision,
    occurredAt,
    summary: 'Canonical hypothesis created.'
  });
  manualCase.counts = recomputeCounts(manualCase.nodes);

  return {
    ok: true,
    headRevisionBefore: revision - 1,
    headRevisionAfter: revision,
    projectionScheduled: false,
    createdIds: [hypothesisId],
    warnings: [],
    violations: []
  };
}

export function updateManualHypothesisStatus(manualCase: ManualCaseState, input: Record<string, unknown>): ToolResult {
  const revision = manualCase.headRevision + 1;
  const hypothesisId = requireString(input, 'hypothesisId');
  const newStatus = requireString(input, 'newStatus');
  const occurredAt = nextTimestamp(manualCase, revision);

  manualCase.headRevision = revision;
  manualCase.updatedAt = occurredAt;
  manualCase.nodes = manualCase.nodes.map((node) => node.id === hypothesisId
    ? { ...node, status: newStatus, revision }
    : node);
  manualCase.timeline.push({
    eventId: `event_${hypothesisId}_status`,
    eventType: 'canonical.hypothesis.status_updated',
    caseRevision: revision,
    occurredAt,
    summary: 'Canonical hypothesis status updated.'
  });

  return {
    ok: true,
    headRevisionBefore: revision - 1,
    headRevisionAfter: revision,
    projectionScheduled: false,
    updatedIds: [hypothesisId],
    warnings: [],
    violations: []
  };
}

export function updateManualHypothesis(manualCase: ManualCaseState, input: Record<string, unknown>): ToolResult {
  const revision = manualCase.headRevision + 1;
  const hypothesisId = requireString(input, 'hypothesisId');
  const occurredAt = nextTimestamp(manualCase, revision);
  const title = typeof input.title === 'string' && input.title.trim().length > 0 ? input.title.trim() : null;
  const statement = typeof input.statement === 'string' && input.statement.trim().length > 0 ? input.statement.trim() : null;
  const falsificationCriteria = Array.isArray(input.falsificationCriteria)
    ? input.falsificationCriteria.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : undefined;

  manualCase.headRevision = revision;
  manualCase.updatedAt = occurredAt;
  manualCase.nodes = manualCase.nodes.map((node) => node.id === hypothesisId
    ? {
        ...node,
        label: statement ?? title ?? node.label,
        revision,
        summary: statement ?? node.summary,
        payload: {
          ...(node.payload ?? {}),
          ...(title ? { title } : {}),
          ...(statement ? { statement } : {}),
          ...(falsificationCriteria ? { falsificationCriteria } : {})
        }
      }
    : node);
  manualCase.timeline.push({
    eventId: `event_${hypothesisId}_updated`,
    eventType: 'canonical.hypothesis.updated',
    caseRevision: revision,
    occurredAt,
    summary: 'Canonical hypothesis updated.'
  });

  return {
    ok: true,
    headRevisionBefore: revision - 1,
    headRevisionAfter: revision,
    projectionScheduled: false,
    updatedIds: [hypothesisId],
    warnings: [],
    violations: []
  };
}

export function recordManualBlocker(manualCase: ManualCaseState, input: Record<string, unknown>): ToolResult {
  const revision = manualCase.headRevision + 1;
  const blockerId = `blocker_${manualCase.caseId}_${String(manualCase.nextBlockerSequence++).padStart(4, '0')}`;
  const hypothesisId = requireString(input, 'hypothesisId');
  const description = requireString(input, 'description');
  const occurredAt = nextTimestamp(manualCase, revision);

  manualCase.headRevision = revision;
  manualCase.updatedAt = occurredAt;
  manualCase.nodes.push({
    id: blockerId,
    kind: 'blocker',
    label: description,
    status: 'active',
    revision,
    summary: description,
    payload: {
      description,
      possibleWorkarounds: Array.isArray(input.possibleWorkarounds)
        ? input.possibleWorkarounds.filter((value): value is string => typeof value === 'string' && value.length > 0)
        : []
    }
  });
  manualCase.edges.push({
    key: `structural:${hypothesisId}:${blockerId}`,
    type: 'structural',
    fromId: hypothesisId,
    toId: blockerId
  });
  manualCase.timeline.push({
    eventId: `event_${blockerId}_opened`,
    eventType: 'canonical.blocker.opened',
    caseRevision: revision,
    occurredAt,
    summary: 'Canonical blocker opened.'
  });
  manualCase.counts = recomputeCounts(manualCase.nodes);

  return {
    ok: true,
    headRevisionBefore: revision - 1,
    headRevisionAfter: revision,
    projectionScheduled: false,
    createdIds: [blockerId],
    warnings: [],
    violations: []
  };
}

export function closeManualBlocker(manualCase: ManualCaseState, input: Record<string, unknown>): ToolResult {
  const revision = manualCase.headRevision + 1;
  const blockerId = requireString(input, 'blockerId');
  const occurredAt = nextTimestamp(manualCase, revision);

  manualCase.headRevision = revision;
  manualCase.updatedAt = occurredAt;
  manualCase.nodes = manualCase.nodes.map((node) => node.id === blockerId
    ? { ...node, status: 'closed', revision }
    : node);
  manualCase.timeline.push({
    eventId: `event_${blockerId}_closed`,
    eventType: 'canonical.blocker.closed',
    caseRevision: revision,
    occurredAt,
    summary: 'Canonical blocker closed.'
  });

  return {
    ok: true,
    headRevisionBefore: revision - 1,
    headRevisionAfter: revision,
    projectionScheduled: false,
    updatedIds: [blockerId],
    warnings: [],
    violations: []
  };
}

export function updateManualBlocker(manualCase: ManualCaseState, input: Record<string, unknown>): ToolResult {
  const revision = manualCase.headRevision + 1;
  const blockerId = requireString(input, 'blockerId');
  const occurredAt = nextTimestamp(manualCase, revision);
  const description = typeof input.description === 'string' && input.description.trim().length > 0 ? input.description.trim() : null;
  const possibleWorkarounds = Array.isArray(input.possibleWorkarounds)
    ? input.possibleWorkarounds.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : undefined;

  manualCase.headRevision = revision;
  manualCase.updatedAt = occurredAt;
  manualCase.nodes = manualCase.nodes.map((node) => node.id === blockerId
    ? {
        ...node,
        label: description ?? node.label,
        revision,
        summary: description ?? node.summary,
        payload: {
          ...(node.payload ?? {}),
          ...(description ? { description } : {}),
          ...(possibleWorkarounds ? { possibleWorkarounds } : {})
        }
      }
    : node);
  manualCase.timeline.push({
    eventId: `event_${blockerId}_updated`,
    eventType: 'canonical.blocker.updated',
    caseRevision: revision,
    occurredAt,
    summary: 'Canonical blocker updated.'
  });

  return {
    ok: true,
    headRevisionBefore: revision - 1,
    headRevisionAfter: revision,
    projectionScheduled: false,
    updatedIds: [blockerId],
    warnings: [],
    violations: []
  };
}

export function recordManualRepairAttempt(manualCase: ManualCaseState, input: Record<string, unknown>): ToolResult {
  const revision = manualCase.headRevision + 1;
  const repairAttemptId = `repair_attempt_${manualCase.caseId}_${String(manualCase.nextRepairAttemptSequence++).padStart(4, '0')}`;
  const parentNodeId = requireString(input, 'parentNodeId');
  const changeSummary = requireString(input, 'changeSummary');
  const occurredAt = nextTimestamp(manualCase, revision);

  manualCase.headRevision = revision;
  manualCase.updatedAt = occurredAt;
  manualCase.nodes.push({
    id: repairAttemptId,
    kind: 'repair_attempt',
    label: changeSummary,
    status: 'proposed',
    revision,
    summary: changeSummary,
    payload: {
      changeSummary,
      scope: typeof input.scope === 'string' ? input.scope : ''
    }
  });
  manualCase.edges.push({
    key: `structural:${parentNodeId}:${repairAttemptId}`,
    type: 'structural',
    fromId: parentNodeId,
    toId: repairAttemptId
  });
  manualCase.timeline.push({
    eventId: `event_${repairAttemptId}_created`,
    eventType: 'canonical.repair_attempt.created',
    caseRevision: revision,
    occurredAt,
    summary: 'Canonical repair attempt created.'
  });
  manualCase.counts = recomputeCounts(manualCase.nodes);

  return {
    ok: true,
    headRevisionBefore: revision - 1,
    headRevisionAfter: revision,
    projectionScheduled: false,
    createdIds: [repairAttemptId],
    warnings: [],
    violations: []
  };
}

export function updateManualRepairAttemptStatus(manualCase: ManualCaseState, input: Record<string, unknown>): ToolResult {
  const revision = manualCase.headRevision + 1;
  const repairAttemptId = requireString(input, 'repairAttemptId');
  const newStatus = requireString(input, 'newStatus');
  const occurredAt = nextTimestamp(manualCase, revision);

  manualCase.headRevision = revision;
  manualCase.updatedAt = occurredAt;
  manualCase.nodes = manualCase.nodes.map((node) => node.id === repairAttemptId
    ? { ...node, status: newStatus, revision }
    : node);
  manualCase.timeline.push({
    eventId: `event_${repairAttemptId}_status`,
    eventType: 'canonical.repair_attempt.status_updated',
    caseRevision: revision,
    occurredAt,
    summary: 'Canonical repair attempt status updated.'
  });

  return {
    ok: true,
    headRevisionBefore: revision - 1,
    headRevisionAfter: revision,
    projectionScheduled: false,
    updatedIds: [repairAttemptId],
    warnings: [],
    violations: []
  };
}

export function updateManualRepairAttempt(manualCase: ManualCaseState, input: Record<string, unknown>): ToolResult {
  const revision = manualCase.headRevision + 1;
  const repairAttemptId = requireString(input, 'repairAttemptId');
  const occurredAt = nextTimestamp(manualCase, revision);
  const changeSummary = typeof input.changeSummary === 'string' && input.changeSummary.trim().length > 0 ? input.changeSummary.trim() : null;
  const scope = typeof input.scope === 'string' ? input.scope.trim() : undefined;

  manualCase.headRevision = revision;
  manualCase.updatedAt = occurredAt;
  manualCase.nodes = manualCase.nodes.map((node) => node.id === repairAttemptId
    ? {
        ...node,
        label: changeSummary ?? node.label,
        revision,
        summary: changeSummary ?? node.summary,
        payload: {
          ...(node.payload ?? {}),
          ...(changeSummary ? { changeSummary } : {}),
          ...(scope === undefined ? {} : { scope })
        }
      }
    : node);
  manualCase.timeline.push({
    eventId: `event_${repairAttemptId}_updated`,
    eventType: 'canonical.repair_attempt.updated',
    caseRevision: revision,
    occurredAt,
    summary: 'Canonical repair attempt updated.'
  });

  return {
    ok: true,
    headRevisionBefore: revision - 1,
    headRevisionAfter: revision,
    projectionScheduled: false,
    updatedIds: [repairAttemptId],
    warnings: [],
    violations: []
  };
}

export function captureManualEvidence(manualCase: ManualCaseState, input: Record<string, unknown>): ToolResult {
  const revision = manualCase.headRevision + 1;
  const evidenceId = `evidence_${manualCase.caseId}_${String(manualCase.nextEvidenceSequence++).padStart(4, '0')}`;
  const title = requireString(input, 'title');
  const summary = typeof input.summary === 'string' ? input.summary : null;
  const occurredAt = nextTimestamp(manualCase, revision);

  manualCase.headRevision = revision;
  manualCase.updatedAt = occurredAt;
  manualCase.evidencePool.push({ id: evidenceId, title, summary });
  manualCase.timeline.push({
    eventId: `event_${evidenceId}_captured`,
    eventType: 'canonical.evidence.captured',
    caseRevision: revision,
    occurredAt,
    summary: 'Canonical evidence captured.'
  });

  return {
    ok: true,
    headRevisionBefore: revision - 1,
    headRevisionAfter: revision,
    projectionScheduled: false,
    createdIds: [evidenceId],
    warnings: [],
    violations: []
  };
}

export function attachManualEvidence(manualCase: ManualCaseState, input: Record<string, unknown>): ToolResult {
  const revision = manualCase.headRevision + 1;
  const evidenceRefId = `evidence_ref_${manualCase.caseId}_${String(manualCase.nextEvidenceRefSequence++).padStart(4, '0')}`;
  const parentNodeId = requireString(input, 'parentNodeId');
  const evidenceId = requireString(input, 'evidenceId');
  const evidence = manualCase.evidencePool.find((item) => item.id === evidenceId);
  const occurredAt = nextTimestamp(manualCase, revision);

  manualCase.headRevision = revision;
  manualCase.updatedAt = occurredAt;
  manualCase.nodes.push({
    id: evidenceRefId,
    kind: 'evidence_ref',
    label: evidence?.title ?? 'Evidence',
    status: null,
    revision,
    summary: evidence?.summary ?? null,
    payload: {
      evidence: {
        id: evidenceId,
        title: evidence?.title ?? 'Evidence',
        summary: evidence?.summary ?? null,
        provenance: typeof input.provenance === 'string' ? input.provenance : 'manual://graph-canvas'
      },
      effectOnParent: typeof input.effectOnParent === 'string' ? input.effectOnParent : 'supports',
      interpretation: typeof input.interpretation === 'string' ? input.interpretation : (evidence?.summary ?? '')
    }
  });
  manualCase.edges.push({
    key: `structural:${parentNodeId}:${evidenceRefId}`,
    type: 'structural',
    fromId: parentNodeId,
    toId: evidenceRefId
  });
  manualCase.timeline.push({
    eventId: `event_${evidenceRefId}_attached`,
    eventType: 'canonical.evidence.attached',
    caseRevision: revision,
    occurredAt,
    summary: 'Canonical evidence attached.'
  });
  manualCase.counts = recomputeCounts(manualCase.nodes);

  return {
    ok: true,
    headRevisionBefore: revision - 1,
    headRevisionAfter: revision,
    projectionScheduled: false,
    createdIds: [evidenceRefId],
    warnings: [],
    violations: []
  };
}

export function updateManualEvidenceRef(manualCase: ManualCaseState, input: Record<string, unknown>): ToolResult {
  const revision = manualCase.headRevision + 1;
  const evidenceRefId = requireString(input, 'evidenceRefId');
  const occurredAt = nextTimestamp(manualCase, revision);
  const title = typeof input.title === 'string' && input.title.trim().length > 0 ? input.title.trim() : null;
  const summary = typeof input.summary === 'string' ? input.summary.trim() : undefined;
  const provenance = typeof input.provenance === 'string' ? input.provenance.trim() : undefined;
  const effectOnParent = typeof input.effectOnParent === 'string' ? input.effectOnParent : undefined;
  const interpretation = typeof input.interpretation === 'string' ? input.interpretation.trim() : undefined;

  manualCase.headRevision = revision;
  manualCase.updatedAt = occurredAt;
  manualCase.nodes = manualCase.nodes.map((node) => node.id === evidenceRefId
    ? {
        ...node,
        label: title ?? node.label,
        revision,
        summary: interpretation ?? summary ?? node.summary,
        payload: {
          ...(node.payload ?? {}),
          evidence: {
            ...(((node.payload ?? {}) as Record<string, unknown>).evidence as Record<string, unknown> ?? {}),
            ...(title ? { title } : {}),
            ...(summary === undefined ? {} : { summary }),
            ...(provenance === undefined ? {} : { provenance })
          },
          ...(effectOnParent === undefined ? {} : { effectOnParent }),
          ...(interpretation === undefined ? {} : { interpretation })
        }
      }
    : node);
  manualCase.timeline.push({
    eventId: `event_${evidenceRefId}_updated`,
    eventType: 'canonical.evidence_ref.updated',
    caseRevision: revision,
    occurredAt,
    summary: 'Canonical evidence updated.'
  });

  return {
    ok: true,
    headRevisionBefore: revision - 1,
    headRevisionAfter: revision,
    projectionScheduled: false,
    updatedIds: [evidenceRefId],
    warnings: [],
    violations: []
  };
}

export function updateManualProblem(manualCase: ManualCaseState, input: Record<string, unknown>): ToolResult {
  const revision = manualCase.headRevision + 1;
  const problemId = requireString(input, 'problemId');
  const occurredAt = nextTimestamp(manualCase, revision);
  const title = typeof input.title === 'string' && input.title.trim().length > 0 ? input.title.trim() : null;
  const description = typeof input.description === 'string' ? input.description.trim() : undefined;
  const environment = typeof input.environment === 'string' ? input.environment.trim() : undefined;
  const symptoms = Array.isArray(input.symptoms)
    ? input.symptoms.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : undefined;
  const resolutionCriteria = Array.isArray(input.resolutionCriteria)
    ? input.resolutionCriteria.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : undefined;

  manualCase.headRevision = revision;
  manualCase.updatedAt = occurredAt;
  manualCase.nodes = manualCase.nodes.map((node) => node.id === problemId
    ? {
        ...node,
        label: title ?? node.label,
        revision,
        summary: description === undefined ? node.summary : description,
        payload: {
          ...(node.payload ?? {}),
          ...(title ? { title } : {}),
          ...(description === undefined ? {} : { description }),
          ...(environment === undefined ? {} : { environment }),
          ...(symptoms === undefined ? {} : { symptoms }),
          ...(resolutionCriteria === undefined ? {} : { resolutionCriteria })
        }
      }
    : node);
  if (title) {
    manualCase.title = title;
  }
  manualCase.timeline.push({
    eventId: `event_${problemId}_updated`,
    eventType: 'canonical.problem.updated',
    caseRevision: revision,
    occurredAt,
    summary: 'Canonical problem updated.'
  });

  return {
    ok: true,
    headRevisionBefore: revision - 1,
    headRevisionAfter: revision,
    projectionScheduled: false,
    updatedIds: [problemId],
    warnings: [],
    violations: []
  };
}

export function updateManualProblemStatus(manualCase: ManualCaseState, input: Record<string, unknown>): ToolResult {
  const revision = manualCase.headRevision + 1;
  const problemId = requireString(input, 'problemId');
  const newStatus = requireString(input, 'newStatus');
  const occurredAt = nextTimestamp(manualCase, revision);

  manualCase.headRevision = revision;
  manualCase.updatedAt = occurredAt;
  manualCase.nodes = manualCase.nodes.map((node) => node.id === problemId
    ? { ...node, status: newStatus, revision }
    : node);
  manualCase.timeline.push({
    eventId: `event_${problemId}_status`,
    eventType: 'canonical.problem.status_updated',
    caseRevision: revision,
    occurredAt,
    summary: 'Canonical problem status updated.'
  });

  return {
    ok: true,
    headRevisionBefore: revision - 1,
    headRevisionAfter: revision,
    projectionScheduled: false,
    updatedIds: [problemId],
    warnings: [],
    violations: []
  };
}

export function manualGuardrails() {
  const readyPass = false;

  return {
    aggregate: {
      kind: 'investigation.guardrail.check_result',
      warnings: [] as Array<{ code: string; message: string; nodeIds: string[] }>,
      violations: [] as Array<{ code: string; message: string; nodeIds: string[] }>
    },
    stall: {
      kind: 'investigation.guardrail.stall_check_result',
      stall: false,
      reason: null as string | null,
      inquiryIds: [] as string[]
    },
    readyToPatch: {
      kind: 'investigation.guardrail.ready_to_patch_result',
      pass: readyPass,
      candidateHypothesisIds: [] as string[],
      candidatePatchRefs: [] as string[],
      blockingGapIds: [] as string[],
      blockingResidualIds: [] as string[],
      uncoveredCriticalSymptomIds: [] as string[],
      incompleteExperimentIds: [] as string[],
      reasons: ['No confirmed hypothesis is ready for repair.']
    },
    closeCase: {
      kind: 'investigation.guardrail.close_case_check_result',
      pass: false,
      blockingInquiryIds: [] as string[],
      blockingResidualIds: [] as string[],
      missingValidationRefs: [] as string[],
      reasons: ['Repair validation evidence is still missing.']
    }
  };
}

function recomputeCounts(nodes: ManualCaseState['nodes']): ManualCaseState['counts'] {
  return nodes.reduce<ManualCaseState['counts']>((counts, node) => {
    if (node.kind === 'problem') {
      counts.problems += 1;
    }
    if (node.kind === 'hypothesis') {
      counts.hypotheses += 1;
    }
    if (node.kind === 'blocker') {
      counts.blockers += 1;
    }
    if (node.kind === 'repair_attempt') {
      counts.repairAttempts += 1;
    }
    if (node.kind === 'evidence_ref') {
      counts.evidenceRefs += 1;
    }

    return counts;
  }, {
    problems: 0,
    hypotheses: 0,
    blockers: 0,
    repairAttempts: 0,
    evidenceRefs: 0
  });
}
