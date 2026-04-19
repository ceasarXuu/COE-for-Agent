import { startTransition, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { asObjectRecord, uniqueStrings } from '@coe/shared-utils';

import { ActionPanel } from '../components/action-panel/index.js';
import { CanonicalActionPanel } from '../components/action-panel/CanonicalActionPanel.js';
import { Breadcrumb } from '../components/breadcrumb.js';
import { GraphCanvas } from '../components/graph/GraphCanvas.js';
import { isCanonicalGraphProjection } from '../components/graph/isCanonicalGraphProjection.js';
import { GuardrailView } from '../components/guardrail-view.js';
import { InspectorPanel, type InspectorViewModel } from '../components/inspector-panel.js';
import { TimelineView } from '../components/timeline-view.js';
import { connectConsoleStream } from '../lib/sse.js';
import {
  getCaseGraph,
  getGuardrails,
  getCaseSnapshot,
  getCaseTimeline,
  type GraphNodeRecord,
  type CaseGraphEnvelope,
  type GuardrailBundle,
  type CaseSnapshotEnvelope,
  type CaseTimelineEnvelope
} from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { resetUIState, setRevision, setSelectedNodeId, useUIStore } from '../store/ui-store.js';

interface WorkspaceData {
  snapshot: CaseSnapshotEnvelope;
  timeline: CaseTimelineEnvelope;
  graph: CaseGraphEnvelope;
  guardrails: GuardrailBundle;
}

export function CaseWorkspaceRoute() {
  const { t } = useI18n();
  const params = useParams();
  const caseId = params.caseId ?? '';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [inspector, setInspector] = useState<InspectorViewModel | null>(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const revision = useMemo(() => {
    const rawValue = searchParams.get('revision');
    if (!rawValue) {
      return null;
    }

    const parsed = Number(rawValue);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);
  const selectedNodeId = useUIStore((state) => state.selectedNodeId);
  const requestRefresh = useEffectEvent(() => {
    setRefreshNonce((value) => value + 1);
  });

  useEffect(() => {
    setRevision(revision);
  }, [revision]);

  useEffect(() => {
    resetUIState();
  }, [caseId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getCaseSnapshot(caseId, revision),
      getCaseTimeline(caseId, revision),
      getCaseGraph(caseId, { revision }),
      getGuardrails(caseId, revision)
    ])
      .then(([snapshot, timeline, graph, guardrails]) => ({ snapshot, timeline, graph, guardrails }))
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
    if (!workspace || !selectedNodeId) {
      setInspector(null);
      setInspectorLoading(false);
      return;
    }

    let cancelled = false;
    const graphNode = workspace.graph.data.nodes.find((node) => node.id === selectedNodeId) ?? null;
    setInspectorLoading(true);

    const loadInspector = async () => {
      if (graphNode) {
        return buildGraphBackedInspector(graphNode, workspace);
      }

      return {
        kind: 'node',
        title: selectedNodeId,
        status: null,
        summary: t('workspace.outsideSlice'),
        primaryItems: [],
        secondaryItems: []
      } satisfies InspectorViewModel;
    };

    loadInspector()
      .then((data) => {
        if (!cancelled) {
          setInspector(data);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setInspector({
            kind: 'node',
            title: graphNode?.label ?? selectedNodeId,
            status: graphNode?.status ?? null,
            summary: reason instanceof Error ? reason.message : t('errors.loadInspector'),
            primaryItems: [],
            secondaryItems: []
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInspectorLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [caseId, selectedNodeId, t, workspace]);

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

  const maxRevision = workspace?.snapshot.headRevision ?? 1;
  const currentRevision = revision ?? maxRevision;
  const historical = revision !== null;
  const listSearchParams = new URLSearchParams(searchParams);
  listSearchParams.delete('revision');
  const listSearch = listSearchParams.toString();
  const selectedNode = workspace && selectedNodeId
    ? workspace.graph.data.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const isCanonicalGraph = workspace ? isCanonicalGraphProjection(workspace.graph) : false;

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

      <div className="workspace-grid">
        <section className="workspace-main">
          {loading && !workspace ? <section className="panel graph-stage workspace-stage-fill"><p>{t('workspace.replaying')}</p></section> : null}
          {workspace ? (
            <GraphCanvas
              snapshot={workspace.snapshot}
              graph={workspace.graph}
              onMutationComplete={handleMutationComplete}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            />
          ) : null}
        </section>

        <aside className="workspace-rail workspace-rail-side">
          <InspectorPanel inspector={inspector} loading={inspectorLoading} />
          {workspace && !isCanonicalGraph ? (
            <ActionPanel
              caseId={caseId}
              caseStage={workspace.snapshot.data.case?.stage ?? null}
              defaultInquiryId={typeof workspace.snapshot.data.case?.defaultInquiryId === 'string'
                ? workspace.snapshot.data.case.defaultInquiryId
                : null}
              currentRevision={currentRevision}
              guardrails={workspace.guardrails}
              historical={historical}
              onMutationComplete={handleMutationComplete}
              selectedNode={selectedNode}
            />
          ) : null}
          {workspace && isCanonicalGraph ? (
            <CanonicalActionPanel
              caseId={caseId}
              currentRevision={currentRevision}
              historical={historical}
              onMutationComplete={handleMutationComplete}
              selectedNode={selectedNode}
            />
          ) : null}
          {workspace && !isCanonicalGraph ? <GuardrailView guardrails={workspace.guardrails} /> : null}
          {workspace ? (
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
          ) : null}
        </aside>

      </div>
    </section>
  );
}

function buildGraphBackedInspector(
  node: GraphNodeRecord,
  workspace: WorkspaceData
): InspectorViewModel {
  const relatedNodes = collectRelatedNodes(node.id, workspace.graph.data.nodes, workspace.graph.data.edges);

  switch (node.kind) {
    case 'problem':
      return {
        kind: 'problem',
        title: node.label,
        status: node.status,
        summary: node.summary ?? '',
        primaryItems: collectRelatedNodes(node.id, workspace.graph.data.nodes, workspace.graph.data.edges)
          .filter((relatedNode) => relatedNode.kind === 'hypothesis')
          .map((relatedNode) => relatedNode.label),
        secondaryItems: [
          ...(typeof node.payload?.environment === 'string' && node.payload.environment.length > 0
            ? [node.payload.environment]
            : []),
          ...(Array.isArray(node.payload?.symptoms)
            ? node.payload.symptoms.filter((item): item is string => typeof item === 'string' && item.length > 0)
            : [])
        ]
      };
    case 'blocker':
      return {
        kind: 'blocker',
        title: node.label,
        status: node.status,
        summary: node.summary ?? '',
        primaryItems: relatedNodes.map((relatedNode) => relatedNode.label),
        secondaryItems: Array.isArray(node.payload?.possibleWorkarounds)
          ? node.payload.possibleWorkarounds.filter((item): item is string => typeof item === 'string' && item.length > 0)
          : []
      };
    case 'hypothesis':
      return {
        kind: 'hypothesis',
        title: node.label,
        status: node.status,
        summary: node.summary ?? '',
        primaryItems: relatedNodes
          .filter((relatedNode) => relatedNode.kind === 'fact' || relatedNode.kind === 'evidence_ref')
          .map((relatedNode) => relatedNode.label),
        secondaryItems: relatedNodes
          .filter((relatedNode) => relatedNode.kind !== 'fact' && relatedNode.kind !== 'evidence_ref')
          .map((relatedNode) => relatedNode.label)
      };
    case 'repair_attempt':
      return {
        kind: 'repair_attempt',
        title: node.label,
        status: node.status,
        summary: node.summary ?? '',
        primaryItems: relatedNodes.filter((relatedNode) => relatedNode.kind === 'evidence_ref').map((relatedNode) => relatedNode.label),
        secondaryItems: relatedNodes.filter((relatedNode) => relatedNode.kind === 'repair_attempt').map((relatedNode) => relatedNode.label)
      };
    case 'evidence_ref':
      const evidencePayload = asObjectRecord(node.payload?.evidence);
      return {
        kind: 'evidence_ref',
        title: node.label,
        status: node.status,
        summary: node.summary ?? '',
        primaryItems: [
          ...(typeof evidencePayload.provenance === 'string' ? [evidencePayload.provenance] : []),
          ...(typeof evidencePayload.summary === 'string' ? [evidencePayload.summary] : [])
        ],
        secondaryItems: [
          ...(typeof node.payload?.effectOnParent === 'string' ? [node.payload.effectOnParent] : []),
          ...relatedNodes.map((relatedNode) => relatedNode.label)
        ]
      };
    case 'experiment':
      return {
        kind: 'experiment',
        title: node.label,
        status: node.status,
        summary: '',
        primaryItems: relatedNodes.filter((relatedNode) => relatedNode.kind === 'hypothesis').map((relatedNode) => relatedNode.label),
        secondaryItems: relatedNodes.filter((relatedNode) => relatedNode.kind !== 'hypothesis').map((relatedNode) => relatedNode.label)
      };
    case 'decision':
      return {
        kind: 'decision',
        title: node.label,
        status: node.status,
        summary: '',
        primaryItems: relatedNodes.map((relatedNode) => relatedNode.label),
        secondaryItems: []
      };
    case 'gap':
      return {
        kind: 'gap',
        title: node.label,
        status: node.status,
        summary: '',
        primaryItems: relatedNodes.map((relatedNode) => relatedNode.label),
        secondaryItems: []
      };
    case 'residual':
      return {
        kind: 'residual',
        title: node.label,
        status: node.status,
        summary: '',
        primaryItems: relatedNodes.map((relatedNode) => relatedNode.label),
        secondaryItems: []
      };
    case 'fact':
      return {
        kind: 'fact',
        title: node.label,
        status: node.status,
        summary: '',
        primaryItems: relatedNodes.map((relatedNode) => relatedNode.label),
        secondaryItems: []
      };
    default:
      return {
        kind: 'node',
        title: node.label,
        status: node.status,
        summary: '',
        primaryItems: relatedNodes.map((relatedNode) => relatedNode.label),
        secondaryItems: []
      };
  }
}

function collectRelatedNodes(
  nodeId: string,
  nodes: GraphNodeRecord[],
  edges: Array<{ fromId: string; toId: string }>
): GraphNodeRecord[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const relatedIds = edges
    .filter((edge) => edge.fromId === nodeId || edge.toId === nodeId)
    .map((edge) => edge.fromId === nodeId ? edge.toId : edge.fromId);

  return uniqueStrings(relatedIds)
    .map((relatedId) => nodeById.get(relatedId) ?? null)
    .filter((node): node is GraphNodeRecord => node !== null);
}
