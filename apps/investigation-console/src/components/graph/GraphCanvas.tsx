import { useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  type Node,
  type Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { CaseGraphEnvelope } from '../../lib/api.js';
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
  graph: CaseGraphEnvelope;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  focusId?: string | null;
}

export function GraphCanvas({ graph, selectedNodeId, onSelectNode, focusId }: GraphCanvasProps) {
  const layout = useGraphLayout(graph);
  
  const nodes: Node<GraphNodeRecord>[] = useMemo(() => {
    return layout.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        ...node.data,
        isSelected: node.id === selectedNodeId,
        isFocus: node.id === focusId
      }
    }));
  }, [layout.nodes, selectedNodeId, focusId]);
  
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
      <div className="graph-canvas-empty">
        <p className="panel-kicker">Graph Slice</p>
        <p>No nodes are available in this graph slice yet.</p>
      </div>
    );
  }
  
  return (
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
        onNodeClick={(_event: React.MouseEvent, node: Node<GraphNodeRecord>) => onSelectNode(node.id)}
      >
        <Background color="rgba(0, 240, 255, 0.05)" gap={16} />
        <Controls className="graph-controls" />
        <MiniMap
          nodeColor={(node) => getNodeColor(node.type)}
          maskColor="rgba(3, 3, 3, 0.85)"
          className="graph-minimap"
        />
      </ReactFlow>
    </div>
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