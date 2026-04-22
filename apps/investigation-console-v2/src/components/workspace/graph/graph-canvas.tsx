import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Button } from '@coe/ui/components/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@coe/ui/components/empty';
import { cn } from '@coe/ui/lib/utils';
import { IconTopologyStar3 } from '@tabler/icons-react';

import type { CaseGraphEnvelope, CaseSnapshotEnvelope } from '@/lib/api.js';
import { useI18n } from '@/lib/i18n.js';
import {
  buildDraftEdge,
  type CreateDraftNodeRequest,
  type DraftNodeRecord
} from '@/lib/workspace/case-node-drafts.js';
import { getPresentationKind } from '@/lib/workspace/graph-node-presentation.js';
import { computeGraphLayout } from '@/lib/workspace/use-graph-layout.js';
import { GlowingEdge } from '@/components/workspace/graph/edges/glowing-edge.js';
import { GraphNodeCard, type GraphNodeViewData } from '@/components/workspace/graph/graph-node-card.js';
import { BlockerNode } from '@/components/workspace/graph/nodes/blocker-node.js';
import { CaseNode } from '@/components/workspace/graph/nodes/case-node.js';
import { EvidenceRefNode } from '@/components/workspace/graph/nodes/evidence-ref-node.js';
import { HypothesisNode } from '@/components/workspace/graph/nodes/hypothesis-node.js';
import { ProblemNode } from '@/components/workspace/graph/nodes/problem-node.js';
import { RepairAttemptNode } from '@/components/workspace/graph/nodes/repair-attempt-node.js';

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
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  function handleNodesChange(changes: NodeChange[]) {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  }

  function handleConnectStart(
    _event: React.MouseEvent | React.TouchEvent,
    params: { handleType: 'source' | 'target' | null; nodeId: null | string }
  ) {
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

    console.info('[investigation-console-v2] draft-node-create-started', {
      event: 'graph.draft_node_create_started',
      caseId,
      nodeId: sourceNode.id,
      parentKind
    });

    setPendingDraftCreate({
      parentNodeId: sourceNode.id,
      parentKind,
      parentStatus: sourceNode.status as PendingDraftCreate['parentStatus'],
      paneX: 0,
      paneY: 0,
      flowX: 0,
      flowY: 0
    });
  }

  function handleConnectEnd(event: MouseEvent | TouchEvent) {
    if (props.snapshot.historical || !pendingDraftCreate || !flowProjector) {
      return;
    }

    const point = 'changedTouches' in event ? (event.changedTouches[0] ?? null) : event;
    if (!point) {
      setPendingDraftCreate(null);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
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
  }

  function handleNodeDragStop(
    _event: React.MouseEvent,
    node: { id: string; position: { x: number; y: number } }
  ) {
    console.info('[investigation-console-v2] graph-node-repositioned', {
      event: 'graph.node_repositioned',
      caseId,
      nodeId: node.id,
      position: node.position
    });
  }

  function handleMoveEnd(
    _event: MouseEvent | TouchEvent | null,
    viewport: { x: number; y: number; zoom: number }
  ) {
    console.info('[investigation-console-v2] graph-viewport-updated', {
      event: 'graph.viewport_updated',
      caseId,
      viewport
    });
  }

  if (nodes.length === 0) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-border bg-card/80" data-testid="graph-stage">
        <Empty className="border-none bg-transparent">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconTopologyStar3 />
            </EmptyMedia>
            <EmptyTitle>{t('graph.empty')}</EmptyTitle>
            <EmptyDescription>{t('workspace.compareHint')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-xl border border-border bg-card/90" data-testid="graph-stage">
      <div
        ref={containerRef}
        className="h-[min(72vh,820px)] min-h-[560px] bg-[radial-gradient(circle_at_top,rgba(181,138,70,0.08),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_35%)]"
      >
        {/* @ts-expect-error ReactFlow has TypeScript compatibility issues with React 19 */}
        <ReactFlow
          className="[&_svg]:outline-none"
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
          <Background color="rgba(138, 134, 124, 0.18)" gap={18} />
          <Controls className="!rounded-lg !border !border-border !bg-background/90 !shadow-sm" />
          <MiniMap
            className="!rounded-lg !border !border-border !bg-background/95"
            maskColor="rgba(23, 22, 19, 0.72)"
            nodeColor={(node) => getNodeColor(node.type)}
          />
        </ReactFlow>

        {pendingDraftCreate && pendingDraftCreate.paneX > 0 ? (
          <div
            className={cn(
              'absolute z-20 flex min-w-48 flex-col gap-1 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl'
            )}
            style={{
              left: pendingDraftCreate.paneX,
              top: pendingDraftCreate.paneY
            }}
          >
            <div className="px-2 pb-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {t('canonical.create.header')}
            </div>
            {allowedCanonicalChildKinds({
              parentKind: pendingDraftCreate.parentKind,
              parentStatus: pendingDraftCreate.parentStatus
            })
              .filter((kind): kind is CreateDraftNodeRequest['kind'] => kind !== 'problem')
              .map((kind) => (
                <Button
                  key={kind}
                  className="justify-start"
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    props.onCreateDraftNode?.({
                      kind,
                      parentNodeId: pendingDraftCreate.parentNodeId,
                      parentKind: pendingDraftCreate.parentKind,
                      position: { x: pendingDraftCreate.flowX, y: pendingDraftCreate.flowY }
                    });
                    setPendingDraftCreate(null);
                  }}
                >
                  {formatEnumLabel(kind)}
                </Button>
              ))}
            <Button size="sm" type="button" variant="outline" onClick={() => setPendingDraftCreate(null)}>
              {t('canonical.create.cancel')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getNodeColor(nodeType: string | undefined): string {
  const colors: Record<string, string> = {
    case: '#4f87ff',
    problem: '#b58a46',
    hypothesis: '#7765f2',
    blocker: '#e29c3d',
    repair_attempt: '#d0672f',
    evidence_ref: '#5f6ae8'
  };

  return colors[nodeType ?? ''] ?? '#8a867c';
}
