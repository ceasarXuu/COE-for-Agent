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

export interface ConsoleApiClientOptions {
  basePath?: string;
  fetchImpl?: typeof fetch;
  logScope?: string;
}

const SESSION_REFRESH_WINDOW_MS = 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

function withRevision(path: string, revision?: number | null): string {
  if (!revision) {
    return path;
  }

  const params = new URLSearchParams({ revision: String(revision) });
  return `${path}?${params.toString()}`;
}

export function createConsoleApiClient(options: ConsoleApiClientOptions = {}) {
  const basePath = options.basePath ?? '/api';
  const fetchImpl = options.fetchImpl ?? fetch;
  const logScope = options.logScope ?? '[investigation-console]';
  let cachedSession: SessionBundle | null = null;
  let inflightSession: Promise<SessionBundle> | null = null;

  async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);

    try {
      const response = await fetchImpl(path, {
        ...init,
        signal: controller.signal,
        headers: {
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers ?? {})
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const status = response.status;
        const statusText = response.statusText;
        console.error(`${logScope} request-failed`, {
          event: 'api.request_failed',
          path,
          status,
          statusText
        });
        throw new Error(`Request failed: ${status} ${statusText}`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${DEFAULT_FETCH_TIMEOUT_MS}ms`);
      }

      throw error;
    }
  }

  function sessionExpiresSoon(session: SessionBundle, now: number = Date.now()): boolean {
    return new Date(session.expiresAt).getTime() <= now + SESSION_REFRESH_WINDOW_MS;
  }

  async function fetchSession(reason: 'missing' | 'expired'): Promise<SessionBundle> {
    if (!inflightSession) {
      inflightSession = fetchJson<SessionBundle>(`${basePath}/session`)
        .then((session) => {
          cachedSession = session;
          console.info(`${logScope} session-refreshed`, {
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

  return {
    async listCases(query?: { search?: string }): Promise<CaseListEnvelope> {
      const params = new URLSearchParams();
      if (query?.search) {
        params.set('search', query.search);
      }

      return fetchJson<ResourceEnvelope<CaseListEnvelope>>(
        `${basePath}/cases${params.toString().length > 0 ? `?${params.toString()}` : ''}`
      ).then((result) => result.data);
    },

    async createCase(input: CreateCaseInput): Promise<CreateCaseResult> {
      const session = await ensureSession();

      return fetchJson<CreateCaseResult>(`${basePath}/cases`, {
        method: 'POST',
        headers: {
          'x-session-token': session.sessionToken
        },
        body: JSON.stringify(input)
      });
    },

    getCaseSnapshot(caseId: string, revision?: number | null): Promise<CaseSnapshotEnvelope> {
      return fetchJson<CaseSnapshotEnvelope>(
        withRevision(`${basePath}/cases/${encodeURIComponent(caseId)}/snapshot`, revision)
      );
    },

    getCaseTimeline(caseId: string, revision?: number | null): Promise<CaseTimelineEnvelope> {
      return fetchJson<CaseTimelineEnvelope>(
        withRevision(`${basePath}/cases/${encodeURIComponent(caseId)}/timeline`, revision)
      );
    },

    getCaseGraph(
      caseId: string,
      query: { revision?: number | null; focusId?: string; depth?: number } = {}
    ): Promise<CaseGraphEnvelope> {
      const params = new URLSearchParams();
      if (query.revision) {
        params.set('revision', String(query.revision));
      }
      if (query.focusId) {
        params.set('focusId', query.focusId);
      }
      if (query.depth) {
        params.set('depth', String(query.depth));
      }

      return fetchJson<CaseGraphEnvelope>(
        `${basePath}/cases/${encodeURIComponent(caseId)}/graph${params.toString().length > 0 ? `?${params.toString()}` : ''}`
      );
    },

    getCaseEvidencePool(caseId: string, revision?: number | null): Promise<CaseEvidencePoolEnvelope> {
      return fetchJson<CaseEvidencePoolEnvelope>(
        withRevision(`${basePath}/cases/${encodeURIComponent(caseId)}/evidence-pool`, revision)
      );
    },

    getCaseDiff(caseId: string, from: number, to: number): Promise<CaseDiffEnvelope> {
      return fetchJson<CaseDiffEnvelope>(`${basePath}/cases/${encodeURIComponent(caseId)}/diff?from=${from}&to=${to}`);
    },

    async invokeTool<T = unknown>(toolName: string, payload: Record<string, unknown>): Promise<T> {
      const session = await ensureSession();

      return fetchJson<T>(`${basePath}/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'x-session-token': session.sessionToken
        },
        body: JSON.stringify(payload)
      });
    },

    async requestConfirmIntent(input: {
      commandName: string;
      caseId: string;
      targetIds: string[];
      rationale: string;
    }): Promise<{ confirmToken: string; expiresAt: string }> {
      const session = await ensureSession();

      return fetchJson<{ confirmToken: string; expiresAt: string }>(`${basePath}/confirm-intent`, {
        method: 'POST',
        headers: {
          'x-session-token': session.sessionToken
        },
        body: JSON.stringify(input)
      });
    },

    resetSessionCache() {
      cachedSession = null;
      inflightSession = null;
    }
  };
}

const defaultClient = createConsoleApiClient();

export const listCases = defaultClient.listCases;
export const createCase = defaultClient.createCase;
export const getCaseSnapshot = defaultClient.getCaseSnapshot;
export const getCaseTimeline = defaultClient.getCaseTimeline;
export const getCaseGraph = defaultClient.getCaseGraph;
export const getCaseEvidencePool = defaultClient.getCaseEvidencePool;
export const getCaseDiff = defaultClient.getCaseDiff;
export const invokeTool = defaultClient.invokeTool;
export const requestConfirmIntent = defaultClient.requestConfirmIntent;
export const resetConsoleClientSessionCache = defaultClient.resetSessionCache;
