import { useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  type Node,
  type Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { CaseGraphEnvelope, CaseSnapshotEnvelope } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.js';
import { useGraphLayout, type GraphNodeRecord } from './useGraphLayout.js';
import { HypothesisNode } from './nodes/HypothesisNode.js';
import { FactNode } from './nodes/FactNode.js';
import { ExperimentNode } from './nodes/ExperimentNode.js';
import { DecisionNode } from './nodes/DecisionNode.js';
import { GapNode } from './nodes/GapNode.js';
import { ResidualNode } from './nodes/ResidualNode.js';
import { InquiryNode } from './nodes/InquiryNode.js';
import { SymptomNode } from './nodes/SymptomNode.js';
import { ArtifactNode } from './nodes/ArtifactNode.js';
import { EntityNode } from './nodes/EntityNode.js';
import type { GraphNodeViewData } from './nodes/GraphNodeCard.js';
import { GlowingEdge } from './edges/GlowingEdge.js';

const nodeTypes = {
  hypothesis: HypothesisNode,
  fact: FactNode,
  experiment: ExperimentNode,
  decision: DecisionNode,
  gap: GapNode,
  residual: ResidualNode,
  inquiry: InquiryNode,
  symptom: SymptomNode,
  artifact: ArtifactNode,
  entity: EntityNode,
};

const edgeTypes = {
  glowing: GlowingEdge,
};

interface GraphCanvasProps {
  snapshot: CaseSnapshotEnvelope;
  graph: CaseGraphEnvelope;
  onSelectNode: (nodeId: string) => void;
}

export function GraphCanvas({ snapshot, graph, onSelectNode }: GraphCanvasProps) {
  const { compareText, formatEnumLabel, t } = useI18n();
  const layout = useGraphLayout(graph, compareText);
  const modeLabel = graph.historical ? t('graph.historical') : t('graph.live');
  const caseRecord = snapshot.data.case;
  
  const nodes: Node<GraphNodeViewData>[] = useMemo(() => {
    return layout.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        ...node.data,
        kindLabel: formatEnumLabel(node.data.kind),
        revisionLabel: t('graph.revision', { revision: node.data.revision }),
        statusLabel: formatEnumLabel(node.data.status ?? 'stateless')
      }
    }));
  }, [formatEnumLabel, layout.nodes, t]);
  
  const edges: Edge[] = useMemo(() => {
    return layout.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data ?? {}
    }));
  }, [layout.edges]);
  
  if (nodes.length === 0) {
    return (
      <section className="panel panel-primary graph-stage" data-testid="graph-stage">
        <div className="graph-toolbar">
          <div className="panel-headline-row">
            <p className="panel-kicker">{t('graph.caseGraph')}</p>
          </div>

          <div aria-label={t('graph.controls')} className="graph-controls">
            <span className="focus-chip">{modeLabel}</span>
            <span className="focus-chip">{t('graph.zoom')}</span>
          </div>
        </div>
        <div className="graph-context-strip">
          <div className="graph-context-header">
            <h3 className="graph-context-stage">{formatEnumLabel(caseRecord?.stage ?? 'unknown')}</h3>
            <span className={`pill pill-${(caseRecord?.severity ?? 'medium').toLowerCase()}`}>
              {formatEnumLabel(caseRecord?.severity ?? 'unknown')}
            </span>
          </div>
          <p className="graph-context-copy">{caseRecord?.objective ?? t('snapshot.defaultObjective')}</p>
          {snapshot.historical ? (
            <p className="history-banner" data-testid="historical-mode">
              {t('snapshot.historical')}
            </p>
          ) : null}
          <div className="metric-strip graph-context-tags">
            <span>{t('snapshot.inquiries', { count: snapshot.data.counts.inquiries })}</span>
            <span>{t('snapshot.symptoms', { count: snapshot.data.counts.symptoms })}</span>
            <span>{t('snapshot.artifacts', { count: snapshot.data.counts.artifacts })}</span>
            <span>{t('snapshot.facts', { count: snapshot.data.counts.facts })}</span>
          </div>
        </div>
        <p className="graph-empty-copy">{t('graph.empty')}</p>
      </section>
    );
  }
  
  return (
    <section className="panel panel-primary graph-stage" data-testid="graph-stage">
      <div className="graph-toolbar">
        <div className="panel-headline-row">
          <p className="panel-kicker">{t('graph.caseGraph')}</p>
        </div>

        <div aria-label={t('graph.controls')} className="graph-controls">
          <span className="focus-chip">{modeLabel}</span>
          <span className="focus-chip">{t('graph.zoom')}</span>
        </div>
      </div>

      <div className="graph-context-strip">
        <div className="graph-context-header">
          <h3 className="graph-context-stage">{formatEnumLabel(caseRecord?.stage ?? 'unknown')}</h3>
          <span className={`pill pill-${(caseRecord?.severity ?? 'medium').toLowerCase()}`}>
            {formatEnumLabel(caseRecord?.severity ?? 'unknown')}
          </span>
        </div>
        <p className="graph-context-copy">{caseRecord?.objective ?? t('snapshot.defaultObjective')}</p>
        {snapshot.historical ? (
          <p className="history-banner" data-testid="historical-mode">
            {t('snapshot.historical')}
          </p>
        ) : null}
        <div className="metric-strip graph-context-tags">
          <span>{t('snapshot.inquiries', { count: snapshot.data.counts.inquiries })}</span>
          <span>{t('snapshot.symptoms', { count: snapshot.data.counts.symptoms })}</span>
          <span>{t('snapshot.artifacts', { count: snapshot.data.counts.artifacts })}</span>
          <span>{t('snapshot.facts', { count: snapshot.data.counts.facts })}</span>
        </div>
      </div>

      <div className="graph-meta-row">
        <div className="metric-strip">
          <span>{t('graph.nodes', { count: nodes.length })}</span>
          <span>{t('graph.links', { count: edges.length })}</span>
        </div>

        <div aria-label={t('graph.legend')} className="graph-legend">
          <span className="graph-legend-item graph-legend-supports">{t('graph.edge.supports')}</span>
          <span className="graph-legend-item graph-legend-explains">{t('graph.edge.explains')}</span>
          <span className="graph-legend-item graph-legend-tests">{t('graph.edge.tests')}</span>
        </div>
      </div>

      <div className="graph-canvas-container">
        {/* @ts-expect-error ReactFlow has TypeScript compatibility issues with React 19 */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.5}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          onNodeClick={(_event: React.MouseEvent, node: Node<GraphNodeViewData>) => onSelectNode(node.id)}
        >
          <Background color="rgba(0, 240, 255, 0.05)" gap={16} />
          <Controls className="graph-flow-controls" />
          <MiniMap
            nodeColor={(node) => getNodeColor(node.type)}
            maskColor="rgba(3, 3, 3, 0.85)"
            className="graph-minimap"
          />
        </ReactFlow>
      </div>
    </section>
  );
}

function getNodeColor(nodeType: string | undefined): string {
  const colors: Record<string, string> = {
    hypothesis: '#a855f7',
    fact: '#00f0ff',
    experiment: '#22c55e',
    decision: '#f59e0b',
    gap: '#ef4444',
    residual: '#71717a',
    inquiry: '#3b82f6',
    symptom: '#ec4899',
    artifact: '#6366f1',
    entity: '#14b8a6'
  };
  
  return colors[nodeType ?? ''] ?? '#71717a';
}
