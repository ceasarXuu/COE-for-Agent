import { startTransition, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { asNonEmptyString, asObjectRecord, uniqueStrings } from '@coe/shared-utils';

import { ActionPanel } from '../components/action-panel/index.js';
import { CanonicalActionPanel } from '../components/action-panel/CanonicalActionPanel.js';
import { Breadcrumb } from '../components/breadcrumb.js';
import { GraphCanvas } from '../components/graph/GraphCanvas.js';
import { GuardrailView } from '../components/guardrail-view.js';
import { InspectorPanel, type InspectorViewModel } from '../components/inspector-panel.js';
import { TimelineView } from '../components/timeline-view.js';
import { connectConsoleStream } from '../lib/sse.js';
import {
  getCaseGraph,
  getGuardrails,
  getHypothesisPanel,
  getInquiryPanel,
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
  const { formatEnumLabel, t } = useI18n();
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
    const isCanonicalGraph = workspace.graph.data.nodes.some((node) => node.kind === 'problem');
    setInspectorLoading(true);

    const loadInspector = async () => {
      if (isCanonicalGraph && graphNode) {
        return buildGraphBackedInspector(graphNode, workspace);
      }

      if (selectedNodeId.startsWith('hypothesis_')) {
        const panel = await getHypothesisPanel(caseId, selectedNodeId, revision);
        const hypothesis = asObjectRecord(panel.data.hypothesis);
        return {
          kind: 'hypothesis',
          title: asNonEmptyString(hypothesis.title) ?? selectedNodeId,
          status: asNonEmptyString(hypothesis.status),
          summary: asNonEmptyString(hypothesis.statement) ?? t('workspace.hypothesisFallback'),
          primaryItems: panel.data.supportingFacts.map((fact) => asNonEmptyString(asObjectRecord(fact).statement) ?? formatEnumLabel('fact')),
          secondaryItems: (panel.data.linkedExperiments ?? [])
            .map((experiment) => asNonEmptyString(asObjectRecord(experiment).title) ?? formatEnumLabel('experiment'))
        } satisfies InspectorViewModel;
      }

      if (selectedNodeId.startsWith('inquiry_')) {
        const panel = await getInquiryPanel(caseId, selectedNodeId, revision);
        const inquiry = asObjectRecord(panel.data.inquiry);
        return {
          kind: 'inquiry',
          title: asNonEmptyString(inquiry.title) ?? selectedNodeId,
          status: asNonEmptyString(inquiry.status),
          summary: asNonEmptyString(inquiry.question) ?? t('workspace.inquiryFallback'),
          primaryItems: panel.data.hypotheses.map((hypothesis) => asNonEmptyString(asObjectRecord(hypothesis).title) ?? formatEnumLabel('hypothesis')),
          secondaryItems: panel.data.experiments.map((experiment) => asNonEmptyString(asObjectRecord(experiment).title) ?? formatEnumLabel('experiment'))
        } satisfies InspectorViewModel;
      }

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
  }, [caseId, formatEnumLabel, revision, selectedNodeId, t, workspace]);

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
  const isCanonicalGraph = workspace?.graph.data.nodes.some((node) => node.kind === 'problem') ?? false;

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
        kind: 'node',
        title: node.label,
        status: node.status,
        summary: node.summary ?? '',
        primaryItems: collectRelatedNodes(node.id, workspace.graph.data.nodes, workspace.graph.data.edges)
          .filter((relatedNode) => relatedNode.kind === 'hypothesis')
          .map((relatedNode) => relatedNode.label),
        secondaryItems: []
      };
    case 'blocker':
    case 'repair_attempt':
    case 'evidence_ref':
      return {
        kind: 'node',
        title: node.label,
        status: node.status,
        summary: node.summary ?? '',
        primaryItems: relatedNodes.map((relatedNode) => relatedNode.label),
        secondaryItems: []
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
