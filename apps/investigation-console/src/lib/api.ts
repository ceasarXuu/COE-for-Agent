export interface SessionBundle {
  sessionToken: string;
  actorContext: {
    actorType: string;
    actorId: string;
    sessionId: string;
    role: string;
    issuer: string;
    authMode: string;
  };
  expiresAt: string;
}

export interface CaseListItem {
  caseId: string;
  title?: string | null;
  summary?: string | null;
  severity?: string | null;
  status?: string | null;
  stage?: string | null;
  headRevision: number;
  updatedAt?: string;
}

export interface CaseListEnvelope {
  items: CaseListItem[];
}

export interface CreateCaseInput {
  idempotencyKey: string;
  title: string;
  objective: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  projectDirectory: string;
  labels?: string[];
}

export interface CreateCaseResult {
  ok: boolean;
  caseId: string | null;
  inquiryId: string | null;
  headRevisionAfter: number;
}

interface ResourceEnvelope<T> {
  headRevision: number;
  projectionRevision: number;
  requestedRevision: number | null;
  stale: boolean;
  historical: boolean;
  data: T;
}

export interface CaseSnapshotEnvelope {
  headRevision: number;
  projectionRevision: number;
  requestedRevision: number | null;
  stale: boolean;
  historical: boolean;
  data: {
    case: (Record<string, unknown> & {
      id: string;
      title?: string | null;
      severity?: string | null;
      status: string;
      stage: string;
      revision: number;
      objective?: string | null;
    }) | null;
    counts: {
      inquiries: number;
      symptoms: number;
      artifacts: number;
      facts: number;
    };
    warnings: string[];
  };
}

export interface CaseTimelineEnvelope {
  headRevision: number;
  projectionRevision: number;
  requestedRevision: number | null;
  stale: boolean;
  historical: boolean;
  data: {
    events: Array<{
      eventId: string;
      eventType: string;
      caseRevision: number;
      occurredAt: string;
      summary: string;
    }>;
  };
}

export interface GraphNodeRecord {
  id: string;
  kind: string;
  label: string;
  status: string | null;
  revision: number;
}

export interface CaseGraphEnvelope {
  headRevision: number;
  projectionRevision: number;
  requestedRevision: number | null;
  stale: boolean;
  historical: boolean;
  data: {
    focusId: string | null;
    nodes: GraphNodeRecord[];
    edges: Array<{
      key: string;
      type: string;
      fromId: string;
      toId: string;
    }>;
  };
}

export interface CaseCoverageEnvelope {
  headRevision: number;
  projectionRevision: number;
  requestedRevision: number | null;
  stale: boolean;
  historical: boolean;
  data: {
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
}

export interface CaseDiffEnvelope {
  headRevision: number;
  projectionRevision: number;
  requestedRevision: number | null;
  stale: boolean;
  historical: boolean;
  data: {
    fromRevision: number;
    toRevision: number;
    changedNodeIds: string[];
    changedEdgeKeys: string[];
    stateTransitions: Array<{
      nodeId: string;
      kind: string;
      fromStatus: string | null;
      toStatus: string | null;
    }>;
    summary: string[];
  };
}

export interface HypothesisPanelEnvelope {
  data: {
    hypothesis: Record<string, unknown> | null;
    supportingFacts: Array<Record<string, unknown>>;
    linkedExperiments?: Array<Record<string, unknown>>;
    relatedExperiments?: Array<Record<string, unknown>>;
    openGaps?: Array<Record<string, unknown>>;
    openResiduals?: Array<Record<string, unknown>>;
  };
}

export interface InquiryPanelEnvelope {
  data: {
    inquiry: Record<string, unknown> | null;
    hypotheses: Array<Record<string, unknown>>;
    experiments: Array<Record<string, unknown>>;
    gaps: Array<Record<string, unknown>>;
  };
}

export interface GuardrailBundle {
  aggregate: Record<string, unknown> & { kind: string };
  stall: Record<string, unknown> & { kind: string; stall?: boolean; reason?: string | null };
  readyToPatch: Record<string, unknown> & { pass?: boolean };
  closeCase: Record<string, unknown> & { pass?: boolean };
}

let cachedSession: Promise<SessionBundle> | null = null;

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

async function ensureSession(): Promise<SessionBundle> {
  cachedSession ??= fetchJson<SessionBundle>('/api/session');
  return cachedSession;
}

function withRevision(path: string, revision?: number | null): string {
  if (!revision) {
    return path;
  }

  const params = new URLSearchParams({ revision: String(revision) });
  return `${path}?${params.toString()}`;
}

export function listCases(query?: { search?: string }): Promise<CaseListEnvelope> {
  const params = new URLSearchParams();
  if (query?.search) {
    params.set('search', query.search);
  }

  return fetchJson<ResourceEnvelope<CaseListEnvelope>>(`/api/cases${params.toString().length > 0 ? `?${params.toString()}` : ''}`)
    .then((result) => result.data);
}

export async function createCase(input: CreateCaseInput): Promise<CreateCaseResult> {
  const session = await ensureSession();

  return fetchJson<CreateCaseResult>('/api/cases', {
    method: 'POST',
    headers: {
      'x-session-token': session.sessionToken
    },
    body: JSON.stringify(input)
  });
}

export function getCaseSnapshot(caseId: string, revision?: number | null): Promise<CaseSnapshotEnvelope> {
  return fetchJson<CaseSnapshotEnvelope>(withRevision(`/api/cases/${caseId}/snapshot`, revision));
}

export function getCaseTimeline(caseId: string, revision?: number | null): Promise<CaseTimelineEnvelope> {
  return fetchJson<CaseTimelineEnvelope>(withRevision(`/api/cases/${caseId}/timeline`, revision));
}

export function getCaseGraph(
  caseId: string,
  options: { revision?: number | null; focusId?: string; depth?: number } = {}
): Promise<CaseGraphEnvelope> {
  const params = new URLSearchParams();
  if (options.revision) {
    params.set('revision', String(options.revision));
  }
  if (options.focusId) {
    params.set('focusId', options.focusId);
  }
  if (options.depth) {
    params.set('depth', String(options.depth));
  }

  return fetchJson<CaseGraphEnvelope>(`/api/cases/${caseId}/graph${params.toString().length > 0 ? `?${params.toString()}` : ''}`);
}

export function getCaseCoverage(caseId: string, revision?: number | null): Promise<CaseCoverageEnvelope> {
  return fetchJson<CaseCoverageEnvelope>(withRevision(`/api/cases/${caseId}/coverage`, revision));
}

export function getCaseDiff(caseId: string, from: number, to: number): Promise<CaseDiffEnvelope> {
  return fetchJson<CaseDiffEnvelope>(`/api/cases/${caseId}/diff?from=${from}&to=${to}`);
}

export function getHypothesisPanel(caseId: string, hypothesisId: string, revision?: number | null): Promise<HypothesisPanelEnvelope> {
  return fetchJson<HypothesisPanelEnvelope>(withRevision(`/api/cases/${caseId}/hypotheses/${hypothesisId}`, revision));
}

export function getInquiryPanel(caseId: string, inquiryId: string, revision?: number | null): Promise<InquiryPanelEnvelope> {
  return fetchJson<InquiryPanelEnvelope>(withRevision(`/api/cases/${caseId}/inquiries/${inquiryId}`, revision));
}

export async function getGuardrails(caseId: string, revision?: number | null): Promise<GuardrailBundle> {
  const revisionPayload = revision ? { atRevision: revision } : {};

  const [aggregate, stall, readyToPatch, closeCase] = await Promise.all([
    invokeTool<Record<string, unknown>>('investigation.guardrail.check', { caseId, ...revisionPayload }),
    invokeTool<Record<string, unknown>>('investigation.guardrail.stall_check', { caseId, ...revisionPayload }),
    invokeTool<Record<string, unknown>>('investigation.guardrail.ready_to_patch_check', { caseId, ...revisionPayload }),
    invokeTool<Record<string, unknown>>('investigation.guardrail.close_case_check', { caseId, ...revisionPayload })
  ]);

  return {
    aggregate: aggregate as GuardrailBundle['aggregate'],
    stall: stall as GuardrailBundle['stall'],
    readyToPatch: readyToPatch as GuardrailBundle['readyToPatch'],
    closeCase: closeCase as GuardrailBundle['closeCase']
  };
}

export async function invokeTool<T = unknown>(toolName: string, payload: Record<string, unknown>): Promise<T> {
  const session = await ensureSession();

  return fetchJson<T>(`/api/tools/${toolName}`, {
    method: 'POST',
    headers: {
      'x-session-token': session.sessionToken
    },
    body: JSON.stringify(payload)
  });
}

export async function requestConfirmIntent(input: {
  commandName: string;
  caseId: string;
  targetIds: string[];
  rationale: string;
}): Promise<{ confirmToken: string; expiresAt: string }> {
  const session = await ensureSession();

  return fetchJson<{ confirmToken: string; expiresAt: string }>('/api/confirm-intent', {
    method: 'POST',
    headers: {
      'x-session-token': session.sessionToken
    },
    body: JSON.stringify(input)
  });
}
