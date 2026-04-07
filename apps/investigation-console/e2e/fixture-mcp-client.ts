import { createResourceEnvelope } from '@coe/domain';

import type { ConsoleMcpClient, ResourceReadResult } from '../server/mcp-types.js';
import { consoleTelemetry } from '../server/telemetry.js';

export const FIXTURE_IDS = {
  caseId: 'case_01FIXTUREINVESTIGATION0001',
  inquiryId: 'inquiry_01FIXTUREINVESTIGATION01',
  symptomId: 'symptom_01FIXTUREINVESTIGATION1',
  secondarySymptomId: 'symptom_01FIXTUREINVESTIGATION2',
  hypothesisId: 'hypothesis_01FIXTUREINVESTIGATE',
  factId: 'fact_01FIXTUREINVESTIGATION0001',
  experimentId: 'experiment_01FIXTUREINVESTIGATE',
  gapId: 'gap_01FIXTUREINVESTIGATION0002',
  decisionId: 'decision_01FIXTUREINVESTIGATIO',
  residualId: 'residual_01FIXTUREINVESTIGAT'
} as const;

interface TimelineEvent {
  eventId: string;
  eventType: string;
  caseRevision: number;
  occurredAt: string;
  summary: string;
}

interface RevisionState {
  revision: number;
  caseRecord: {
    id: string;
    title: string;
    severity: string;
    status: string;
    stage: string;
    revision: number;
    objective: string;
    summary: string;
  };
  counts: {
    inquiries: number;
    symptoms: number;
    artifacts: number;
    facts: number;
  };
  nodes: Array<{
    id: string;
    kind: string;
    label: string;
    status: string | null;
    revision: number;
  }>;
  edges: Array<{
    key: string;
    type: string;
    fromId: string;
    toId: string;
  }>;
  coverage: {
    items: Array<{
      symptomId: string;
      statement: string;
      coverage: 'direct' | 'indirect' | 'none';
      supportingFactIds: string[];
      relatedHypothesisIds: string[];
    }>;
    summary: {
      direct: number;
      indirect: number;
      none: number;
    };
  };
  timeline: TimelineEvent[];
  inquiryPanel: {
    inquiry: {
      id: string;
      caseId: string;
      title: string;
      question: string;
      status: string;
    };
    hypotheses: Array<Record<string, unknown>>;
    experiments: Array<Record<string, unknown>>;
    gaps: Array<Record<string, unknown>>;
  };
  hypothesisPanel: {
    hypothesis: {
      id: string;
      caseId: string;
      title: string;
      statement: string;
      status: string;
      explainsSymptomIds: string[];
      dependsOnFactIds: string[];
      falsificationCriteria: string[];
    };
    supportingFacts: Array<Record<string, unknown>>;
    contradictingFacts: Array<Record<string, unknown>>;
    linkedExperiments: Array<Record<string, unknown>>;
    openGaps: Array<Record<string, unknown>>;
    openResiduals: Array<Record<string, unknown>>;
  };
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

function clone<T>(value: T): T {
  return structuredClone(value);
}

function buildRevisionStates(): RevisionState[] {
  const baseCase = {
    id: FIXTURE_IDS.caseId,
    title: 'Graph regression in worker fanout',
    severity: 'high',
    status: 'active',
    objective: 'Isolate the fanout regression, validate the winning branch, and promote a repair safely.',
    summary: 'Worker pool saturation spikes after the fanout refactor.'
  };

  const inquiry = {
    id: FIXTURE_IDS.inquiryId,
    caseId: FIXTURE_IDS.caseId,
    title: 'Primary branch inquiry',
    question: 'Which branch explains the fanout saturation?',
    status: 'open'
  };

  const hypothesisProposed = {
    id: FIXTURE_IDS.hypothesisId,
    caseId: FIXTURE_IDS.caseId,
    title: 'worker pool starvation hypothesis',
    statement: 'The fanout refactor starves the worker pool when retry batches stack on a shared queue.',
    status: 'proposed',
    explainsSymptomIds: [FIXTURE_IDS.symptomId],
    dependsOnFactIds: [],
    falsificationCriteria: ['queue depth remains flat under replay load']
  };

  const hypothesisFavored = {
    ...hypothesisProposed,
    status: 'favored',
    dependsOnFactIds: [FIXTURE_IDS.factId]
  };

  const fact = {
    id: FIXTURE_IDS.factId,
    caseId: FIXTURE_IDS.caseId,
    statement: 'queue depth spikes only on the new fanout branch',
    polarity: 'positive',
    aboutRefs: [FIXTURE_IDS.symptomId],
    status: 'recorded'
  };

  const experiment = {
    id: FIXTURE_IDS.experimentId,
    caseId: FIXTURE_IDS.caseId,
    title: 'branch replay under synthetic load',
    objective: 'replay retry bursts against the new fanout branch',
    method: 'patch_probe',
    testsHypothesisIds: [FIXTURE_IDS.hypothesisId],
    status: 'completed'
  };

  const revisions: RevisionState[] = [
    {
      revision: 1,
      caseRecord: {
        ...baseCase,
        stage: 'evidence_collection',
        revision: 1
      },
      counts: {
        inquiries: 1,
        symptoms: 0,
        artifacts: 0,
        facts: 0
      },
      nodes: [
        { id: FIXTURE_IDS.caseId, kind: 'case', label: baseCase.title, status: 'active', revision: 1 },
        { id: FIXTURE_IDS.inquiryId, kind: 'inquiry', label: inquiry.title, status: 'open', revision: 1 }
      ],
      edges: [],
      coverage: {
        items: [],
        summary: { direct: 0, indirect: 0, none: 0 }
      },
      timeline: [
        {
          eventId: 'event_r1_case_open',
          eventType: 'case.opened',
          caseRevision: 1,
          occurredAt: '2025-01-01T10:00:00.000Z',
          summary: 'Case opened with a default inquiry.'
        }
      ],
      inquiryPanel: {
        inquiry,
        hypotheses: [],
        experiments: [],
        gaps: []
      },
      hypothesisPanel: {
        hypothesis: hypothesisProposed,
        supportingFacts: [],
        contradictingFacts: [],
        linkedExperiments: [],
        openGaps: [
          {
            id: 'gap_01FIXTUREINVESTIGATION0001',
            caseId: FIXTURE_IDS.caseId,
            status: 'open',
            title: 'Need direct queue depth evidence'
          }
        ],
        openResiduals: []
      },
      guardrails: {
        aggregate: {
          kind: 'investigation.guardrail.check_result',
          warnings: [],
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
          pass: false,
          candidateHypothesisIds: [],
          candidatePatchRefs: [],
          blockingGapIds: ['gap_01FIXTUREINVESTIGATION0001'],
          blockingResidualIds: [],
          uncoveredCriticalSymptomIds: [],
          incompleteExperimentIds: [],
          reasons: ['No favored or confirmed hypothesis is available yet.']
        },
        closeCase: {
          kind: 'investigation.guardrail.close_case_check_result',
          pass: false,
          blockingInquiryIds: [FIXTURE_IDS.inquiryId],
          blockingResidualIds: [],
          missingValidationRefs: [FIXTURE_IDS.symptomId],
          reasons: ['Case must reach repair_validation before it can be closed.']
        }
      }
    },
    {
      revision: 2,
      caseRecord: {
        ...baseCase,
        stage: 'evidence_collection',
        revision: 2
      },
      counts: {
        inquiries: 1,
        symptoms: 2,
        artifacts: 0,
        facts: 0
      },
      nodes: [
        { id: FIXTURE_IDS.caseId, kind: 'case', label: baseCase.title, status: 'active', revision: 2 },
        { id: FIXTURE_IDS.inquiryId, kind: 'inquiry', label: inquiry.title, status: 'open', revision: 2 },
        { id: FIXTURE_IDS.symptomId, kind: 'symptom', label: 'workers stall under burst fanout', status: 'open', revision: 2 },
        { id: FIXTURE_IDS.secondarySymptomId, kind: 'symptom', label: 'latency remains stable on the legacy path', status: 'open', revision: 2 }
      ],
      edges: [],
      coverage: {
        items: [
          {
            symptomId: FIXTURE_IDS.symptomId,
            statement: 'workers stall under burst fanout',
            coverage: 'none',
            supportingFactIds: [],
            relatedHypothesisIds: []
          },
          {
            symptomId: FIXTURE_IDS.secondarySymptomId,
            statement: 'latency remains stable on the legacy path',
            coverage: 'none',
            supportingFactIds: [],
            relatedHypothesisIds: []
          }
        ],
        summary: { direct: 0, indirect: 0, none: 2 }
      },
      timeline: [
        {
          eventId: 'event_r1_case_open',
          eventType: 'case.opened',
          caseRevision: 1,
          occurredAt: '2025-01-01T10:00:00.000Z',
          summary: 'Case opened with a default inquiry.'
        },
        {
          eventId: 'event_r2_symptom_1',
          eventType: 'symptom.reported',
          caseRevision: 2,
          occurredAt: '2025-01-01T10:03:00.000Z',
          summary: 'Primary symptom recorded.'
        },
        {
          eventId: 'event_r2_symptom_2',
          eventType: 'symptom.reported',
          caseRevision: 2,
          occurredAt: '2025-01-01T10:04:00.000Z',
          summary: 'Secondary symptom recorded.'
        }
      ],
      inquiryPanel: {
        inquiry,
        hypotheses: [],
        experiments: [],
        gaps: []
      },
      hypothesisPanel: {
        hypothesis: hypothesisProposed,
        supportingFacts: [],
        contradictingFacts: [],
        linkedExperiments: [],
        openGaps: [
          {
            id: 'gap_01FIXTUREINVESTIGATION0001',
            caseId: FIXTURE_IDS.caseId,
            status: 'open',
            title: 'Need direct queue depth evidence'
          }
        ],
        openResiduals: []
      },
      guardrails: {
        aggregate: {
          kind: 'investigation.guardrail.check_result',
          warnings: [],
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
          pass: false,
          candidateHypothesisIds: [],
          candidatePatchRefs: [],
          blockingGapIds: ['gap_01FIXTUREINVESTIGATION0001'],
          blockingResidualIds: [],
          uncoveredCriticalSymptomIds: [FIXTURE_IDS.symptomId],
          incompleteExperimentIds: [],
          reasons: ['No favored or confirmed hypothesis is available yet.']
        },
        closeCase: {
          kind: 'investigation.guardrail.close_case_check_result',
          pass: false,
          blockingInquiryIds: [FIXTURE_IDS.inquiryId],
          blockingResidualIds: [],
          missingValidationRefs: [FIXTURE_IDS.symptomId],
          reasons: ['Case must reach repair_validation before it can be closed.']
        }
      }
    },
    {
      revision: 3,
      caseRecord: {
        ...baseCase,
        stage: 'evidence_collection',
        revision: 3
      },
      counts: {
        inquiries: 1,
        symptoms: 2,
        artifacts: 0,
        facts: 0
      },
      nodes: [
        { id: FIXTURE_IDS.caseId, kind: 'case', label: baseCase.title, status: 'active', revision: 3 },
        { id: FIXTURE_IDS.inquiryId, kind: 'inquiry', label: inquiry.title, status: 'open', revision: 3 },
        { id: FIXTURE_IDS.symptomId, kind: 'symptom', label: 'workers stall under burst fanout', status: 'open', revision: 3 },
        { id: FIXTURE_IDS.secondarySymptomId, kind: 'symptom', label: 'latency remains stable on the legacy path', status: 'open', revision: 3 },
        { id: FIXTURE_IDS.hypothesisId, kind: 'hypothesis', label: hypothesisProposed.title, status: 'proposed', revision: 3 }
      ],
      edges: [
        {
          key: `${FIXTURE_IDS.hypothesisId}->${FIXTURE_IDS.symptomId}:explains`,
          type: 'explains',
          fromId: FIXTURE_IDS.hypothesisId,
          toId: FIXTURE_IDS.symptomId
        }
      ],
      coverage: {
        items: [
          {
            symptomId: FIXTURE_IDS.symptomId,
            statement: 'workers stall under burst fanout',
            coverage: 'indirect',
            supportingFactIds: [],
            relatedHypothesisIds: [FIXTURE_IDS.hypothesisId]
          },
          {
            symptomId: FIXTURE_IDS.secondarySymptomId,
            statement: 'latency remains stable on the legacy path',
            coverage: 'none',
            supportingFactIds: [],
            relatedHypothesisIds: []
          }
        ],
        summary: { direct: 0, indirect: 1, none: 1 }
      },
      timeline: [
        {
          eventId: 'event_r1_case_open',
          eventType: 'case.opened',
          caseRevision: 1,
          occurredAt: '2025-01-01T10:00:00.000Z',
          summary: 'Case opened with a default inquiry.'
        },
        {
          eventId: 'event_r2_symptom_1',
          eventType: 'symptom.reported',
          caseRevision: 2,
          occurredAt: '2025-01-01T10:03:00.000Z',
          summary: 'Primary symptom recorded.'
        },
        {
          eventId: 'event_r2_symptom_2',
          eventType: 'symptom.reported',
          caseRevision: 2,
          occurredAt: '2025-01-01T10:04:00.000Z',
          summary: 'Secondary symptom recorded.'
        },
        {
          eventId: 'event_r3_hypothesis',
          eventType: 'hypothesis.proposed',
          caseRevision: 3,
          occurredAt: '2025-01-01T10:06:00.000Z',
          summary: 'Primary hypothesis proposed.'
        }
      ],
      inquiryPanel: {
        inquiry,
        hypotheses: [clone(hypothesisProposed)],
        experiments: [],
        gaps: []
      },
      hypothesisPanel: {
        hypothesis: clone(hypothesisProposed),
        supportingFacts: [],
        contradictingFacts: [],
        linkedExperiments: [],
        openGaps: [
          {
            id: 'gap_01FIXTUREINVESTIGATION0001',
            caseId: FIXTURE_IDS.caseId,
            status: 'open',
            title: 'Need direct queue depth evidence'
          }
        ],
        openResiduals: []
      },
      guardrails: {
        aggregate: {
          kind: 'investigation.guardrail.check_result',
          warnings: [],
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
          pass: false,
          candidateHypothesisIds: [],
          candidatePatchRefs: [],
          blockingGapIds: ['gap_01FIXTUREINVESTIGATION0001'],
          blockingResidualIds: [],
          uncoveredCriticalSymptomIds: [FIXTURE_IDS.symptomId],
          incompleteExperimentIds: [],
          reasons: ['No favored or confirmed hypothesis is available yet.']
        },
        closeCase: {
          kind: 'investigation.guardrail.close_case_check_result',
          pass: false,
          blockingInquiryIds: [FIXTURE_IDS.inquiryId],
          blockingResidualIds: [],
          missingValidationRefs: [FIXTURE_IDS.symptomId],
          reasons: ['Case must reach repair_validation before it can be closed.']
        }
      }
    },
    {
      revision: 4,
      caseRecord: {
        ...baseCase,
        stage: 'discriminative_testing',
        revision: 4
      },
      counts: {
        inquiries: 1,
        symptoms: 2,
        artifacts: 1,
        facts: 1
      },
      nodes: [
        { id: FIXTURE_IDS.caseId, kind: 'case', label: baseCase.title, status: 'active', revision: 4 },
        { id: FIXTURE_IDS.inquiryId, kind: 'inquiry', label: inquiry.title, status: 'open', revision: 4 },
        { id: FIXTURE_IDS.symptomId, kind: 'symptom', label: 'workers stall under burst fanout', status: 'open', revision: 4 },
        { id: FIXTURE_IDS.secondarySymptomId, kind: 'symptom', label: 'latency remains stable on the legacy path', status: 'open', revision: 4 },
        { id: FIXTURE_IDS.hypothesisId, kind: 'hypothesis', label: hypothesisProposed.title, status: 'proposed', revision: 4 },
        { id: FIXTURE_IDS.factId, kind: 'fact', label: fact.statement, status: 'recorded', revision: 4 }
      ],
      edges: [
        {
          key: `${FIXTURE_IDS.hypothesisId}->${FIXTURE_IDS.symptomId}:explains`,
          type: 'explains',
          fromId: FIXTURE_IDS.hypothesisId,
          toId: FIXTURE_IDS.symptomId
        },
        {
          key: `${FIXTURE_IDS.factId}->${FIXTURE_IDS.symptomId}:evidences`,
          type: 'evidences',
          fromId: FIXTURE_IDS.factId,
          toId: FIXTURE_IDS.symptomId
        }
      ],
      coverage: {
        items: [
          {
            symptomId: FIXTURE_IDS.symptomId,
            statement: 'workers stall under burst fanout',
            coverage: 'direct',
            supportingFactIds: [FIXTURE_IDS.factId],
            relatedHypothesisIds: [FIXTURE_IDS.hypothesisId]
          },
          {
            symptomId: FIXTURE_IDS.secondarySymptomId,
            statement: 'latency remains stable on the legacy path',
            coverage: 'none',
            supportingFactIds: [],
            relatedHypothesisIds: []
          }
        ],
        summary: { direct: 1, indirect: 0, none: 1 }
      },
      timeline: [
        {
          eventId: 'event_r1_case_open',
          eventType: 'case.opened',
          caseRevision: 1,
          occurredAt: '2025-01-01T10:00:00.000Z',
          summary: 'Case opened with a default inquiry.'
        },
        {
          eventId: 'event_r2_symptom_1',
          eventType: 'symptom.reported',
          caseRevision: 2,
          occurredAt: '2025-01-01T10:03:00.000Z',
          summary: 'Primary symptom recorded.'
        },
        {
          eventId: 'event_r2_symptom_2',
          eventType: 'symptom.reported',
          caseRevision: 2,
          occurredAt: '2025-01-01T10:04:00.000Z',
          summary: 'Secondary symptom recorded.'
        },
        {
          eventId: 'event_r3_hypothesis',
          eventType: 'hypothesis.proposed',
          caseRevision: 3,
          occurredAt: '2025-01-01T10:06:00.000Z',
          summary: 'Primary hypothesis proposed.'
        },
        {
          eventId: 'event_r4_fact',
          eventType: 'fact.asserted',
          caseRevision: 4,
          occurredAt: '2025-01-01T10:09:00.000Z',
          summary: 'Direct queue depth evidence attached.'
        }
      ],
      inquiryPanel: {
        inquiry,
        hypotheses: [clone(hypothesisProposed)],
        experiments: [],
        gaps: []
      },
      hypothesisPanel: {
        hypothesis: {
          ...clone(hypothesisProposed),
          dependsOnFactIds: [FIXTURE_IDS.factId]
        },
        supportingFacts: [clone(fact)],
        contradictingFacts: [],
        linkedExperiments: [],
        openGaps: [],
        openResiduals: []
      },
      guardrails: {
        aggregate: {
          kind: 'investigation.guardrail.check_result',
          warnings: [],
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
          pass: false,
          candidateHypothesisIds: [],
          candidatePatchRefs: [],
          blockingGapIds: [],
          blockingResidualIds: [],
          uncoveredCriticalSymptomIds: [],
          incompleteExperimentIds: [FIXTURE_IDS.experimentId],
          reasons: ['No completed experiment supports the candidate patch yet.']
        },
        closeCase: {
          kind: 'investigation.guardrail.close_case_check_result',
          pass: false,
          blockingInquiryIds: [FIXTURE_IDS.inquiryId],
          blockingResidualIds: [],
          missingValidationRefs: [FIXTURE_IDS.symptomId],
          reasons: ['Case must reach repair_validation before it can be closed.']
        }
      }
    },
    {
      revision: 5,
      caseRecord: {
        ...baseCase,
        stage: 'discriminative_testing',
        revision: 5
      },
      counts: {
        inquiries: 1,
        symptoms: 2,
        artifacts: 1,
        facts: 1
      },
      nodes: [
        { id: FIXTURE_IDS.caseId, kind: 'case', label: baseCase.title, status: 'active', revision: 5 },
        { id: FIXTURE_IDS.inquiryId, kind: 'inquiry', label: inquiry.title, status: 'open', revision: 5 },
        { id: FIXTURE_IDS.symptomId, kind: 'symptom', label: 'workers stall under burst fanout', status: 'open', revision: 5 },
        { id: FIXTURE_IDS.secondarySymptomId, kind: 'symptom', label: 'latency remains stable on the legacy path', status: 'open', revision: 5 },
        { id: FIXTURE_IDS.hypothesisId, kind: 'hypothesis', label: hypothesisFavored.title, status: 'favored', revision: 5 },
        { id: FIXTURE_IDS.factId, kind: 'fact', label: fact.statement, status: 'recorded', revision: 5 },
        { id: FIXTURE_IDS.experimentId, kind: 'experiment', label: experiment.title, status: 'completed', revision: 5 }
      ],
      edges: [
        {
          key: `${FIXTURE_IDS.hypothesisId}->${FIXTURE_IDS.symptomId}:explains`,
          type: 'explains',
          fromId: FIXTURE_IDS.hypothesisId,
          toId: FIXTURE_IDS.symptomId
        },
        {
          key: `${FIXTURE_IDS.factId}->${FIXTURE_IDS.symptomId}:evidences`,
          type: 'evidences',
          fromId: FIXTURE_IDS.factId,
          toId: FIXTURE_IDS.symptomId
        },
        {
          key: `${FIXTURE_IDS.experimentId}->${FIXTURE_IDS.hypothesisId}:tests`,
          type: 'tests',
          fromId: FIXTURE_IDS.experimentId,
          toId: FIXTURE_IDS.hypothesisId
        }
      ],
      coverage: {
        items: [
          {
            symptomId: FIXTURE_IDS.symptomId,
            statement: 'workers stall under burst fanout',
            coverage: 'direct',
            supportingFactIds: [FIXTURE_IDS.factId],
            relatedHypothesisIds: [FIXTURE_IDS.hypothesisId]
          },
          {
            symptomId: FIXTURE_IDS.secondarySymptomId,
            statement: 'latency remains stable on the legacy path',
            coverage: 'none',
            supportingFactIds: [],
            relatedHypothesisIds: []
          }
        ],
        summary: { direct: 1, indirect: 0, none: 1 }
      },
      timeline: [
        {
          eventId: 'event_r1_case_open',
          eventType: 'case.opened',
          caseRevision: 1,
          occurredAt: '2025-01-01T10:00:00.000Z',
          summary: 'Case opened with a default inquiry.'
        },
        {
          eventId: 'event_r2_symptom_1',
          eventType: 'symptom.reported',
          caseRevision: 2,
          occurredAt: '2025-01-01T10:03:00.000Z',
          summary: 'Primary symptom recorded.'
        },
        {
          eventId: 'event_r2_symptom_2',
          eventType: 'symptom.reported',
          caseRevision: 2,
          occurredAt: '2025-01-01T10:04:00.000Z',
          summary: 'Secondary symptom recorded.'
        },
        {
          eventId: 'event_r3_hypothesis',
          eventType: 'hypothesis.proposed',
          caseRevision: 3,
          occurredAt: '2025-01-01T10:06:00.000Z',
          summary: 'Primary hypothesis proposed.'
        },
        {
          eventId: 'event_r4_fact',
          eventType: 'fact.asserted',
          caseRevision: 4,
          occurredAt: '2025-01-01T10:09:00.000Z',
          summary: 'Direct queue depth evidence attached.'
        },
        {
          eventId: 'event_r5_experiment',
          eventType: 'experiment.completed',
          caseRevision: 5,
          occurredAt: '2025-01-01T10:12:00.000Z',
          summary: 'Load replay confirms the worker pool branch.'
        }
      ],
      inquiryPanel: {
        inquiry,
        hypotheses: [clone(hypothesisFavored)],
        experiments: [clone(experiment)],
        gaps: []
      },
      hypothesisPanel: {
        hypothesis: clone(hypothesisFavored),
        supportingFacts: [clone(fact)],
        contradictingFacts: [],
        linkedExperiments: [clone(experiment)],
        openGaps: [],
        openResiduals: []
      },
      guardrails: {
        aggregate: {
          kind: 'investigation.guardrail.check_result',
          warnings: [],
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
          pass: true,
          candidateHypothesisIds: [FIXTURE_IDS.hypothesisId],
          candidatePatchRefs: ['entity_worker_pool_queue'],
          blockingGapIds: [],
          blockingResidualIds: [],
          uncoveredCriticalSymptomIds: [],
          incompleteExperimentIds: [],
          reasons: []
        },
        closeCase: {
          kind: 'investigation.guardrail.close_case_check_result',
          pass: false,
          blockingInquiryIds: [FIXTURE_IDS.inquiryId],
          blockingResidualIds: [],
          missingValidationRefs: [FIXTURE_IDS.symptomId],
          reasons: ['Case must reach repair_validation before it can be closed.']
        }
      }
    }
  ];

  return revisions;
}

function buildAdvancedRevision(previous: RevisionState): RevisionState {
  return {
    ...clone(previous),
    revision: 6,
    caseRecord: {
      ...clone(previous.caseRecord),
      stage: 'repair_preparation',
      revision: 6
    },
    nodes: previous.nodes.map((node) => node.id === FIXTURE_IDS.caseId ? { ...node, revision: 6 } : clone(node)),
    timeline: [
      ...clone(previous.timeline),
      {
        eventId: 'event_r6_stage_advance',
        eventType: 'case.stage_advanced',
        caseRevision: 6,
        occurredAt: '2025-01-01T10:16:00.000Z',
        summary: 'Reviewer advanced the case to repair_preparation.'
      }
    ]
  };
}

function buildConfirmedRevision(previous: RevisionState): RevisionState {
  return {
    ...clone(previous),
    revision: 7,
    caseRecord: {
      ...clone(previous.caseRecord),
      revision: 7
    },
    nodes: previous.nodes.map((node) => {
      if (node.id === FIXTURE_IDS.caseId) {
        return { ...node, revision: 7 };
      }

      if (node.id === FIXTURE_IDS.hypothesisId) {
        return { ...node, revision: 7, status: 'confirmed' };
      }

      return clone(node);
    }),
    timeline: [
      ...clone(previous.timeline),
      {
        eventId: 'event_r7_hypothesis_confirmed',
        eventType: 'hypothesis.status_updated',
        caseRevision: 7,
        occurredAt: '2025-01-01T10:19:00.000Z',
        summary: 'Reviewer confirmed the favored hypothesis.'
      }
    ],
    inquiryPanel: {
      ...clone(previous.inquiryPanel),
      hypotheses: previous.inquiryPanel.hypotheses.map((hypothesis) => ({
        ...clone(hypothesis),
        ...(hypothesis.id === FIXTURE_IDS.hypothesisId ? { status: 'confirmed' } : {})
      }))
    },
    hypothesisPanel: {
      ...clone(previous.hypothesisPanel),
      hypothesis: {
        ...clone(previous.hypothesisPanel.hypothesis),
        status: 'confirmed'
      }
    }
  };
}

function buildGapOpenedRevision(previous: RevisionState, question: string, blockedRef: string | null): RevisionState {
  const nextRevision = previous.revision + 1;
  const gapNode = {
    id: FIXTURE_IDS.gapId,
    kind: 'gap',
    label: question,
    status: 'open',
    revision: nextRevision
  };
  const blockedRefs = blockedRef ? [blockedRef] : [];
  const nextEdges = blockedRef
    ? [
        ...clone(previous.edges),
        {
          key: `${FIXTURE_IDS.gapId}->${blockedRef}:blocks`,
          type: 'blocks',
          fromId: FIXTURE_IDS.gapId,
          toId: blockedRef
        }
      ]
    : clone(previous.edges);

  return {
    ...clone(previous),
    revision: nextRevision,
    caseRecord: {
      ...clone(previous.caseRecord),
      revision: nextRevision
    },
    nodes: [...clone(previous.nodes).filter((node) => node.id !== FIXTURE_IDS.gapId), gapNode],
    edges: nextEdges,
    timeline: [
      ...clone(previous.timeline),
      {
        eventId: `event_r${nextRevision}_gap_opened`,
        eventType: 'gap.opened',
        caseRevision: nextRevision,
        occurredAt: '2025-01-01T10:21:00.000Z',
        summary: 'Reviewer opened a follow-up investigation gap.'
      }
    ],
    inquiryPanel: {
      ...clone(previous.inquiryPanel),
      gaps: [
        ...previous.inquiryPanel.gaps.filter((gap) => gap.id !== FIXTURE_IDS.gapId).map(clone),
        {
          id: FIXTURE_IDS.gapId,
          caseId: previous.caseRecord.id,
          status: 'open',
          question,
          blockedRefs
        }
      ]
    },
    hypothesisPanel: {
      ...clone(previous.hypothesisPanel),
      openGaps: [
        ...previous.hypothesisPanel.openGaps.filter((gap) => gap.id !== FIXTURE_IDS.gapId).map(clone),
        {
          id: FIXTURE_IDS.gapId,
          caseId: previous.caseRecord.id,
          status: 'open',
          question,
          blockedRefs
        }
      ]
    },
    guardrails: {
      ...clone(previous.guardrails),
      readyToPatch: {
        ...clone(previous.guardrails.readyToPatch),
        pass: false,
        blockingGapIds: [FIXTURE_IDS.gapId],
        reasons: ['Open gaps still block patch readiness.']
      }
    }
  };
}

function buildGapResolvedRevision(previous: RevisionState, gapId: string, reason: string): RevisionState {
  const nextRevision = previous.revision + 1;

  return {
    ...clone(previous),
    revision: nextRevision,
    caseRecord: {
      ...clone(previous.caseRecord),
      revision: nextRevision
    },
    nodes: previous.nodes.map((node) => {
      if (node.id === gapId) {
        return { ...node, revision: nextRevision, status: 'resolved' };
      }

      if (node.id === FIXTURE_IDS.caseId) {
        return { ...node, revision: nextRevision };
      }

      return clone(node);
    }),
    timeline: [
      ...clone(previous.timeline),
      {
        eventId: `event_r${nextRevision}_gap_resolved`,
        eventType: 'gap.resolved',
        caseRevision: nextRevision,
        occurredAt: '2025-01-01T10:23:00.000Z',
        summary: reason || 'Reviewer resolved the open gap.'
      }
    ],
    inquiryPanel: {
      ...clone(previous.inquiryPanel),
      gaps: previous.inquiryPanel.gaps.map((gap) => gap.id === gapId ? { ...clone(gap), status: 'resolved', reason } : clone(gap))
    },
    hypothesisPanel: {
      ...clone(previous.hypothesisPanel),
      openGaps: previous.hypothesisPanel.openGaps.filter((gap) => gap.id !== gapId).map(clone)
    },
    guardrails: {
      ...clone(previous.guardrails),
      readyToPatch: {
        ...clone(previous.guardrails.readyToPatch),
        pass: previous.hypothesisPanel.hypothesis.status === 'confirmed' || previous.guardrails.readyToPatch.pass,
        blockingGapIds: [],
        reasons: []
      }
    }
  };
}

function buildDecisionRecordedRevision(previous: RevisionState, title: string, supportingHypothesisId: string | null): RevisionState {
  const nextRevision = previous.revision + 1;
  const decisionNode = {
    id: FIXTURE_IDS.decisionId,
    kind: 'decision',
    label: title,
    status: 'recorded',
    revision: nextRevision
  };
  const nextEdges = supportingHypothesisId
    ? [
        ...clone(previous.edges),
        {
          key: `${FIXTURE_IDS.decisionId}->${supportingHypothesisId}:decides`,
          type: 'decides',
          fromId: FIXTURE_IDS.decisionId,
          toId: supportingHypothesisId
        }
      ]
    : clone(previous.edges);

  return {
    ...clone(previous),
    revision: nextRevision,
    caseRecord: {
      ...clone(previous.caseRecord),
      revision: nextRevision
    },
    nodes: [...clone(previous.nodes).filter((node) => node.id !== FIXTURE_IDS.decisionId), decisionNode],
    edges: nextEdges,
    timeline: [
      ...clone(previous.timeline),
      {
        eventId: `event_r${nextRevision}_decision_recorded`,
        eventType: 'decision.recorded',
        caseRevision: nextRevision,
        occurredAt: '2025-01-01T10:24:00.000Z',
        summary: 'Reviewer recorded a branch decision.'
      }
    ]
  };
}

function buildResidualUpdatedRevision(previous: RevisionState, residualId: string, newStatus: string, rationale: string): RevisionState {
  const nextRevision = previous.revision + 1;
  const hasResidual = previous.nodes.some((node) => node.id === residualId);
  const residualNode = hasResidual
    ? null
    : {
        id: residualId,
        kind: 'residual',
        label: 'Residual risk review',
        status: 'open',
        revision: previous.revision
      };

  return {
    ...clone(previous),
    revision: nextRevision,
    caseRecord: {
      ...clone(previous.caseRecord),
      revision: nextRevision
    },
    nodes: [
      ...clone(previous.nodes)
        .filter((node) => node.id !== residualId)
        .map((node) => node.id === FIXTURE_IDS.caseId ? { ...node, revision: nextRevision } : clone(node)),
      {
        ...(residualNode ?? clone(previous.nodes.find((node) => node.id === residualId)!)),
        status: newStatus,
        revision: nextRevision
      }
    ],
    timeline: [
      ...clone(previous.timeline),
      {
        eventId: `event_r${nextRevision}_residual_updated`,
        eventType: 'residual.updated',
        caseRevision: nextRevision,
        occurredAt: '2025-01-01T10:25:00.000Z',
        summary: rationale || 'Reviewer updated a residual risk.'
      }
    ]
  };
}

function pushRevision(revisions: RevisionState[], nextRevision: RevisionState) {
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

function requireString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  throw new Error(`${key} is required`);
}

function parseResourceUri(uri: string) {
  const url = new URL(uri);
  const segments = url.pathname.split('/').filter(Boolean);
  return {
    url,
    collection: url.hostname,
    segments
  };
}

function pickRevision(states: RevisionState[], requestedRevision: number | null): RevisionState {
  const head = states[states.length - 1]!;
  if (requestedRevision === null || requestedRevision >= head.revision) {
    return head;
  }

  return states.find((state) => state.revision === requestedRevision) ?? head;
}

function readFocusedGraph(state: RevisionState, focusId: string | null) {
  if (!focusId) {
    return {
      focusId: null,
      nodes: clone(state.nodes),
      edges: clone(state.edges)
    };
  }

  const relatedNodeIds = new Set<string>([focusId]);
  const edges = state.edges.filter((edge) => edge.fromId === focusId || edge.toId === focusId);
  for (const edge of edges) {
    relatedNodeIds.add(edge.fromId);
    relatedNodeIds.add(edge.toId);
  }

  return {
    focusId,
    nodes: state.nodes.filter((node) => relatedNodeIds.has(node.id)).map(clone),
    edges: edges.map(clone)
  };
}

function readDiff(states: RevisionState[], fromRevision: number, toRevision: number) {
  const before = pickRevision(states, fromRevision);
  const after = pickRevision(states, toRevision);
  const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]));
  const afterNodes = new Map(after.nodes.map((node) => [node.id, node]));
  const changedNodeIds = new Set<string>();
  const stateTransitions: Array<{ nodeId: string; kind: string; fromStatus: string | null; toStatus: string | null }> = [];

  for (const nodeId of new Set([...beforeNodes.keys(), ...afterNodes.keys()])) {
    const prevNode = beforeNodes.get(nodeId);
    const nextNode = afterNodes.get(nodeId);
    if (!prevNode || !nextNode) {
      changedNodeIds.add(nodeId);
      continue;
    }

    if (prevNode.status !== nextNode.status || prevNode.label !== nextNode.label || prevNode.revision !== nextNode.revision) {
      changedNodeIds.add(nodeId);
    }

    if (prevNode.status !== nextNode.status) {
      stateTransitions.push({
        nodeId,
        kind: nextNode.kind,
        fromStatus: prevNode.status,
        toStatus: nextNode.status
      });
    }
  }

  const beforeEdgeKeys = new Set(before.edges.map((edge) => edge.key));
  const afterEdgeKeys = new Set(after.edges.map((edge) => edge.key));
  const changedEdgeKeys = [...new Set([
    ...[...beforeEdgeKeys].filter((key) => !afterEdgeKeys.has(key)),
    ...[...afterEdgeKeys].filter((key) => !beforeEdgeKeys.has(key))
  ])].sort();

  return {
    fromRevision: before.revision,
    toRevision: after.revision,
    changedNodeIds: [...changedNodeIds].sort(),
    changedEdgeKeys,
    stateTransitions,
    summary: [
      `${changedNodeIds.size} nodes changed`,
      `${stateTransitions.length} state transitions`,
      `${changedEdgeKeys.length} edges changed`
    ]
  };
}

export function createFixtureMcpClient(): ConsoleMcpClient {
  const revisions = buildRevisionStates();

  return {
    async readResource(uri: string): Promise<ResourceReadResult> {
      const parsed = parseResourceUri(uri);
      const requestedRevisionRaw = parsed.url.searchParams.get('atRevision');
      const requestedRevision = requestedRevisionRaw ? Number(requestedRevisionRaw) : null;
      const state = pickRevision(revisions, Number.isInteger(requestedRevision) ? requestedRevision : null);
      const headRevision = revisions[revisions.length - 1]!.revision;

      if (parsed.collection !== 'cases') {
        throw new Error(`Unsupported resource collection: ${parsed.collection}`);
      }

      if (parsed.segments.length === 0) {
        return {
          uri,
          mimeType: 'application/json',
          data: createResourceEnvelope({
            headRevision,
            projectionRevision: headRevision,
            data: {
              items: [
                {
                  caseId: FIXTURE_IDS.caseId,
                  title: state.caseRecord.title,
                  status: state.caseRecord.status,
                  stage: state.caseRecord.stage,
                  severity: state.caseRecord.severity,
                  headRevision,
                  updatedAt: '2025-01-01T10:16:00.000Z'
                }
              ]
            }
          })
        };
      }

      const [caseId, resourceName, resourceId] = parsed.segments;
      if (caseId !== FIXTURE_IDS.caseId) {
        throw new Error(`Unknown case ${caseId}`);
      }

      switch (resourceName) {
        case 'snapshot':
          return {
            uri,
            mimeType: 'application/json',
            data: createResourceEnvelope({
              headRevision,
              projectionRevision: state.revision,
              requestedRevision: state.revision < headRevision ? state.revision : null,
              data: {
                case: clone(state.caseRecord),
                counts: clone(state.counts),
                warnings: []
              }
            })
          };
        case 'timeline':
          return {
            uri,
            mimeType: 'application/json',
            data: createResourceEnvelope({
              headRevision,
              projectionRevision: state.revision,
              requestedRevision: state.revision < headRevision ? state.revision : null,
              data: {
                events: clone(state.timeline)
              }
            })
          };
        case 'graph':
          return {
            uri,
            mimeType: 'application/json',
            data: createResourceEnvelope({
              headRevision,
              projectionRevision: state.revision,
              requestedRevision: state.revision < headRevision ? state.revision : null,
              data: readFocusedGraph(state, parsed.url.searchParams.get('focusId'))
            })
          };
        case 'coverage':
          return {
            uri,
            mimeType: 'application/json',
            data: createResourceEnvelope({
              headRevision,
              projectionRevision: state.revision,
              requestedRevision: state.revision < headRevision ? state.revision : null,
              data: clone(state.coverage)
            })
          };
        case 'diff': {
          const fromRevision = Number(parsed.url.searchParams.get('fromRevision') ?? '0');
          const toRevision = Number(parsed.url.searchParams.get('toRevision') ?? headRevision);
          return {
            uri,
            mimeType: 'application/json',
            data: createResourceEnvelope({
              headRevision,
              projectionRevision: Math.min(toRevision, headRevision),
              requestedRevision: toRevision < headRevision ? toRevision : null,
              data: readDiff(revisions, fromRevision, toRevision)
            })
          };
        }
        case 'hypotheses':
          return {
            uri,
            mimeType: 'application/json',
            data: createResourceEnvelope({
              headRevision,
              projectionRevision: state.revision,
              requestedRevision: state.revision < headRevision ? state.revision : null,
              data: resourceId === FIXTURE_IDS.hypothesisId ? clone(state.hypothesisPanel) : { hypothesis: null }
            })
          };
        case 'inquiries':
          return {
            uri,
            mimeType: 'application/json',
            data: createResourceEnvelope({
              headRevision,
              projectionRevision: state.revision,
              requestedRevision: state.revision < headRevision ? state.revision : null,
              data: resourceId === FIXTURE_IDS.inquiryId ? clone(state.inquiryPanel) : { inquiry: null, hypotheses: [], experiments: [], gaps: [] }
            })
          };
        default:
          throw new Error(`Unsupported resource ${resourceName}`);
      }
    },

    async invokeTool(name: string, input: Record<string, unknown>) {
      const headState = revisions[revisions.length - 1]!;

      switch (name) {
        case 'investigation.guardrail.check':
          return clone(headState.guardrails.aggregate);
        case 'investigation.guardrail.stall_check':
          return clone(headState.guardrails.stall);
        case 'investigation.guardrail.ready_to_patch_check':
          return clone(headState.guardrails.readyToPatch);
        case 'investigation.guardrail.close_case_check':
          return clone(headState.guardrails.closeCase);
        case 'investigation.case.advance_stage': {
          if (typeof input.confirmToken !== 'string' || input.confirmToken.length === 0) {
            throw new Error('confirmToken is required');
          }

          if (typeof input.stage !== 'string' || input.stage !== 'repair_preparation') {
            throw new Error('fixture only supports repair_preparation');
          }

          if (revisions[revisions.length - 1]!.revision < 6) {
            const nextRevision = buildAdvancedRevision(revisions[revisions.length - 1]!);
            pushRevision(revisions, nextRevision);
          }

          const nextState = revisions[revisions.length - 1]!;
          return {
            ok: true,
            headRevisionBefore: headState.revision,
            headRevisionAfter: nextState.revision,
            projectionScheduled: false,
            createdIds: [],
            warnings: [],
            violations: []
          };
        }
        case 'investigation.hypothesis.update_status': {
          if (typeof input.confirmToken !== 'string' || input.confirmToken.length === 0) {
            throw new Error('confirmToken is required');
          }

          if (input.newStatus !== 'confirmed') {
            throw new Error('fixture only supports confirmed hypothesis transitions');
          }

          if (revisions[revisions.length - 1]!.revision < 7) {
            pushRevision(revisions, buildConfirmedRevision(revisions[revisions.length - 1]!));
          }

          const nextState = revisions[revisions.length - 1]!;
          return {
            ok: true,
            headRevisionBefore: headState.revision,
            headRevisionAfter: nextState.revision,
            projectionScheduled: false,
            updatedIds: [requireString(input, 'hypothesisId')],
            warnings: [],
            violations: []
          };
        }
        case 'investigation.gap.open': {
          const question = requireString(input, 'question');
          const blockedRefs = Array.isArray(input.blockedRefs)
            ? input.blockedRefs.filter((value): value is string => typeof value === 'string' && value.length > 0)
            : [];
          const nextRevision = buildGapOpenedRevision(revisions[revisions.length - 1]!, question, blockedRefs[0] ?? null);
          pushRevision(revisions, nextRevision);

          return {
            ok: true,
            headRevisionBefore: headState.revision,
            headRevisionAfter: nextRevision.revision,
            projectionScheduled: false,
            createdIds: [FIXTURE_IDS.gapId],
            warnings: [],
            violations: []
          };
        }
        case 'investigation.gap.resolve': {
          const gapId = requireString(input, 'gapId');
          const nextRevision = buildGapResolvedRevision(
            revisions[revisions.length - 1]!,
            gapId,
            typeof input.reason === 'string' ? input.reason : ''
          );
          pushRevision(revisions, nextRevision);

          return {
            ok: true,
            headRevisionBefore: headState.revision,
            headRevisionAfter: nextRevision.revision,
            projectionScheduled: false,
            updatedIds: [gapId],
            warnings: [],
            violations: []
          };
        }
        case 'investigation.decision.record': {
          const nextRevision = buildDecisionRecordedRevision(
            revisions[revisions.length - 1]!,
            requireString(input, 'title'),
            Array.isArray(input.supportingHypothesisIds) && typeof input.supportingHypothesisIds[0] === 'string'
              ? input.supportingHypothesisIds[0]
              : null
          );
          pushRevision(revisions, nextRevision);

          return {
            ok: true,
            headRevisionBefore: headState.revision,
            headRevisionAfter: nextRevision.revision,
            projectionScheduled: false,
            createdIds: [FIXTURE_IDS.decisionId],
            warnings: [],
            violations: []
          };
        }
        case 'investigation.residual.update': {
          if (typeof input.confirmToken !== 'string' || input.confirmToken.length === 0) {
            throw new Error('confirmToken is required');
          }

          const residualId = requireString(input, 'residualId');
          const nextRevision = buildResidualUpdatedRevision(
            revisions[revisions.length - 1]!,
            residualId,
            requireString(input, 'newStatus'),
            typeof input.rationale === 'string' ? input.rationale : ''
          );
          pushRevision(revisions, nextRevision);

          return {
            ok: true,
            headRevisionBefore: headState.revision,
            headRevisionAfter: nextRevision.revision,
            projectionScheduled: false,
            updatedIds: [residualId],
            warnings: [],
            violations: []
          };
        }
        default:
          throw new Error(`Unsupported tool ${name}`);
      }
    },

    async close() {
      return;
    }
  };
}