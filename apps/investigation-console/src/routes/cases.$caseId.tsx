import { startTransition, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { asNonEmptyString, asObjectRecord, uniqueStrings } from '@coe/shared-utils';

import { ActionPanel } from '../components/action-panel.js';
import { CoverageView } from '../components/coverage-view.js';
import { GraphCanvas } from '../components/graph/GraphCanvas.js';
import { GuardrailView } from '../components/guardrail-view.js';
import { InspectorPanel, type InspectorViewModel } from '../components/inspector-panel.js';
import { RevisionSlider } from '../components/revision-slider.js';
import { SnapshotView } from '../components/snapshot-view.js';
import { TimelineView } from '../components/timeline-view.js';
import { connectConsoleStream } from '../lib/sse.js';
import {
  getCaseCoverage,
  getCaseDiff,
  getCaseGraph,
  getHypothesisPanel,
  getInquiryPanel,
  getCaseSnapshot,
  getCaseTimeline,
  getGuardrails,
  type GraphNodeRecord,
  type CaseCoverageEnvelope,
  type CaseDiffEnvelope,
  type CaseGraphEnvelope,
  type CaseSnapshotEnvelope,
  type CaseTimelineEnvelope,
  type GuardrailBundle
} from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { resetUIState, setRevision, setSelectedNodeId, useUIStore } from '../store/ui-store.js';

interface WorkspaceData {
  snapshot: CaseSnapshotEnvelope;
  timeline: CaseTimelineEnvelope;
  graph: CaseGraphEnvelope;
  coverage: CaseCoverageEnvelope;
  diff: CaseDiffEnvelope | null;
  guardrails: GuardrailBundle;
}

type Translator = ReturnType<typeof useI18n>['t'];
type EnumFormatter = ReturnType<typeof useI18n>['formatEnumLabel'];

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
      getCaseGraph(caseId, selectedNodeId ? { revision, focusId: selectedNodeId } : { revision }),
      getCaseCoverage(caseId, revision),
      getGuardrails(caseId, revision)
    ])
      .then(([snapshot, timeline, graph, coverage, guardrails]) => {
        const diff = revision ? getCaseDiff(caseId, Math.max(revision - 1, 0), revision) : Promise.resolve(null);
        return diff.then((resolvedDiff) => ({ snapshot, timeline, graph, coverage, guardrails, diff: resolvedDiff }));
      })
      .then((data) => {
        if (!cancelled) {
          startTransition(() => {
            setWorkspace(data);
          });

          if (selectedNodeId && !data.graph.data.nodes.some((node) => node.id === selectedNodeId)) {
            setSelectedNodeId(null);
          }
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
  }, [caseId, refreshNonce, revision, selectedNodeId]);

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
            .map((experiment) => asNonEmptyString(asObjectRecord(experiment).title) ?? formatEnumLabel('experiment')),
          details: {
            supportingFactIds: panel.data.supportingFacts
              .map((fact) => asNonEmptyString(asObjectRecord(fact).id))
              .filter((value): value is string => Boolean(value)),
            linkedExperimentIds: (panel.data.linkedExperiments ?? [])
              .map((experiment) => asNonEmptyString(asObjectRecord(experiment).id))
              .filter((value): value is string => Boolean(value))
          }
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
          secondaryItems: panel.data.experiments.map((experiment) => asNonEmptyString(asObjectRecord(experiment).title) ?? formatEnumLabel('experiment')),
          details: {
            inquiryId: asNonEmptyString(inquiry.id) ?? selectedNodeId
          }
        } satisfies InspectorViewModel;
      }

      if (graphNode) {
        return buildGraphBackedInspector(graphNode, workspace, t, formatEnumLabel);
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
  const selectedNode = workspace && selectedNodeId
    ? workspace.graph.data.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;

  async function handleMutationComplete() {
    startTransition(() => {
      navigate(`/cases/${caseId}`, { replace: true });
      setRevision(null);
    });
    requestRefresh();
  }

  return (
    <section className="workspace-shell">
      <header className="workspace-toolbar">
        <div>
          <Link className="ghost-link" to="/cases">
            {t('workspace.back')}
          </Link>
          <p className="panel-kicker">{revision === null ? t('workspace.headMode') : t('workspace.historicalMode', { revision })}</p>
          <h2>{workspace?.snapshot.data.case?.title ?? caseId}</h2>
        </div>

        <RevisionSlider
          currentRevision={currentRevision}
          maxRevision={maxRevision}
          onChange={(nextRevision) => {
            startTransition(() => {
              navigate(nextRevision >= maxRevision ? `/cases/${caseId}` : `/cases/${caseId}?revision=${nextRevision}`);
            });
          }}
        />
      </header>

      {error ? <p className="inline-error">{error}</p> : null}

      <div className="workspace-grid">
        <aside className="workspace-rail workspace-rail-left">
          {workspace ? <SnapshotView historical={historical} snapshot={workspace.snapshot} /> : null}
          {workspace ? <CoverageView coverage={workspace.coverage} /> : null}
        </aside>

        <section className="workspace-center">
          {loading && !workspace ? <section className="panel graph-stage"><p>{t('workspace.replaying')}</p></section> : null}
          {workspace ? <TimelineView timeline={workspace.timeline} /> : null}
          {workspace ? (
            <GraphCanvas
              graph={workspace.graph}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
              selectedNodeId={selectedNodeId}
              focusId={selectedNodeId}
            />
          ) : null}
        </section>

        <aside className="workspace-rail workspace-rail-right">
          <section className="panel">
            <p className="panel-kicker">{t('workspace.diff')}</p>
            {workspace?.diff ? (
              <>
                <h4>{t('workspace.changedNodes', { count: workspace.diff.data.changedNodeIds.length })}</h4>
                <ul className="compact-list">
                  {workspace.diff.data.summary.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>{t('workspace.compareHint')}</p>
            )}
          </section>

          {workspace ? <GuardrailView guardrails={workspace.guardrails} /> : null}
          <InspectorPanel inspector={inspector} loading={inspectorLoading} />
          <ActionPanel
            caseId={caseId}
            currentRevision={currentRevision}
            guardrails={workspace?.guardrails ?? null}
            historical={historical}
            onMutationComplete={handleMutationComplete}
            selectedNode={selectedNode}
          />
        </aside>
      </div>
    </section>
  );
}

function buildGraphBackedInspector(
  node: GraphNodeRecord,
  workspace: WorkspaceData,
  t: Translator,
  formatEnumLabel: EnumFormatter
): InspectorViewModel {
  const relatedNodes = collectRelatedNodes(node.id, workspace.graph.data.nodes, workspace.graph.data.edges);
  const coverageItems = workspace.coverage.data.items.filter((item) => item.supportingFactIds.includes(node.id));

  switch (node.kind) {
    case 'fact':
      return {
        kind: 'fact',
        title: node.label,
        status: node.status,
        summary: t('workspace.factSummary'),
        primaryItems: coverageItems.map((item) => item.statement),
        secondaryItems: coverageItems.flatMap((item) => item.relatedHypothesisIds.map((hypothesisId) => findNodeLabel(workspace.graph.data.nodes, hypothesisId)))
      };
    case 'experiment':
      return {
        kind: 'experiment',
        title: node.label,
        status: node.status,
        summary: t('workspace.experimentSummary'),
        primaryItems: relatedNodes.filter((relatedNode) => relatedNode.kind === 'hypothesis').map((relatedNode) => relatedNode.label),
        secondaryItems: node.status === 'completed' ? [t('workspace.experimentOutcome')] : []
      };
    case 'decision':
      return {
        kind: 'decision',
        title: node.label,
        status: node.status,
        summary: t('workspace.decisionSummary'),
        primaryItems: relatedNodes.map((relatedNode) => relatedNode.label),
        secondaryItems: []
      };
    case 'gap':
      return {
        kind: 'gap',
        title: node.label,
        status: node.status,
        summary: t('workspace.gapSummary'),
        primaryItems: relatedNodes.map((relatedNode) => relatedNode.label),
        secondaryItems: []
      };
    case 'residual':
      return {
        kind: 'residual',
        title: node.label,
        status: node.status,
        summary: t('workspace.residualSummary'),
        primaryItems: relatedNodes.map((relatedNode) => relatedNode.label),
        secondaryItems: workspace.guardrails.closeCase.pass ? [t('workspace.closureClear')] : [t('workspace.closureBlocked')]
      };
    default:
      return {
        kind: 'node',
        title: node.label,
        status: node.status,
        summary: t('workspace.selectedFromSlice', { kind: formatEnumLabel(node.kind) }),
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

function findNodeLabel(nodes: GraphNodeRecord[], nodeId: string): string {
  return nodes.find((node) => node.id === nodeId)?.label ?? nodeId;
}