import { buildIdempotencyKey, splitLines } from '@coe/shared-utils';

import { invokeTool, requestConfirmIntent, type GraphNodeRecord } from '../../lib/api.js';
import type { DraftNodeRecord } from './case-node-drafts.js';

export interface SavedNodeDraftState {
  changeSummary: string;
  description: string;
  effectOnParent: string;
  environment: string;
  falsificationCriteria: string;
  interpretation: string;
  possibleWorkarounds: string;
  provenance: string;
  resolutionCriteria: string;
  scope: string;
  statement: string;
  summary: string;
  symptoms: string;
  title: string;
}

export async function persistDraftNode(input: {
  caseId: string;
  currentRevision: number;
  draftNode: DraftNodeRecord;
}) {
  const payload = asObject(input.draftNode.payload);

  switch (input.draftNode.kind) {
    case 'hypothesis':
      return invokeTool<{ createdIds?: string[]; headRevisionAfter: number }>('investigation.hypothesis.create', {
        caseId: input.caseId,
        ifCaseRevision: input.currentRevision,
        parentNodeId: input.draftNode.parentNodeId,
        statement: asString(payload.statement) ?? input.draftNode.label,
        title: asString(payload.statement) ?? input.draftNode.label,
        falsificationCriteria: asStringArray(payload.falsificationCriteria),
        idempotencyKey: buildIdempotencyKey('draft-hypothesis-create')
      });
    case 'blocker':
      return invokeTool<{ createdIds?: string[]; headRevisionAfter: number }>('investigation.blocker.open', {
        caseId: input.caseId,
        ifCaseRevision: input.currentRevision,
        hypothesisId: input.draftNode.parentNodeId,
        description: asString(payload.description) ?? input.draftNode.label,
        possibleWorkarounds: asStringArray(payload.possibleWorkarounds),
        idempotencyKey: buildIdempotencyKey('draft-blocker-open')
      });
    case 'repair_attempt':
      return invokeTool<{ createdIds?: string[]; headRevisionAfter: number }>('investigation.repair_attempt.create', {
        caseId: input.caseId,
        ifCaseRevision: input.currentRevision,
        parentNodeId: input.draftNode.parentNodeId,
        changeSummary: asString(payload.changeSummary) ?? input.draftNode.label,
        scope: asString(payload.scope) ?? undefined,
        idempotencyKey: buildIdempotencyKey('draft-repair-create')
      });
    case 'evidence_ref': {
      const evidenceId = asString(payload.evidenceId);
      if (evidenceId) {
        return invokeTool<{ createdIds?: string[]; headRevisionAfter: number }>('investigation.evidence.attach_existing', {
          caseId: input.caseId,
          ifCaseRevision: input.currentRevision,
          parentNodeId: input.draftNode.parentNodeId,
          evidenceId,
          effectOnParent: asString(payload.effectOnParent) ?? (input.draftNode.parentKind === 'repair_attempt' ? 'validates' : 'supports'),
          interpretation: asString(payload.interpretation) ?? '',
          idempotencyKey: buildIdempotencyKey('draft-evidence-attach')
        });
      }

      return invokeTool<{ createdIds?: string[]; headRevisionAfter: number }>('investigation.evidence.capture_and_attach', {
        caseId: input.caseId,
        ifCaseRevision: input.currentRevision,
        parentNodeId: input.draftNode.parentNodeId,
        kind: 'other',
        title: asString(payload.title) ?? input.draftNode.label,
        summary: asString(payload.summary) ?? undefined,
        provenance: asString(payload.provenance) ?? '',
        effectOnParent: asString(payload.effectOnParent) ?? (input.draftNode.parentKind === 'repair_attempt' ? 'validates' : 'supports'),
        interpretation: asString(payload.interpretation) ?? '',
        idempotencyKey: buildIdempotencyKey('draft-evidence-capture')
      });
    }
  }
}

export async function persistSavedNodeDraft(input: {
  caseId: string;
  currentRevision: number;
  node: GraphNodeRecord;
  draft: SavedNodeDraftState;
}) {
  switch (input.node.kind) {
    case 'problem':
      return invokeTool<{ headRevisionAfter: number }>('investigation.problem.update', {
        caseId: input.caseId,
        ifCaseRevision: input.currentRevision,
        problemId: input.node.id,
        idempotencyKey: `problem-update-${input.node.id}-${simpleHash(serializeSavedNodeDraft(input.node, input.draft))}`,
        title: input.draft.title.trim(),
        description: input.draft.description.trim(),
        environment: input.draft.environment.trim(),
        symptoms: splitLines(input.draft.symptoms),
        resolutionCriteria: splitLines(input.draft.resolutionCriteria)
      });
    case 'hypothesis':
      return invokeTool<{ headRevisionAfter: number }>('investigation.hypothesis.update', {
        caseId: input.caseId,
        ifCaseRevision: input.currentRevision,
        hypothesisId: input.node.id,
        idempotencyKey: buildIdempotencyKey('hypothesis-update'),
        title: input.draft.title.trim(),
        statement: input.draft.statement.trim(),
        falsificationCriteria: splitLines(input.draft.falsificationCriteria)
      });
    case 'blocker':
      return invokeTool<{ headRevisionAfter: number }>('investigation.blocker.update', {
        caseId: input.caseId,
        ifCaseRevision: input.currentRevision,
        blockerId: input.node.id,
        idempotencyKey: buildIdempotencyKey('blocker-update'),
        description: input.draft.description.trim(),
        possibleWorkarounds: splitLines(input.draft.possibleWorkarounds)
      });
    case 'repair_attempt':
      return invokeTool<{ headRevisionAfter: number }>('investigation.repair_attempt.update', {
        caseId: input.caseId,
        ifCaseRevision: input.currentRevision,
        repairAttemptId: input.node.id,
        idempotencyKey: buildIdempotencyKey('repair-update'),
        changeSummary: input.draft.changeSummary.trim(),
        scope: input.draft.scope.trim()
      });
    case 'evidence_ref':
      return invokeTool<{ headRevisionAfter: number }>('investigation.evidence_ref.update', {
        caseId: input.caseId,
        ifCaseRevision: input.currentRevision,
        evidenceRefId: input.node.id,
        idempotencyKey: buildIdempotencyKey('evidence-ref-update'),
        title: input.draft.title.trim(),
        summary: input.draft.summary.trim(),
        provenance: input.draft.provenance.trim(),
        effectOnParent: input.draft.effectOnParent.trim(),
        interpretation: input.draft.interpretation.trim()
      });
    default:
      return { headRevisionAfter: input.currentRevision };
  }
}

export async function persistStatusChange(input: {
  caseId: string;
  currentRevision: number;
  node: GraphNodeRecord;
  targetStatus: string;
  reason: string;
}) {
  const nextStatus = input.targetStatus;

  switch (input.node.kind) {
    case 'problem': {
      const result = await invokeTool<{ headRevisionAfter: number }>('investigation.problem.set_status', {
        caseId: input.caseId,
        ifCaseRevision: input.currentRevision,
        problemId: input.node.id,
        newStatus: nextStatus,
        reason: input.reason,
        idempotencyKey: buildIdempotencyKey('problem-status-update')
      });
      return result.headRevisionAfter;
    }
    case 'hypothesis': {
      let confirmToken: string | undefined;
      if (nextStatus === 'confirmed') {
        const confirmation = await requestConfirmIntent({
          commandName: 'investigation.hypothesis.set_status',
          caseId: input.caseId,
          targetIds: [input.node.id],
          rationale: input.reason
        });
        confirmToken = confirmation.confirmToken;
      }
      const result = await invokeTool<{ headRevisionAfter: number }>('investigation.hypothesis.set_status', {
        caseId: input.caseId,
        ifCaseRevision: input.currentRevision,
        hypothesisId: input.node.id,
        newStatus: nextStatus,
        reason: input.reason,
        ...(confirmToken ? { confirmToken } : {}),
        idempotencyKey: buildIdempotencyKey('hypothesis-status-update')
      });
      return result.headRevisionAfter;
    }
    case 'blocker': {
      const result = await invokeTool<{ headRevisionAfter: number }>('investigation.blocker.close', {
        caseId: input.caseId,
        ifCaseRevision: input.currentRevision,
        blockerId: input.node.id,
        reason: input.reason,
        idempotencyKey: buildIdempotencyKey('blocker-close')
      });
      return result.headRevisionAfter;
    }
    case 'repair_attempt': {
      const result = await invokeTool<{ headRevisionAfter: number }>('investigation.repair_attempt.set_status', {
        caseId: input.caseId,
        ifCaseRevision: input.currentRevision,
        repairAttemptId: input.node.id,
        newStatus: nextStatus,
        reason: input.reason,
        idempotencyKey: buildIdempotencyKey('repair-status-update')
      });
      return result.headRevisionAfter;
    }
    default:
      return input.currentRevision;
  }
}

export function getStatusOptions(kind: GraphNodeRecord['kind'], status: string | null): string[] {
  const current = status ?? defaultStatusForKind(kind);

  switch (kind) {
    case 'problem':
      return current === 'open'
        ? uniqueStatuses([current, 'resolved', 'abandoned'])
        : uniqueStatuses([current]);
    case 'hypothesis':
      return current === 'unverified' || current === 'proposed' || current === 'favored'
        ? uniqueStatuses([current, 'confirmed', 'blocked', 'rejected'])
        : uniqueStatuses([current]);
    case 'blocker':
      return current !== 'closed'
        ? uniqueStatuses([current, 'closed'])
        : uniqueStatuses([current]);
    case 'repair_attempt':
      if (current === 'proposed' || current === 'planned') {
        return uniqueStatuses([current, 'running', 'effective', 'ineffective']);
      }
      if (current === 'running') {
        return uniqueStatuses([current, 'effective', 'ineffective']);
      }
      return uniqueStatuses([current]);
    default:
      return uniqueStatuses([current]);
  }
}

export function defaultStatusForKind(kind: string) {
  switch (kind) {
    case 'problem':
      return 'open';
    case 'hypothesis':
      return 'unverified';
    case 'blocker':
      return 'active';
    case 'repair_attempt':
      return 'proposed';
    default:
      return 'stateless';
  }
}

export function createEmptySavedNodeDraft(): SavedNodeDraftState {
  return {
    changeSummary: '',
    description: '',
    effectOnParent: '',
    environment: '',
    falsificationCriteria: '',
    interpretation: '',
    possibleWorkarounds: '',
    provenance: '',
    resolutionCriteria: '',
    scope: '',
    statement: '',
    summary: '',
    symptoms: '',
    title: ''
  };
}

export function buildSavedNodeDraft(node: GraphNodeRecord): SavedNodeDraftState {
  const payload = asObject(node.payload);
  const evidence = asObject(payload.evidence);
  const emptyDraft = createEmptySavedNodeDraft();

  switch (node.kind) {
    case 'problem':
      return {
        ...emptyDraft,
        title: asString(payload.title) ?? node.label,
        description: asString(payload.description) ?? '',
        environment: asString(payload.environment) ?? '',
        symptoms: asStringArray(payload.symptoms).join('\n'),
        resolutionCriteria: asStringArray(payload.resolutionCriteria).join('\n')
      };
    case 'hypothesis':
      return {
        ...emptyDraft,
        title: asString(payload.title) ?? node.label,
        statement: asString(payload.statement) ?? '',
        falsificationCriteria: asStringArray(payload.falsificationCriteria).join('\n')
      };
    case 'blocker':
      return {
        ...emptyDraft,
        description: asString(payload.description) ?? node.label,
        possibleWorkarounds: asStringArray(payload.possibleWorkarounds).join('\n')
      };
    case 'repair_attempt':
      return {
        ...emptyDraft,
        changeSummary: asString(payload.changeSummary) ?? node.label,
        scope: asString(payload.scope) ?? ''
      };
    case 'evidence_ref':
      return {
        ...emptyDraft,
        title: asString(evidence.title) ?? node.label,
        summary: asString(evidence.summary) ?? '',
        provenance: asString(evidence.provenance) ?? '',
        effectOnParent: asString(payload.effectOnParent) ?? '',
        interpretation: asString(payload.interpretation) ?? ''
      };
    default:
      return emptyDraft;
  }
}

export function serializeSavedNodeDraft(node: GraphNodeRecord, draft: SavedNodeDraftState) {
  switch (node.kind) {
    case 'problem':
      return JSON.stringify({
        title: draft.title.trim(),
        description: draft.description.trim(),
        environment: draft.environment.trim(),
        symptoms: splitLines(draft.symptoms),
        resolutionCriteria: splitLines(draft.resolutionCriteria)
      });
    case 'hypothesis':
      return JSON.stringify({
        title: draft.title.trim(),
        statement: draft.statement.trim(),
        falsificationCriteria: splitLines(draft.falsificationCriteria)
      });
    case 'blocker':
      return JSON.stringify({
        description: draft.description.trim(),
        possibleWorkarounds: splitLines(draft.possibleWorkarounds)
      });
    case 'repair_attempt':
      return JSON.stringify({
        changeSummary: draft.changeSummary.trim(),
        scope: draft.scope.trim()
      });
    case 'evidence_ref':
      return JSON.stringify({
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        provenance: draft.provenance.trim(),
        effectOnParent: draft.effectOnParent.trim(),
        interpretation: draft.interpretation.trim()
      });
    default:
      return JSON.stringify({});
  }
}

export function requiresReason(kind: string | null, nextStatus: string) {
  return kind === 'problem'
    ? nextStatus === 'resolved' || nextStatus === 'abandoned'
    : kind === 'hypothesis'
      ? nextStatus === 'confirmed' || nextStatus === 'blocked' || nextStatus === 'rejected'
      : kind === 'blocker'
        ? nextStatus === 'closed'
        : kind === 'repair_attempt'
          ? nextStatus === 'running' || nextStatus === 'effective' || nextStatus === 'ineffective'
          : false;
}

export function draftNodeCanSave(draftNode: DraftNodeRecord) {
  const payload = asObject(draftNode.payload);
  switch (draftNode.kind) {
    case 'hypothesis':
      return (asString(payload.statement) ?? '').length > 0;
    case 'blocker':
      return (asString(payload.description) ?? '').length > 0;
    case 'repair_attempt':
      return (asString(payload.changeSummary) ?? '').length > 0;
    case 'evidence_ref':
      return ((asString(payload.evidenceId) ?? '').length > 0 && (asString(payload.interpretation) ?? '').length > 0)
        || ((asString(payload.title) ?? '').length > 0 && (asString(payload.provenance) ?? '').length > 0 && (asString(payload.interpretation) ?? '').length > 0);
  }
}

export function findCreatedNodeId(createdIds: string[], kind: DraftNodeRecord['kind']) {
  const prefix = kind === 'evidence_ref' ? 'evidence_ref_' : `${kind}_`;
  return createdIds.find((value) => value.startsWith(prefix)) ?? null;
}

export function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : [];
}

export function simpleHash(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function uniqueStatuses(statuses: string[]) {
  return [...new Set(statuses)];
}
