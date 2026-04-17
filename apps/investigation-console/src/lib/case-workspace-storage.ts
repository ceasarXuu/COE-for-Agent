export interface ActionPanelNodeDraft {
  decisionRationale?: string;
  experimentExpectedOutcome?: string;
  experimentObjective?: string;
  experimentResultSummary?: string;
  gapQuestion?: string;
  gapResolution?: string;
  hypothesisRationale?: string;
  inquiryResolutionReason?: string;
  newHypothesisFalsification?: string;
  newHypothesisStatement?: string;
  residualRationale?: string;
  residualStatement?: string;
}

export interface ActionPanelDraftState {
  closureDecisionRationale: string;
  nodeDrafts: Record<string, ActionPanelNodeDraft>;
  stageRationale: string;
}

export interface GraphPositionOverride {
  x: number;
  y: number;
}

export interface GraphOverlayEdge {
  data?: Record<string, unknown>;
  id: string;
  source: string;
  target: string;
  type?: string;
}

export interface GraphOverlayState {
  manualEdges: GraphOverlayEdge[];
  positionOverrides: Record<string, GraphPositionOverride>;
}

const ACTION_PANEL_STORAGE_PREFIX = 'investigation-console.case-workspace.action-panel';
const GRAPH_OVERLAY_STORAGE_PREFIX = 'investigation-console.case-workspace.graph-overlay';

export function emptyActionPanelDraftState(): ActionPanelDraftState {
  return {
    closureDecisionRationale: '',
    nodeDrafts: {},
    stageRationale: ''
  };
}

export function emptyGraphOverlayState(): GraphOverlayState {
  return {
    manualEdges: [],
    positionOverrides: {}
  };
}

export function loadActionPanelDraftState(caseId: null | string | undefined): ActionPanelDraftState {
  return readWorkspaceValue(`${ACTION_PANEL_STORAGE_PREFIX}.${caseId ?? ''}`, emptyActionPanelDraftState());
}

export function persistActionPanelDraftState(caseId: null | string | undefined, drafts: ActionPanelDraftState) {
  writeWorkspaceValue(`${ACTION_PANEL_STORAGE_PREFIX}.${caseId ?? ''}`, drafts);
}

export function loadGraphOverlayState(caseId: null | string | undefined): GraphOverlayState {
  return readWorkspaceValue(`${GRAPH_OVERLAY_STORAGE_PREFIX}.${caseId ?? ''}`, emptyGraphOverlayState());
}

export function persistGraphOverlayState(caseId: null | string | undefined, overlay: GraphOverlayState) {
  writeWorkspaceValue(`${GRAPH_OVERLAY_STORAGE_PREFIX}.${caseId ?? ''}`, overlay);
}

function getWorkspaceStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readWorkspaceValue<T>(key: string, fallback: T): T {
  const storage = getWorkspaceStorage();
  if (!storage || key.length === 0) {
    return fallback;
  }

  try {
    const rawValue = storage.getItem(key);
    if (!rawValue) {
      return fallback;
    }

    return {
      ...fallback,
      ...JSON.parse(rawValue)
    };
  } catch {
    return fallback;
  }
}

function writeWorkspaceValue(key: string, value: unknown) {
  const storage = getWorkspaceStorage();
  if (!storage || key.length === 0) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}
