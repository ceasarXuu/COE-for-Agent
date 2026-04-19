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
  problemId?: string | null;
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
      problems: number;
      hypotheses: number;
      blockers: number;
      repairAttempts: number;
      evidenceRefs: number;
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
      editorOrigin?: 'agent' | 'web_ui';
      summary: string;
    }>;
  };
}

export interface GraphNodeRecord {
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

export interface CaseGraphEnvelope {
  headRevision: number;
  projectionRevision: number;
  requestedRevision: number | null;
  stale: boolean;
  historical: boolean;
  data: {
    focusId: string | null;
    projectionModel?: 'legacy' | 'canonical';
    nodes: GraphNodeRecord[];
    edges: Array<{
      key: string;
      type: string;
      fromId: string;
      toId: string;
    }>;
  };
}

export interface CaseEvidencePoolEnvelope {
  headRevision: number;
  projectionRevision: number;
  requestedRevision: number | null;
  stale: boolean;
  historical: boolean;
  data: {
    items: Array<{
      evidenceId: string;
      kind: string;
      title: string;
      summary: string | null;
      provenance: string | null;
      confidence: number | null;
      revision: number;
    }>;
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

const SESSION_REFRESH_WINDOW_MS = 60 * 1000;

let cachedSession: SessionBundle | null = null;
let inflightSession: Promise<SessionBundle> | null = null;

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

function sessionExpiresSoon(session: SessionBundle, now: number = Date.now()): boolean {
  return new Date(session.expiresAt).getTime() <= now + SESSION_REFRESH_WINDOW_MS;
}

async function fetchSession(reason: 'missing' | 'expired'): Promise<SessionBundle> {
  if (!inflightSession) {
    inflightSession = fetchJson<SessionBundle>('/api/session')
      .then((session) => {
        cachedSession = session;
        console.info('[investigation-console] session-refreshed', {
          event: 'session.refreshed',
          reason,
          sessionId: session.actorContext.sessionId,
          expiresAt: session.expiresAt
        });
        return session;
      })
      .finally(() => {
        inflightSession = null;
      });
  }

  return inflightSession;
}

async function ensureSession(): Promise<SessionBundle> {
  if (cachedSession && !sessionExpiresSoon(cachedSession)) {
    return cachedSession;
  }

  return fetchSession(cachedSession ? 'expired' : 'missing');
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
  return fetchJson<CaseSnapshotEnvelope>(withRevision(`/api/cases/${encodeURIComponent(caseId)}/snapshot`, revision));
}

export function getCaseTimeline(caseId: string, revision?: number | null): Promise<CaseTimelineEnvelope> {
  return fetchJson<CaseTimelineEnvelope>(withRevision(`/api/cases/${encodeURIComponent(caseId)}/timeline`, revision));
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

  return fetchJson<CaseGraphEnvelope>(`/api/cases/${encodeURIComponent(caseId)}/graph${params.toString().length > 0 ? `?${params.toString()}` : ''}`);
}

export function getCaseEvidencePool(caseId: string, revision?: number | null): Promise<CaseEvidencePoolEnvelope> {
  return fetchJson<CaseEvidencePoolEnvelope>(withRevision(`/api/cases/${encodeURIComponent(caseId)}/evidence-pool`, revision));
}

export function getCaseDiff(caseId: string, from: number, to: number): Promise<CaseDiffEnvelope> {
  return fetchJson<CaseDiffEnvelope>(`/api/cases/${encodeURIComponent(caseId)}/diff?from=${from}&to=${to}`);
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
