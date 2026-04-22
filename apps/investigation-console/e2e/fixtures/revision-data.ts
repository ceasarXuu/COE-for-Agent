import type { RevisionState } from './types.js';

import { clone, FIXTURE_IDS } from './helpers.js';

export function buildRevisionStates(): RevisionState[] {
  const baseCase = {
    id: FIXTURE_IDS.caseId,
    title: 'Graph regression in worker fanout',
    severity: 'high',
    status: 'active',
    objective: 'Isolate the fanout regression, validate the winning branch, and promote a repair safely.',
    summary: 'Worker pool saturation spikes after the fanout refactor.'
  };
  const problemPayload = {
    title: baseCase.title,
    description: 'Retry bursts saturate the worker pool after the fanout refactor lands.',
    environment: 'worker-fanout service / retry replay harness',
    symptoms: [
      'queue depth climbs until workers stop making forward progress',
      'legacy branch remains stable under the same burst load'
    ],
    resolutionCriteria: [
      'confirm the winning hypothesis with replay evidence',
      'ship a repair without reintroducing queue saturation'
    ]
  };
  const hypothesisPayload = {
    title: 'worker pool starvation hypothesis',
    statement: 'The fanout refactor starves the worker pool when retry batches stack on a shared queue.',
    falsificationCriteria: ['queue depth remains flat under replay load']
  };
  const evidencePayload = {
    id: FIXTURE_IDS.evidenceId,
    title: 'Load replay queue depth trace',
    summary: 'queue depth spikes only on the new fanout branch',
    provenance: 'fixture://replay/load-burst'
  };

  const revisions: RevisionState[] = [
    {
      revision: 1,
      caseRecord: {
        ...baseCase,
        revision: 1
      },
      counts: {
        problems: 1,
        hypotheses: 0,
        blockers: 0,
        repairAttempts: 0,
        evidenceRefs: 0
      },
      nodes: [
        buildCaseNode(baseCase.title, 1),
        buildProblemNode(problemPayload, 1)
      ],
      edges: [
        {
          key: `${FIXTURE_IDS.caseId}->${FIXTURE_IDS.problemId}:structural`,
          type: 'structural',
          fromId: FIXTURE_IDS.caseId,
          toId: FIXTURE_IDS.problemId
        }
      ],
      timeline: [
        {
          eventId: 'event_r1_case_open',
          eventType: 'case.opened',
          caseRevision: 1,
          occurredAt: '2025-01-01T10:00:00.000Z',
          summary: 'Canonical case opened with a problem root.'
        }
      ],
      guardrails: buildGuardrails({
        readyReasons: ['No hypothesis has been recorded yet.'],
        missingValidationRefs: [FIXTURE_IDS.problemId],
        closeReasons: ['Repair validation evidence is still missing.']
      })
    },
    {
      revision: 2,
      caseRecord: {
        ...baseCase,
        revision: 2
      },
      counts: {
        problems: 1,
        hypotheses: 0,
        blockers: 0,
        repairAttempts: 0,
        evidenceRefs: 0
      },
      nodes: [
        buildCaseNode(baseCase.title, 2),
        buildProblemNode(problemPayload, 2)
      ],
      edges: [
        {
          key: `${FIXTURE_IDS.caseId}->${FIXTURE_IDS.problemId}:structural`,
          type: 'structural',
          fromId: FIXTURE_IDS.caseId,
          toId: FIXTURE_IDS.problemId
        }
      ],
      timeline: [
        {
          eventId: 'event_r1_case_open',
          eventType: 'case.opened',
          caseRevision: 1,
          occurredAt: '2025-01-01T10:00:00.000Z',
          summary: 'Canonical case opened with a problem root.'
        },
        {
          eventId: 'event_r2_problem_scoped',
          eventType: 'canonical.problem.updated',
          caseRevision: 2,
          occurredAt: '2025-01-01T10:03:00.000Z',
          summary: 'Problem context and operating environment were scoped.'
        }
      ],
      guardrails: buildGuardrails({
        readyReasons: ['No hypothesis has been recorded yet.'],
        missingValidationRefs: [FIXTURE_IDS.problemId],
        closeReasons: ['Repair validation evidence is still missing.']
      })
    },
    {
      revision: 3,
      caseRecord: {
        ...baseCase,
        revision: 3
      },
      counts: {
        problems: 1,
        hypotheses: 1,
        blockers: 0,
        repairAttempts: 0,
        evidenceRefs: 0
      },
      nodes: [
        buildCaseNode(baseCase.title, 3),
        buildProblemNode(problemPayload, 3),
        buildHypothesisNode(hypothesisPayload, 'unverified', 3)
      ],
      edges: [
        {
          key: `${FIXTURE_IDS.caseId}->${FIXTURE_IDS.problemId}:structural`,
          type: 'structural',
          fromId: FIXTURE_IDS.caseId,
          toId: FIXTURE_IDS.problemId
        },
        {
          key: `${FIXTURE_IDS.problemId}->${FIXTURE_IDS.hypothesisId}:structural`,
          type: 'structural',
          fromId: FIXTURE_IDS.problemId,
          toId: FIXTURE_IDS.hypothesisId
        }
      ],
      timeline: [
        {
          eventId: 'event_r1_case_open',
          eventType: 'case.opened',
          caseRevision: 1,
          occurredAt: '2025-01-01T10:00:00.000Z',
          summary: 'Canonical case opened with a problem root.'
        },
        {
          eventId: 'event_r2_problem_scoped',
          eventType: 'canonical.problem.updated',
          caseRevision: 2,
          occurredAt: '2025-01-01T10:03:00.000Z',
          summary: 'Problem context and operating environment were scoped.'
        },
        {
          eventId: 'event_r3_hypothesis_created',
          eventType: 'canonical.hypothesis.created',
          caseRevision: 3,
          occurredAt: '2025-01-01T10:06:00.000Z',
          summary: 'Primary canonical hypothesis was recorded.'
        }
      ],
      guardrails: buildGuardrails({
        candidateHypothesisIds: [FIXTURE_IDS.hypothesisId],
        readyReasons: ['The leading hypothesis is still unverified.'],
        missingValidationRefs: [FIXTURE_IDS.problemId],
        closeReasons: ['Repair validation evidence is still missing.']
      })
    },
    {
      revision: 4,
      caseRecord: {
        ...baseCase,
        revision: 4
      },
      counts: {
        problems: 1,
        hypotheses: 1,
        blockers: 0,
        repairAttempts: 0,
        evidenceRefs: 1
      },
      nodes: [
        buildCaseNode(baseCase.title, 4),
        buildProblemNode(problemPayload, 4),
        buildHypothesisNode(hypothesisPayload, 'unverified', 4),
        buildEvidenceRefNode(evidencePayload, 4)
      ],
      edges: [
        {
          key: `${FIXTURE_IDS.caseId}->${FIXTURE_IDS.problemId}:structural`,
          type: 'structural',
          fromId: FIXTURE_IDS.caseId,
          toId: FIXTURE_IDS.problemId
        },
        {
          key: `${FIXTURE_IDS.problemId}->${FIXTURE_IDS.hypothesisId}:structural`,
          type: 'structural',
          fromId: FIXTURE_IDS.problemId,
          toId: FIXTURE_IDS.hypothesisId
        },
        {
          key: `${FIXTURE_IDS.hypothesisId}->${FIXTURE_IDS.evidenceRefId}:supports`,
          type: 'supports',
          fromId: FIXTURE_IDS.hypothesisId,
          toId: FIXTURE_IDS.evidenceRefId
        }
      ],
      timeline: [
        {
          eventId: 'event_r1_case_open',
          eventType: 'case.opened',
          caseRevision: 1,
          occurredAt: '2025-01-01T10:00:00.000Z',
          summary: 'Canonical case opened with a problem root.'
        },
        {
          eventId: 'event_r2_problem_scoped',
          eventType: 'canonical.problem.updated',
          caseRevision: 2,
          occurredAt: '2025-01-01T10:03:00.000Z',
          summary: 'Problem context and operating environment were scoped.'
        },
        {
          eventId: 'event_r3_hypothesis_created',
          eventType: 'canonical.hypothesis.created',
          caseRevision: 3,
          occurredAt: '2025-01-01T10:06:00.000Z',
          summary: 'Primary canonical hypothesis was recorded.'
        },
        {
          eventId: 'event_r4_evidence_attached',
          eventType: 'canonical.evidence.attached',
          caseRevision: 4,
          occurredAt: '2025-01-01T10:09:00.000Z',
          summary: 'Replay evidence was attached to the hypothesis.'
        }
      ],
      guardrails: buildGuardrails({
        candidateHypothesisIds: [FIXTURE_IDS.hypothesisId],
        readyReasons: ['The leading hypothesis is still unverified.'],
        missingValidationRefs: [FIXTURE_IDS.evidenceRefId],
        closeReasons: ['Repair validation evidence is still missing.']
      })
    },
    {
      revision: 5,
      caseRecord: {
        ...baseCase,
        revision: 5
      },
      counts: {
        problems: 1,
        hypotheses: 1,
        blockers: 1,
        repairAttempts: 0,
        evidenceRefs: 1
      },
      nodes: [
        buildCaseNode(baseCase.title, 5),
        buildProblemNode(problemPayload, 5),
        buildHypothesisNode(hypothesisPayload, 'unverified', 5),
        buildEvidenceRefNode(evidencePayload, 5),
        buildBlockerNode(5)
      ],
      edges: [
        {
          key: `${FIXTURE_IDS.caseId}->${FIXTURE_IDS.problemId}:structural`,
          type: 'structural',
          fromId: FIXTURE_IDS.caseId,
          toId: FIXTURE_IDS.problemId
        },
        {
          key: `${FIXTURE_IDS.problemId}->${FIXTURE_IDS.hypothesisId}:structural`,
          type: 'structural',
          fromId: FIXTURE_IDS.problemId,
          toId: FIXTURE_IDS.hypothesisId
        },
        {
          key: `${FIXTURE_IDS.hypothesisId}->${FIXTURE_IDS.evidenceRefId}:supports`,
          type: 'supports',
          fromId: FIXTURE_IDS.hypothesisId,
          toId: FIXTURE_IDS.evidenceRefId
        },
        {
          key: `${FIXTURE_IDS.hypothesisId}->${FIXTURE_IDS.blockerId}:blocks`,
          type: 'blocks',
          fromId: FIXTURE_IDS.hypothesisId,
          toId: FIXTURE_IDS.blockerId
        }
      ],
      timeline: [
        {
          eventId: 'event_r1_case_open',
          eventType: 'case.opened',
          caseRevision: 1,
          occurredAt: '2025-01-01T10:00:00.000Z',
          summary: 'Canonical case opened with a problem root.'
        },
        {
          eventId: 'event_r2_problem_scoped',
          eventType: 'canonical.problem.updated',
          caseRevision: 2,
          occurredAt: '2025-01-01T10:03:00.000Z',
          summary: 'Problem context and operating environment were scoped.'
        },
        {
          eventId: 'event_r3_hypothesis_created',
          eventType: 'canonical.hypothesis.created',
          caseRevision: 3,
          occurredAt: '2025-01-01T10:06:00.000Z',
          summary: 'Primary canonical hypothesis was recorded.'
        },
        {
          eventId: 'event_r4_evidence_attached',
          eventType: 'canonical.evidence.attached',
          caseRevision: 4,
          occurredAt: '2025-01-01T10:09:00.000Z',
          summary: 'Replay evidence was attached to the hypothesis.'
        },
        {
          eventId: 'event_r5_blocker_opened',
          eventType: 'canonical.blocker.opened',
          caseRevision: 5,
          occurredAt: '2025-01-01T10:12:00.000Z',
          summary: 'A blocker captured the remaining production-safe validation gap.'
        }
      ],
      guardrails: buildGuardrails({
        candidateHypothesisIds: [FIXTURE_IDS.hypothesisId],
        blockingIds: [FIXTURE_IDS.blockerId],
        missingValidationRefs: [FIXTURE_IDS.evidenceRefId],
        readyReasons: ['Active blockers still prevent repair work.'],
        closeReasons: ['Repair validation evidence is still missing.']
      })
    }
  ];

  return revisions;
}

export function buildConfirmedRevision(previous: RevisionState): RevisionState {
  const nextRevision = previous.revision + 1;

  return {
    ...clone(previous),
    revision: nextRevision,
    caseRecord: {
      ...clone(previous.caseRecord),
      revision: nextRevision
    },
    nodes: previous.nodes.map((node) => ({
      ...clone(node),
      revision: nextRevision,
      ...(node.id === FIXTURE_IDS.hypothesisId ? { status: 'confirmed' } : {})
    })),
    timeline: [
      ...clone(previous.timeline),
      {
        eventId: `event_r${nextRevision}_hypothesis_confirmed`,
        eventType: 'canonical.hypothesis.status_updated',
        caseRevision: nextRevision,
        occurredAt: '2025-01-01T10:16:00.000Z',
        summary: 'Reviewer confirmed the canonical hypothesis.'
      }
    ],
    guardrails: buildGuardrails({
      candidateHypothesisIds: [FIXTURE_IDS.hypothesisId],
      blockingIds: previous.nodes.some((node) => node.id === FIXTURE_IDS.blockerId) ? [FIXTURE_IDS.blockerId] : [],
      missingValidationRefs: [FIXTURE_IDS.evidenceRefId],
      readyReasons: previous.nodes.some((node) => node.id === FIXTURE_IDS.blockerId)
        ? ['Active blockers still prevent repair work.']
        : [],
      closeReasons: ['Repair validation evidence is still missing.']
    })
  };
}

function buildCaseNode(title: string, revision: number): RevisionState['nodes'][number] {
  return {
    id: FIXTURE_IDS.caseId,
    kind: 'case',
    label: title,
    status: 'active',
    revision
  };
}

function buildProblemNode(problemPayload: Record<string, unknown>, revision: number): RevisionState['nodes'][number] {
  return {
    id: FIXTURE_IDS.problemId,
    kind: 'problem',
    label: 'worker pool saturation after fanout refactor',
    status: 'open',
    revision,
    summary: 'Retry bursts saturate workers after the fanout refactor lands.',
    payload: clone(problemPayload)
  };
}

function buildHypothesisNode(
  hypothesisPayload: Record<string, unknown>,
  status: 'unverified' | 'confirmed',
  revision: number
): RevisionState['nodes'][number] {
  return {
    id: FIXTURE_IDS.hypothesisId,
    kind: 'hypothesis',
    label: 'worker pool starvation hypothesis',
    status,
    revision,
    summary: 'Shared retry batches may starve workers on a single queue.',
    payload: clone(hypothesisPayload)
  };
}

function buildEvidenceRefNode(evidencePayload: Record<string, unknown>, revision: number): RevisionState['nodes'][number] {
  return {
    id: FIXTURE_IDS.evidenceRefId,
    kind: 'evidence_ref',
    label: 'Load replay queue depth trace',
    status: null,
    revision,
    summary: 'queue depth spikes only on the new fanout branch',
    payload: {
      evidence: clone(evidencePayload),
      effectOnParent: 'supports',
      interpretation: 'Supports the starvation branch under replay load.'
    }
  };
}

function buildBlockerNode(revision: number): RevisionState['nodes'][number] {
  return {
    id: FIXTURE_IDS.blockerId,
    kind: 'blocker',
    label: 'Need production-safe confirmation before rollout',
    status: 'active',
    revision,
    summary: 'The winning branch still lacks production-safe confirmation.',
    payload: {
      description: 'Need production-safe confirmation before rollout',
      possibleWorkarounds: [
        'Throttle replay to one worker pool',
        'Capture targeted production-safe traces'
      ]
    }
  };
}

function buildGuardrails(options: {
  candidateHypothesisIds?: string[];
  blockingIds?: string[];
  missingValidationRefs?: string[];
  readyReasons?: string[];
  closeReasons?: string[];
}): RevisionState['guardrails'] {
  const candidateHypothesisIds = options.candidateHypothesisIds ?? [];
  const blockingIds = options.blockingIds ?? [];
  const missingValidationRefs = options.missingValidationRefs ?? [];
  const readyReasons = options.readyReasons ?? [];
  const closeReasons = options.closeReasons ?? [];
  const readyPass = candidateHypothesisIds.length > 0 && blockingIds.length === 0 && readyReasons.length === 0;
  const closePass = blockingIds.length === 0 && missingValidationRefs.length === 0 && closeReasons.length === 0;

  return {
    aggregate: {
      kind: 'investigation.guardrail.check_result',
      warnings: blockingIds.length > 0
        ? [{ code: 'active_blockers', message: 'Active blockers remain on the case.', nodeIds: blockingIds }]
        : [],
      violations: []
    },
    stall: {
      kind: 'investigation.guardrail.stall_check_result',
      stall: false,
      reason: null,
      inquiryIds: []
    },
    readyToPatch: {
      kind: 'investigation.guardrail.ready_to_patch_result',
      pass: readyPass,
      candidateHypothesisIds,
      candidatePatchRefs: [],
      blockingGapIds: blockingIds,
      blockingResidualIds: [],
      uncoveredCriticalSymptomIds: [],
      incompleteExperimentIds: [],
      reasons: readyPass ? [] : readyReasons
    },
    closeCase: {
      kind: 'investigation.guardrail.close_case_check_result',
      pass: closePass,
      blockingInquiryIds: blockingIds,
      blockingResidualIds: [],
      missingValidationRefs,
      reasons: closePass ? [] : closeReasons
    }
  };
}
