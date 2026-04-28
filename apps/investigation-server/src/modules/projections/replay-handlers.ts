import {
  asString,
  asStringArray,
  patchNode,
  patchNodeStatus,
  upsertNode,
  type StoredEventHandler
} from './replay-helpers.js';

const caseHandlers: Record<string, StoredEventHandler> = {
  'case.opened': (state, event, payload) => {
    const caseId = asString(payload.caseId) ?? state.caseId;
    const title = asString(payload.title) ?? null;
    const objective = asString(payload.objective) ?? null;
    const severity = asString(payload.severity) ?? null;
    const defaultProblemId = asString(payload.defaultProblemId);

    state.caseRecord = {
      id: caseId,
      title,
      severity,
      status: 'active',
      revision: event.caseRevision,
      payload: {
        id: caseId,
        title,
        objective,
        severity,
        defaultProblemId: defaultProblemId ?? null,
        status: 'active'
      }
    };

    if (defaultProblemId) {
      upsertNode(state, 'problems', defaultProblemId, event.caseRevision, {
        id: defaultProblemId,
        caseId,
        title,
        description: objective,
        environment: '',
        symptoms: [],
        resolutionCriteria: [],
        referenceMaterials: [],
        status: 'open'
      }, 'open');
    }
  },
  'case.stage_advanced': (state, event, payload) => {
    const status = asString(payload.status) ?? state.caseRecord?.status ?? 'active';
    if (state.caseRecord) {
      state.caseRecord = {
        ...state.caseRecord,
        status,
        revision: event.caseRevision,
        payload: {
          ...state.caseRecord.payload,
          status,
          reason: payload.reason ?? null
        }
      };
    }
  },
  'case.closed': (state, event, payload) => {
    const status = asString(payload.status) ?? 'closed';
    if (state.caseRecord) {
      state.caseRecord = {
        ...state.caseRecord,
        status,
        revision: event.caseRevision,
        payload: {
          ...state.caseRecord.payload,
          status,
          reason: payload.reason ?? null
        }
      };
    }
  }
};

const problemHandlers: Record<string, StoredEventHandler> = {
  'problem.updated': (state, event, payload) => {
    const problemId = asString(payload.problemId);
    if (problemId) {
      patchNode(state, 'problems', problemId, event.caseRevision, {
        ...(payload.title !== null && payload.title !== undefined ? { title: asString(payload.title) ?? null } : {}),
        ...(payload.description !== null && payload.description !== undefined ? { description: asString(payload.description) ?? null } : {}),
        ...(payload.environment !== null && payload.environment !== undefined ? { environment: asString(payload.environment) ?? null } : {}),
        ...(Array.isArray(payload.symptoms) ? { symptoms: asStringArray(payload.symptoms) } : {}),
        ...(Array.isArray(payload.resolutionCriteria) ? { resolutionCriteria: asStringArray(payload.resolutionCriteria) } : {})
      });
    }
  },
  'problem.status_updated': (state, event, payload) => {
    patchNodeStatus(state, 'problems', asString(payload.problemId), event.caseRevision, asString(payload.newStatus));
  },
  'problem.reference_material_added': (state, event, payload) => {
    const problemId = asString(payload.problemId);
    if (problemId) {
      const current = state.tables.problems.get(problemId);
      const currentPayload = current?.payload ?? {};
      const nextMaterial = {
        materialId: asString(payload.materialId) ?? '',
        kind: asString(payload.materialKind) ?? 'other',
        title: asString(payload.title) ?? '',
        contentRef: payload.contentRef ?? null,
        note: payload.note ?? null
      };
      const currentMaterials = Array.isArray(currentPayload.referenceMaterials) ? currentPayload.referenceMaterials : [];
      patchNode(state, 'problems', problemId, event.caseRevision, {
        referenceMaterials: [...currentMaterials, nextMaterial]
      });
    }
  }
};

const hypothesisHandlers: Record<string, StoredEventHandler> = {
  'canonical.hypothesis.created': (state, event, payload) => {
    const hypothesisId = asString(payload.hypothesisId);
    if (hypothesisId) {
      upsertNode(state, 'hypotheses', hypothesisId, event.caseRevision, {
        id: hypothesisId,
        caseId: state.caseId,
        canonicalKind: 'hypothesis',
        parentNodeId: asString(payload.parentNodeId) ?? null,
        parentNodeKind: asString(payload.parentNodeKind) ?? null,
        title: asString(payload.title) ?? asString(payload.statement) ?? null,
        statement: asString(payload.statement) ?? null,
        falsificationCriteria: asStringArray(payload.falsificationCriteria),
        derivedFromEvidenceIds: asStringArray(payload.derivedFromEvidenceIds),
        status: 'unverified'
      }, 'unverified');
    }
  },
  'canonical.hypothesis.status_updated': (state, event, payload) => {
    patchNodeStatus(state, 'hypotheses', asString(payload.hypothesisId), event.caseRevision, asString(payload.newStatus));
  },
  'canonical.hypothesis.updated': (state, event, payload) => {
    const hypothesisId = asString(payload.hypothesisId);
    if (hypothesisId) {
      patchNode(state, 'hypotheses', hypothesisId, event.caseRevision, {
        ...(payload.title !== null && payload.title !== undefined ? { title: asString(payload.title) ?? null } : {}),
        ...(payload.statement !== null && payload.statement !== undefined ? { statement: asString(payload.statement) ?? null } : {}),
        ...(Array.isArray(payload.falsificationCriteria) ? { falsificationCriteria: asStringArray(payload.falsificationCriteria) } : {})
      });
    }
  }
};

const blockerHandlers: Record<string, StoredEventHandler> = {
  'canonical.blocker.opened': (state, event, payload) => {
    const blockerId = asString(payload.blockerId);
    if (blockerId) {
      upsertNode(state, 'blockers', blockerId, event.caseRevision, {
        id: blockerId,
        caseId: state.caseId,
        canonicalKind: 'blocker',
        parentNodeId: asString(payload.hypothesisId) ?? null,
        parentNodeKind: 'hypothesis',
        description: asString(payload.description) ?? null,
        possibleWorkarounds: asStringArray(payload.possibleWorkarounds),
        status: 'active'
      }, 'active');
    }
  },
  'canonical.blocker.closed': (state, event, payload) => {
    patchNodeStatus(state, 'blockers', asString(payload.blockerId), event.caseRevision, asString(payload.newStatus));
  },
  'canonical.blocker.updated': (state, event, payload) => {
    const blockerId = asString(payload.blockerId);
    if (blockerId) {
      patchNode(state, 'blockers', blockerId, event.caseRevision, {
        ...(payload.description !== null && payload.description !== undefined ? { description: asString(payload.description) ?? null } : {}),
        ...(Array.isArray(payload.possibleWorkarounds) ? { possibleWorkarounds: asStringArray(payload.possibleWorkarounds) } : {})
      });
    }
  }
};

const repairAttemptHandlers: Record<string, StoredEventHandler> = {
  'canonical.repair_attempt.created': (state, event, payload) => {
    const repairAttemptId = asString(payload.repairAttemptId);
    if (repairAttemptId) {
      upsertNode(state, 'repair_attempts', repairAttemptId, event.caseRevision, {
        id: repairAttemptId,
        caseId: state.caseId,
        canonicalKind: 'repair_attempt',
        parentNodeId: asString(payload.parentNodeId) ?? null,
        parentNodeKind: asString(payload.parentNodeKind) ?? null,
        changeSummary: asString(payload.changeSummary) ?? null,
        scope: asString(payload.scope) ?? null,
        confidence: typeof payload.confidence === 'number' ? payload.confidence : null,
        status: 'proposed'
      }, 'proposed');
    }
  },
  'canonical.repair_attempt.status_updated': (state, event, payload) => {
    patchNodeStatus(state, 'repair_attempts', asString(payload.repairAttemptId), event.caseRevision, asString(payload.newStatus));
  },
  'canonical.repair_attempt.updated': (state, event, payload) => {
    const repairAttemptId = asString(payload.repairAttemptId);
    if (repairAttemptId) {
      patchNode(state, 'repair_attempts', repairAttemptId, event.caseRevision, {
        ...(payload.changeSummary !== null && payload.changeSummary !== undefined ? { changeSummary: asString(payload.changeSummary) ?? null } : {}),
        ...(payload.scope !== null && payload.scope !== undefined ? { scope: asString(payload.scope) ?? null } : {})
      });
    }
  }
};

const evidenceHandlers: Record<string, StoredEventHandler> = {
  'canonical.evidence.captured': (state, event, payload) => {
    const evidenceId = asString(payload.evidenceId);
    if (evidenceId) {
      upsertNode(state, 'evidence_pool', evidenceId, event.caseRevision, {
        id: evidenceId,
        caseId: state.caseId,
        canonicalKind: 'evidence',
        kind: asString(payload.kind) ?? 'other',
        title: asString(payload.title) ?? null,
        summary: asString(payload.summary) ?? null,
        contentRef: payload.contentRef ?? null,
        provenance: asString(payload.provenance) ?? null,
        confidence: typeof payload.confidence === 'number' ? payload.confidence : null
      });
    }
  },
  'canonical.evidence.attached': (state, event, payload) => {
    const evidenceRefId = asString(payload.evidenceRefId);
    if (evidenceRefId) {
      upsertNode(state, 'evidence_refs', evidenceRefId, event.caseRevision, {
        id: evidenceRefId,
        caseId: state.caseId,
        canonicalKind: 'evidence_ref',
        parentNodeId: asString(payload.parentNodeId) ?? null,
        parentNodeKind: asString(payload.parentNodeKind) ?? null,
        evidenceId: asString(payload.evidenceId) ?? null,
        effectOnParent: asString(payload.effectOnParent) ?? null,
        interpretation: asString(payload.interpretation) ?? null,
        localConfidence: typeof payload.localConfidence === 'number' ? payload.localConfidence : null
      });
    }
  },
  'canonical.evidence_ref.updated': (state, event, payload) => {
    const evidenceRefId = asString(payload.evidenceRefId);
    if (evidenceRefId) {
      patchNode(state, 'evidence_refs', evidenceRefId, event.caseRevision, {
        ...(payload.effectOnParent !== null && payload.effectOnParent !== undefined ? { effectOnParent: asString(payload.effectOnParent) ?? null } : {}),
        ...(payload.interpretation !== null && payload.interpretation !== undefined ? { interpretation: asString(payload.interpretation) ?? null } : {})
      });
    }

    const evidenceId = asString(payload.evidenceId);
    if (evidenceId) {
      patchNode(state, 'evidence_pool', evidenceId, event.caseRevision, {
        ...(payload.title !== null && payload.title !== undefined ? { title: asString(payload.title) ?? null } : {}),
        ...(payload.summary !== null && payload.summary !== undefined ? { summary: asString(payload.summary) ?? null } : {}),
        ...(payload.provenance !== null && payload.provenance !== undefined ? { provenance: asString(payload.provenance) ?? null } : {})
      });
    }
  }
};

export const STORED_EVENT_HANDLERS: Record<string, StoredEventHandler> = {
  ...caseHandlers,
  ...problemHandlers,
  ...hypothesisHandlers,
  ...blockerHandlers,
  ...repairAttemptHandlers,
  ...evidenceHandlers
};
