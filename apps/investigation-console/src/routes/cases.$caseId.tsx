import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Breadcrumb } from '../components/breadcrumb.js';
import { GraphCanvas } from '../components/graph/GraphCanvas.js';
import { CaseNodeEditor } from '../components/node-editor/CaseNodeEditor.js';
import {
  createDraftNode,
  patchDraftNode,
  type CreateDraftNodeRequest,
  type DraftNodeRecord
} from '../components/node-editor/case-node-drafts.js';
import { TimelineView } from '../components/timeline-view.js';
import { getCaseGraph, getCaseSnapshot, getCaseTimeline } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { connectConsoleStream } from '../lib/sse.js';
import { resetUIState, setRevision, setSelectedNodeId, useUIStore } from '../store/ui-store.js';

interface WorkspaceData {
  snapshot: Awaited<ReturnType<typeof getCaseSnapshot>>;
  timeline: Awaited<ReturnType<typeof getCaseTimeline>>;
  graph: Awaited<ReturnType<typeof getCaseGraph>>;
}

export function CaseWorkspaceRoute() {
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

    Promise.all([
      getCaseSnapshot(caseId, revision),
      getCaseTimeline(caseId, revision),
      getCaseGraph(caseId, { revision })
    ])
      .then(([snapshot, timeline, graph]) => ({ snapshot, timeline, graph }))
      .then((data) => {
        if (!cancelled) {
          startTransition(() => {
            setWorkspace(data);
          });
        }
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
    if (!workspace) {
      return;
    }

    const persistedNodeIds = new Set(workspace.graph.data.nodes.map((node) => node.id));
    let nextSelectedNodeId: string | null = null;

    setDraftNodes((currentDraftNodes) => currentDraftNodes.filter((draftNode) => {
      if (!draftNode.persistedNodeId || !persistedNodeIds.has(draftNode.persistedNodeId)) {
        return true;
      }

      if (selectedNodeId === draftNode.id) {
        nextSelectedNodeId = draftNode.persistedNodeId;
      }

      return false;
    }));

    if (nextSelectedNodeId) {
      setSelectedNodeId(nextSelectedNodeId);
    }
  }, [selectedNodeId, workspace]);

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
    <section className="workspace-shell">
      <header className="workspace-toolbar">
        <div className="workspace-header-copy">
          <Breadcrumb items={[
            { label: t('breadcrumb.cases'), href: `/cases${listSearch ? `?${listSearch}` : ''}` },
            { label: workspace?.snapshot.data.case?.title ?? caseId }
          ]} />
        </div>
      </header>

      {error ? <p className="inline-error">{error}</p> : null}

      {workspace ? (
        <div className="workspace-topbar">
          <TimelineView
            timeline={workspace.timeline}
            revisionControls={{
              currentRevision,
              maxRevision,
              onChange: (nextRevision) => {
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
              }
            }}
          />
        </div>
      ) : null}

      <div className="workspace-grid workspace-grid-editor">
        <section className="workspace-main workspace-main-graph">
          {loading && !workspace ? <section className="panel graph-stage workspace-stage-fill"><p>{t('workspace.replaying')}</p></section> : null}
          {workspace ? (
            <GraphCanvas
              draftNodes={draftNodes}
              graph={workspace.graph}
              selectedNodeId={selectedNodeId}
              snapshot={workspace.snapshot}
              onCreateDraftNode={handleCreateDraftNode}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            />
          ) : null}
        </section>

        <aside className="workspace-rail workspace-rail-editor">
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
    </section>
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
