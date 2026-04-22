import type { GraphNodeRecord } from '../api.js';

export type DraftNodeKind = 'hypothesis' | 'blocker' | 'repair_attempt' | 'evidence_ref';
export type DraftParentKind = 'problem' | 'hypothesis' | 'repair_attempt';
export type DraftSaveState = 'draft' | 'saving';

export interface DraftNodeRecord extends GraphNodeRecord {
  id: string;
  kind: DraftNodeKind;
  parentNodeId: string;
  parentKind: DraftParentKind;
  persistedNodeId: string | null;
  position: { x: number; y: number };
  revision: 0;
  status: DraftSaveState;
}

export interface CreateDraftNodeRequest {
  kind: DraftNodeKind;
  parentNodeId: string;
  parentKind: DraftParentKind;
  position: { x: number; y: number };
}

export type DraftNodePatch = Partial<Omit<DraftNodeRecord, 'kind' | 'parentKind' | 'parentNodeId' | 'position' | 'revision'>> & {
  payload?: Record<string, unknown>;
};

export function createDraftNode(input: {
  id: string;
  kind: DraftNodeKind;
  parentNodeId: string;
  parentKind: DraftParentKind;
  position: { x: number; y: number };
  defaultLabel: string;
}): DraftNodeRecord {
  return finalizeDraftNode({
    id: input.id,
    kind: input.kind,
    parentNodeId: input.parentNodeId,
    parentKind: input.parentKind,
    persistedNodeId: null,
    position: input.position,
    revision: 0,
    status: 'draft',
    label: input.defaultLabel,
    summary: null,
    payload: initialDraftPayload(input.kind, input.parentKind, input.defaultLabel)
  });
}

export function patchDraftNode(
  draftNode: DraftNodeRecord,
  patch: DraftNodePatch
): DraftNodeRecord {
  return finalizeDraftNode({
    ...draftNode,
    ...patch,
    payload: patch.payload ?? draftNode.payload
  });
}

export function buildDraftEdge(draftNode: DraftNodeRecord) {
  return {
    id: `draft-edge-${draftNode.id}`,
    source: draftNode.parentNodeId,
    target: draftNode.id,
    type: 'glowing' as const,
    data: { type: 'structural', transient: true }
  };
}

function initialDraftPayload(kind: DraftNodeKind, parentKind: DraftParentKind, defaultLabel: string): Record<string, unknown> {
  switch (kind) {
    case 'hypothesis':
      return {
        canonicalKind: 'hypothesis',
        statement: '',
        title: '',
        falsificationCriteria: [],
        parentNodeKind: parentKind
      };
    case 'blocker':
      return {
        canonicalKind: 'blocker',
        description: '',
        possibleWorkarounds: [],
        parentNodeKind: parentKind
      };
    case 'repair_attempt':
      return {
        canonicalKind: 'repair_attempt',
        changeSummary: '',
        scope: '',
        parentNodeKind: parentKind
      };
    case 'evidence_ref':
      return {
        canonicalKind: 'evidence_ref',
        evidenceId: '',
        title: defaultLabel,
        summary: '',
        provenance: '',
        interpretation: '',
        effectOnParent: parentKind === 'repair_attempt' ? 'validates' : 'supports',
        parentNodeKind: parentKind
      };
  }
}

function finalizeDraftNode(draftNode: DraftNodeRecord): DraftNodeRecord {
  const payload = asObject(draftNode.payload);

  switch (draftNode.kind) {
    case 'hypothesis': {
      const statement = asString(payload.statement);
      return {
        ...draftNode,
        label: statement ?? draftNode.label,
        summary: statement ?? null,
        payload
      };
    }
    case 'blocker': {
      const description = asString(payload.description);
      return {
        ...draftNode,
        label: description ?? draftNode.label,
        summary: description ?? null,
        payload
      };
    }
    case 'repair_attempt': {
      const changeSummary = asString(payload.changeSummary);
      return {
        ...draftNode,
        label: changeSummary ?? draftNode.label,
        summary: changeSummary ?? null,
        payload
      };
    }
    case 'evidence_ref': {
      const title = asString(payload.title);
      const interpretation = asString(payload.interpretation);
      const summary = asString(payload.summary);
      return {
        ...draftNode,
        label: title ?? draftNode.label,
        summary: interpretation ?? summary ?? null,
        payload
      };
    }
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
