import { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange
} from 'reactflow';
import 'reactflow/dist/style.css';
import { allowedCanonicalChildKinds } from '@coe/domain/canonical-case-graph';

import type { CaseGraphEnvelope, CaseSnapshotEnvelope } from '../../lib/api.js';
import type { CreateDraftNodeRequest, DraftNodeRecord } from '../node-editor/case-node-drafts.js';
import { buildDraftEdge } from '../node-editor/case-node-drafts.js';
import { useI18n } from '../../lib/i18n.js';
import { getPresentationKind } from './graph-node-presentation.js';
import type { GraphNodeViewData } from './nodes/GraphNodeCard.js';
import { CaseNode } from './nodes/CaseNode.js';
import { EvidenceRefNode } from './nodes/EvidenceRefNode.js';
import { HypothesisNode } from './nodes/HypothesisNode.js';
import { BlockerNode } from './nodes/BlockerNode.js';
import { ProblemNode } from './nodes/ProblemNode.js';
import { RepairAttemptNode } from './nodes/RepairAttemptNode.js';
import { GlowingEdge } from './edges/GlowingEdge.js';
import { computeGraphLayout } from './useGraphLayout.js';

const nodeTypes = {
  case: CaseNode,
  problem: ProblemNode,
  hypothesis: HypothesisNode,
  blocker: BlockerNode,
  repair_attempt: RepairAttemptNode,
  evidence_ref: EvidenceRefNode
};

const edgeTypes = {
  glowing: GlowingEdge
};

interface PendingDraftCreate {
  parentNodeId: string;
  parentKind: 'problem' | 'hypothesis' | 'repair_attempt';
  parentStatus: 'open' | 'resolved' | 'abandoned' | 'unverified' | 'blocked' | 'confirmed' | 'rejected' | 'proposed' | 'running' | 'effective' | 'ineffective' | null;
  paneX: number;
  paneY: number;
  flowX: number;
  flowY: number;
}

interface FlowProjector {
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
}

interface GraphCanvasProps {
  draftNodes?: DraftNodeRecord[];
  snapshot: CaseSnapshotEnvelope;
  graph: CaseGraphEnvelope;
  selectedNodeId?: string | null;
  onCreateDraftNode?: (request: CreateDraftNodeRequest) => void;
  onSelectNode: (nodeId: string) => void;
}

export function GraphCanvas(props: GraphCanvasProps) {
  const { formatEnumLabel, t } = useI18n();
  const caseRecord = props.snapshot.data.case;
  const caseId = caseRecord?.id ?? null;
  const draftNodes = props.draftNodes ?? [];
  const selectedNodeId = props.selectedNodeId ?? null;
  const [pendingDraftCreate, setPendingDraftCreate] = useState<PendingDraftCreate | null>(null);
  const [flowProjector, setFlowProjector] = useState<FlowProjector | null>(null);
  const layout = useMemo(() => computeGraphLayout(props.graph), [props.graph]);

  const baseNodes: Node<GraphNodeViewData>[] = useMemo(() => {
    const persistedNodes = layout.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        ...node.data,
        isDraft: false,
        isSelected: selectedNodeId === node.id,
        kindLabel: formatEnumLabel(getPresentationKind(node.data)),
        kindDetailLabel: null,
        revisionLabel: t('graph.revision', { revision: node.data.revision }),
        statusLabel: formatEnumLabel(node.data.status ?? 'stateless')
      }
    }));

    const transientDraftNodes = draftNodes.map((draftNode) => ({
      id: draftNode.id,
      type: draftNode.kind,
      position: draftNode.position,
      data: {
        ...draftNode,
        isDraft: true,
        isSaving: draftNode.status === 'saving',
        isSelected: selectedNodeId === draftNode.id,
        kindLabel: formatEnumLabel(getPresentationKind(draftNode)),
        kindDetailLabel: null,
        revisionLabel: t(draftNode.status === 'saving' ? 'nodeEditor.saving' : 'nodeEditor.unsaved'),
        statusLabel: t(draftNode.status === 'saving' ? 'nodeEditor.saving' : 'nodeEditor.unsaved')
      }
    }));

    return [...persistedNodes, ...transientDraftNodes];
  }, [draftNodes, formatEnumLabel, layout.nodes, selectedNodeId, t]);

  const [nodes, setNodes] = useState<Node<GraphNodeViewData>[]>(() => baseNodes);

  useEffect(() => {
    setNodes(baseNodes);
  }, [baseNodes]);

  const baseEdges: Edge[] = useMemo(() => {
    const persistedEdges = layout.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data ?? {}
    }));
    const draftEdges = draftNodes.map((draftNode) => buildDraftEdge(draftNode));

    return [...persistedEdges, ...draftEdges];
  }, [draftNodes, layout.edges]);

  const handleNodesChange = (changes: NodeChange[]) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  };

  const handleConnectStart = (
    _event: React.MouseEvent | React.TouchEvent,
    params: { handleType: 'source' | 'target' | null; nodeId: null | string }
  ) => {
    if (props.snapshot.historical || params.handleType !== 'source' || !params.nodeId) {
      return;
    }

    const sourceNode = props.graph.data.nodes.find((node) => node.id === params.nodeId);
    if (!sourceNode) {
      return;
    }

    const parentKind = sourceNode.kind === 'problem'
      ? 'problem'
      : sourceNode.kind === 'hypothesis'
        ? 'hypothesis'
        : sourceNode.kind === 'repair_attempt'
          ? 'repair_attempt'
          : null;

    if (!parentKind) {
      return;
    }

    setPendingDraftCreate({
      parentNodeId: sourceNode.id,
      parentKind,
      parentStatus: sourceNode.status as PendingDraftCreate['parentStatus'],
      paneX: 0,
      paneY: 0,
      flowX: 0,
      flowY: 0
    });
  };

  const handleConnectEnd = (event: MouseEvent | TouchEvent) => {
    if (props.snapshot.historical || !pendingDraftCreate || !flowProjector) {
      return;
    }

    const point = 'changedTouches' in event ? (event.changedTouches[0] ?? null) : event;
    if (!point) {
      setPendingDraftCreate(null);
      return;
    }

    const container = document.querySelector('.graph-canvas-container');
    const rect = container instanceof HTMLElement ? container.getBoundingClientRect() : { left: 0, top: 0 };
    const flowPosition = flowProjector.screenToFlowPosition({
      x: point.clientX,
      y: point.clientY
    });

    setPendingDraftCreate((currentValue) => currentValue
      ? {
          ...currentValue,
          paneX: point.clientX - rect.left,
          paneY: point.clientY - rect.top,
          flowX: flowPosition.x,
          flowY: flowPosition.y
        }
      : currentValue);
  };

  const handleNodeDragStop = (_event: React.MouseEvent, node: { id: string; position: { x: number; y: number } }) => {
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

  if (nodes.length === 0) {
    return (
      <section className="panel panel-primary graph-stage workspace-stage-fill" data-testid="graph-stage">
        <p className="graph-empty-copy">{t('graph.empty')}</p>
      </section>
    );
  }

  return (
    <section className="panel panel-primary graph-stage workspace-stage-fill" data-testid="graph-stage">
      <div className="graph-canvas-container">
        {/* @ts-expect-error ReactFlow has TypeScript compatibility issues with React 19 */}
        <ReactFlow
          defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
          edgeTypes={edgeTypes}
          edges={baseEdges}
          elementsSelectable
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 0.6 }}
          maxZoom={2}
          minZoom={0.5}
          nodeTypes={nodeTypes}
          nodes={nodes}
          nodesConnectable={!props.snapshot.historical}
          nodesDraggable
          onConnectEnd={handleConnectEnd}
          onConnectStart={handleConnectStart}
          onInit={setFlowProjector}
          onMoveEnd={handleMoveEnd}
          onNodeClick={(_event: React.MouseEvent, node: Node<GraphNodeViewData>) => props.onSelectNode(node.id)}
          onNodeDragStop={handleNodeDragStop}
          onNodesChange={handleNodesChange}
          panActivationKeyCode="Space"
          panOnDrag={[0]}
          selectionOnDrag={false}
        >
          <Background color="rgba(0, 240, 255, 0.05)" gap={16} />
          <Controls className="graph-flow-controls" />
          <MiniMap
            className="graph-minimap"
            maskColor="rgba(3, 3, 3, 0.85)"
            nodeColor={(node) => getNodeColor(node.type)}
          />
        </ReactFlow>

        {pendingDraftCreate && pendingDraftCreate.paneX > 0 ? (
          <div
            className="context-menu"
            style={{
              left: pendingDraftCreate.paneX,
              position: 'absolute',
              top: pendingDraftCreate.paneY,
              zIndex: 1000
            }}
          >
            <div className="context-menu-header">{t('canonical.create.header')}</div>
            {allowedCanonicalChildKinds({
              parentKind: pendingDraftCreate.parentKind,
              parentStatus: pendingDraftCreate.parentStatus
            })
              .filter((kind): kind is CreateDraftNodeRequest['kind'] => kind !== 'problem')
              .map((kind) => (
                <button
                  className="context-menu-item"
                  key={kind}
                  onClick={() => {
                    props.onCreateDraftNode?.({
                      kind,
                      parentNodeId: pendingDraftCreate.parentNodeId,
                      parentKind: pendingDraftCreate.parentKind,
                      position: { x: pendingDraftCreate.flowX, y: pendingDraftCreate.flowY }
                    });
                    setPendingDraftCreate(null);
                  }}
                  type="button"
                >
                  {formatEnumLabel(kind)}
                </button>
              ))}
            <button className="ghost-button context-menu-cancel" onClick={() => setPendingDraftCreate(null)} type="button">
              {t('canonical.create.cancel')}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function getNodeColor(nodeType: string | undefined): string {
  const colors: Record<string, string> = {
    case: '#38bdf8',
    problem: '#0ea5e9',
    hypothesis: '#a855f7',
    blocker: '#ef4444',
    repair_attempt: '#f97316',
    evidence_ref: '#6366f1'
  };

  return colors[nodeType ?? ''] ?? '#71717a';
}
