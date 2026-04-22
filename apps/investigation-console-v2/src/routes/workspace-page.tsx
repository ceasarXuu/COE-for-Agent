import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@coe/ui/components/alert';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@coe/ui/components/breadcrumb';
import { Card, CardContent } from '@coe/ui/components/card';
import { Skeleton } from '@coe/ui/components/skeleton';

import { GraphCanvas } from '@/components/workspace/graph/graph-canvas.js';
import { CaseNodeEditor } from '@/components/workspace/node-editor.js';
import { WorkspaceTimeline } from '@/components/workspace/workspace-timeline.js';
import {
  getCaseGraph,
  getCaseSnapshot,
  getCaseTimeline
} from '@/lib/api.js';
import { useI18n } from '@/lib/i18n.js';
import { connectConsoleStream } from '@/lib/sse.js';
import {
  createDraftNode,
  patchDraftNode,
  type CreateDraftNodeRequest,
  type DraftNodeRecord
} from '@/lib/workspace/case-node-drafts.js';
import { reconcilePersistedDraftSelection } from '@/lib/workspace/case-workspace-draft-reconciliation.js';
import {
  resetUIState,
  setRevision,
  setSelectedNodeId,
  useUIStore
} from '@/lib/ui-store.js';

interface WorkspaceData {
  snapshot: Awaited<ReturnType<typeof getCaseSnapshot>>;
  timeline: Awaited<ReturnType<typeof getCaseTimeline>>;
  graph: Awaited<ReturnType<typeof getCaseGraph>>;
}

export function WorkspacePage() {
  const { t } = useI18n();
  const params = useParams();
  const caseId = params.caseId ?? '';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [draftNodes, setDraftNodes] = useState<DraftNodeRecord[]>([]);
  const revision = useMemo(() => {
    const rawValue = searchParams.get('revision');
    if (!rawValue) {
      return null;
    }

    const parsed = Number(rawValue);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);
  const selectedNodeId = useUIStore((state) => state.selectedNodeId);
  const requestRefresh = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    setRevision(revision);
  }, [revision]);

  useEffect(() => {
    resetUIState();
    setDraftNodes([]);
  }, [caseId, revision]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([
      getCaseSnapshot(caseId, revision),
      getCaseTimeline(caseId, revision),
      getCaseGraph(caseId, { revision })
    ])
      .then(([snapshot, timeline, graph]) => ({ snapshot, timeline, graph }))
      .then((data) => {
        if (cancelled) {
          return;
        }

        console.info('[investigation-console-v2] workspace-loaded', {
          event: 'workspace.loaded',
          caseId,
          revision: data.snapshot.requestedRevision ?? data.snapshot.headRevision,
          nodeCount: data.graph.data.nodes.length
        });

        startTransition(() => {
          setWorkspace(data);
        });
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : t('errors.loadWorkspace'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [caseId, refreshNonce, revision, t]);

  useEffect(() => {
    if (revision !== null) {
      return;
    }

    return connectConsoleStream({
      onHeadRevisionChanged: (event) => {
        if (event.caseId === caseId) {
          requestRefresh();
        }
      },
      onProjectionUpdated: (event) => {
        if (event.caseId === caseId) {
          requestRefresh();
        }
      }
    });
  }, [caseId, requestRefresh, revision]);

  useEffect(() => {
    if (!workspace || draftNodes.length === 0) {
      return;
    }

    const persistedNodeIds = new Set(workspace.graph.data.nodes.map((node) => node.id));
    const reconciliation = reconcilePersistedDraftSelection({
      draftNodes,
      persistedNodeIds,
      selectedNodeId
    });

    if (reconciliation.draftNodes.length !== draftNodes.length) {
      setDraftNodes(reconciliation.draftNodes);
    }

    if (reconciliation.nextSelectedNodeId) {
      setSelectedNodeId(reconciliation.nextSelectedNodeId);
    }
  }, [draftNodes, selectedNodeId, workspace]);

  const maxRevision = workspace?.snapshot.headRevision ?? 1;
  const currentRevision = revision ?? maxRevision;
  const historical = revision !== null;
  const listSearchParams = new URLSearchParams(searchParams);
  listSearchParams.delete('revision');
  const listSearch = listSearchParams.toString();

  const selectedDraftNode = draftNodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedNode = !selectedDraftNode && workspace && selectedNodeId
    ? workspace.graph.data.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;

  const handleCreateDraftNode = useCallback((request: CreateDraftNodeRequest) => {
    const draftNode = createDraftNode({
      id: createDraftNodeId(),
      kind: request.kind,
      parentNodeId: request.parentNodeId,
      parentKind: request.parentKind,
      position: request.position,
      defaultLabel: defaultDraftLabel(request.kind, t)
    });

    setDraftNodes((currentDraftNodes) => [...currentDraftNodes, draftNode]);
    setSelectedNodeId(draftNode.id);
  }, [t]);

  const handlePatchDraftNode = useCallback((draftNodeId: string, patch: Parameters<typeof patchDraftNode>[1]) => {
    setDraftNodes((currentDraftNodes) => currentDraftNodes.map((draftNode) => (
      draftNode.id === draftNodeId ? patchDraftNode(draftNode, patch) : draftNode
    )));
  }, []);

  const handleDiscardDraftNode = useCallback((draftNodeId: string) => {
    setDraftNodes((currentDraftNodes) => currentDraftNodes.filter((draftNode) => draftNode.id !== draftNodeId));
    if (selectedNodeId === draftNodeId) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId]);

  async function handleMutationComplete() {
    requestRefresh();
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="flex flex-col gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/cases${listSearch ? `?${listSearch}` : ''}`}>{t('breadcrumb.cases')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{workspace?.snapshot.data.case?.title ?? caseId}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {workspace ? (
          <WorkspaceTimeline
            currentRevision={currentRevision}
            maxRevision={maxRevision}
            onChange={(nextRevision) => {
              const nextParams = new URLSearchParams(searchParams);
              if (nextRevision >= maxRevision) {
                nextParams.delete('revision');
              } else {
                nextParams.set('revision', String(nextRevision));
              }

              startTransition(() => {
                navigate({
                  pathname: `/cases/${caseId}`,
                  search: nextParams.toString() ? `?${nextParams.toString()}` : ''
                });
              });
            }}
          />
        ) : (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        )}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t('errors.loadWorkspace')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border/80 bg-card/70 shadow-sm">
        {loading && !workspace ? (
          <div className="grid min-h-[640px] gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="border-b border-border/70 p-4 md:p-5 lg:border-b-0 lg:border-r">
              <Skeleton className="h-[620px] w-full rounded-xl" />
            </div>
            <div className="p-4 md:p-5">
              <Skeleton className="h-[620px] w-full rounded-xl" />
            </div>
          </div>
        ) : workspace ? (
          <div className="grid min-h-[640px] gap-0 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 border-b border-border/70 bg-background/10 p-4 md:p-5 lg:border-b-0 lg:border-r">
              <GraphCanvas
                draftNodes={draftNodes}
                graph={workspace.graph}
                selectedNodeId={selectedNodeId}
                snapshot={workspace.snapshot}
                onCreateDraftNode={handleCreateDraftNode}
                onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
              />
            </div>

            <aside className="min-w-0 bg-card/50 p-4 md:p-5">
              <CaseNodeEditor
                caseId={caseId}
                currentRevision={currentRevision}
                historical={historical}
                selectedDraftNode={selectedDraftNode}
                selectedNode={selectedNode}
                onDiscardDraftNode={handleDiscardDraftNode}
                onMutationComplete={handleMutationComplete}
                onPatchDraftNode={handlePatchDraftNode}
              />
            </aside>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function createDraftNodeId() {
  return `draft_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultDraftLabel(kind: CreateDraftNodeRequest['kind'], t: (key: string) => string) {
  switch (kind) {
    case 'hypothesis':
      return t('canonical.create.hypothesis');
    case 'blocker':
      return t('canonical.create.blocker');
    case 'repair_attempt':
      return t('canonical.create.changeSummary');
    case 'evidence_ref':
      return t('canonical.create.evidenceTitle');
  }
}
