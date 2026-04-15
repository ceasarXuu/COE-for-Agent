import { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  type Node,
  type NodeChange,
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
import { IssueNode } from './nodes/IssueNode.js';
import type { GraphNodeViewData } from './nodes/GraphNodeCard.js';
import { GlowingEdge } from './edges/GlowingEdge.js';
import { getDisplayKind, getIssueSubtypeLabel, summarizeGraphNodes } from './graph-node-presentation.js';

const nodeTypes = {
  issue: IssueNode,
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
  const layout = useMemo(() => useGraphLayout(graph, compareText), [compareText, graph]);
  const caseRecord = snapshot.data.case;
  const caseId = caseRecord?.id ?? null;
  const [isSpacePanning, setIsSpacePanning] = useState(false);

  const baseNodes: Node<GraphNodeViewData>[] = useMemo(() => {
    return layout.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        ...node.data,
        kindLabel: formatEnumLabel(getDisplayKind(node.data)),
        kindDetailLabel: getIssueSubtypeLabel(node.data)
          ? formatEnumLabel(getIssueSubtypeLabel(node.data) ?? '')
          : null,
        revisionLabel: t('graph.revision', { revision: node.data.revision }),
        statusLabel: formatEnumLabel(node.data.status ?? 'stateless')
      }
    }));
  }, [formatEnumLabel, layout.nodes, t]);

  const [nodes, setNodes] = useState<Node<GraphNodeViewData>[]>(() => baseNodes);

  useEffect(() => {
    setNodes(baseNodes);
  }, [baseNodes]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setIsSpacePanning(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }

      if (!isEditableTarget(event.target)) {
        event.preventDefault();
      }
      setIsSpacePanning(false);
    };

    const handleWindowBlur = () => {
      setIsSpacePanning(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  const edges: Edge[] = useMemo(() => {
    return layout.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data ?? {}
    }));
  }, [layout.edges]);

  const handleNodesChange = (changes: NodeChange[]) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  };

  const handleNodeDragStop = (_event: React.MouseEvent, node: Node<GraphNodeViewData>) => {
    console.info('[investigation-console] graph-node-repositioned', {
      caseId,
      nodeId: node.id,
      position: node.position,
      source: 'graph-canvas'
    });
  };

  const handleMoveEnd = (_event: MouseEvent | TouchEvent | null, viewport: { x: number; y: number; zoom: number }) => {
    console.info('[investigation-console] graph-viewport-updated', {
      caseId,
      source: 'graph-canvas',
      viewport
    });
  };

  const summaryTags = summarizeGraphNodes(graph.data.nodes).map((item) => `${formatEnumLabel(item.kind)} ${item.count}`);
  
  if (nodes.length === 0) {
    return (
      <section className="panel panel-primary graph-stage workspace-stage-fill" data-testid="graph-stage">
        <div className="graph-header">
          <div className="graph-title-block">
            <p className="panel-kicker">{t('graph.caseGraph')}</p>
            <p className="graph-context-copy">{caseRecord?.objective ?? t('snapshot.defaultObjective')}</p>
          </div>
          {snapshot.historical ? (
            <p className="history-banner graph-history-banner">
              {t('snapshot.historical')}
            </p>
          ) : null}
          <div className="graph-summary-row">
            <div className="metric-strip graph-context-tags">
              {summaryTags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div aria-label={t('graph.controls')} className="graph-controls-readout">
              <span className="focus-chip">{snapshot.historical ? t('graph.historical') : t('graph.live')}</span>
            </div>
            <div aria-label={t('graph.legend')} className="graph-legend">
              <span className="graph-legend-item graph-legend-supports">{t('graph.edge.supports')}</span>
              <span className="graph-legend-item graph-legend-explains">{t('graph.edge.explains')}</span>
              <span className="graph-legend-item graph-legend-tests">{t('graph.edge.tests')}</span>
            </div>
          </div>
        </div>
        <p className="graph-empty-copy">{t('graph.empty')}</p>
      </section>
    );
  }
  
  return (
    <section className="panel panel-primary graph-stage workspace-stage-fill" data-testid="graph-stage">
      <div className="graph-header">
        <div className="graph-title-block">
          <p className="panel-kicker">{t('graph.caseGraph')}</p>
          <p className="graph-context-copy">{caseRecord?.objective ?? t('snapshot.defaultObjective')}</p>
        </div>
        {snapshot.historical ? (
          <p className="history-banner graph-history-banner">
            {t('snapshot.historical')}
          </p>
        ) : null}
        <div className="graph-summary-row">
          <div className="metric-strip graph-context-tags">
            {summaryTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <div aria-label={t('graph.controls')} className="graph-controls-readout">
            <span className="focus-chip">{snapshot.historical ? t('graph.historical') : t('graph.live')}</span>
          </div>
          <div aria-label={t('graph.legend')} className="graph-legend">
            <span className="graph-legend-item graph-legend-supports">{t('graph.edge.supports')}</span>
            <span className="graph-legend-item graph-legend-explains">{t('graph.edge.explains')}</span>
            <span className="graph-legend-item graph-legend-tests">{t('graph.edge.tests')}</span>
          </div>
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
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.5}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          nodesDraggable={!isSpacePanning}
          nodesConnectable={false}
          elementsSelectable
          selectionOnDrag={false}
          panOnDrag={[0]}
          panActivationKeyCode="Space"
          autoPanOnNodeDrag={false}
          onNodesChange={handleNodesChange}
          onNodeDragStop={handleNodeDragStop}
          onMoveEnd={handleMoveEnd}
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
    issue: '#3b82f6',
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
