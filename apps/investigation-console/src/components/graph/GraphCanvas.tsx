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
import { buildIdempotencyKey } from '@coe/shared-utils';

import { invokeTool, type CaseGraphEnvelope, type CaseSnapshotEnvelope } from '../../lib/api.js';
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
import { getDisplayKind, getPresentationKind, summarizeGraphNodes } from './graph-node-presentation.js';

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
  onMutationComplete?: () => Promise<void> | void;
  onSelectNode: (nodeId: string) => void;
}

interface ContextMenuState {
  flowX: number;
  flowY: number;
  paneX: number;
  paneY: number;
}

interface FlowPositionProjector {
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
}

const contextMenuNodeOptions = [
  { type: 'issue', labelKey: 'graph.node.issue', defaultLabelKey: 'graph.newIssue' },
  { type: 'artifact', labelKey: 'graph.node.artifact', defaultLabelKey: 'graph.newArtifact' }
] as const;

export function GraphCanvas({ snapshot, graph, onMutationComplete, onSelectNode }: GraphCanvasProps) {
  const { compareText, formatEnumLabel, t } = useI18n();
  const layout = useMemo(() => useGraphLayout(graph, compareText), [compareText, graph]);
  const caseRecord = snapshot.data.case;
  const caseId = caseRecord?.id ?? null;
  const currentRevision = caseRecord?.revision ?? snapshot.headRevision;
  const [isSpacePanning, setIsSpacePanning] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<FlowPositionProjector | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [mutationPending, setMutationPending] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const baseNodes: Node<GraphNodeViewData>[] = useMemo(() => {
    return layout.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        ...node.data,
        kindLabel: formatEnumLabel(getPresentationKind(node.data)),
        kindDetailLabel: null,
        revisionLabel: t('graph.revision', { revision: node.data.revision }),
        statusLabel: formatEnumLabel(node.data.status ?? 'stateless')
      }
    }));
  }, [formatEnumLabel, layout.nodes, t]);

  const [nodes, setNodes] = useState<Node<GraphNodeViewData>[]>(() => baseNodes);

  useEffect(() => {
    setNodes(baseNodes);
  }, [baseNodes]);

  const baseEdges: Edge[] = useMemo(() => {
    return layout.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data ?? {}
    }));
  }, [layout.edges]);

  const [edges, setEdges] = useState<Edge[]>(() => baseEdges);

  useEffect(() => {
    setEdges(baseEdges);
  }, [baseEdges]);

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

    const handleClickOutside = (event: MouseEvent) => {
      if (!contextMenu) {
        return;
      }

      const contextMenuElement = event.target instanceof Element
        ? event.target.closest('.context-menu')
        : null;

      if (!contextMenuElement) {
        console.info('[investigation-console] graph-context-menu-closed', {
          caseId,
          reason: 'outside-click',
          source: 'graph-canvas'
        });
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('mousedown', handleClickOutside, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [contextMenu]);

  const handleNodesChange = (changes: NodeChange[]) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  };

  const handleConnect = (connection: { source: null | string; target: null | string }) => {
    if (!connection.source || !connection.target) {
      return;
    }

    const edgeId = `${connection.source}->${connection.target}:manual`;
    const nextEdge: Edge = {
      id: edgeId,
      source: connection.source,
      target: connection.target,
      type: 'glowing',
      data: { type: 'related' }
    };

    let edgeAdded = false;
    setEdges((currentEdges) => {
      if (currentEdges.some((edge) => edge.source === connection.source && edge.target === connection.target)) {
        return currentEdges;
      }

      edgeAdded = true;
      return [...currentEdges, nextEdge];
    });

    if (edgeAdded) {
      console.info('[investigation-console] graph-edge-added', {
        caseId,
        edgeId,
        source: 'graph-canvas',
        sourceNodeId: connection.source,
        targetNodeId: connection.target
      });
    }
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

  const handlePaneContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    if (snapshot.historical || mutationPending) {
      return;
    }

    if (reactFlowInstance && event.currentTarget instanceof HTMLElement) {
      const container = event.currentTarget.closest('.graph-canvas-container');
      const menuAnchor = container instanceof HTMLElement ? container : event.currentTarget;
      const rect = menuAnchor.getBoundingClientRect();
      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });

      setContextMenu({
        flowX: flowPosition.x,
        flowY: flowPosition.y,
        paneX: event.clientX - rect.left,
        paneY: event.clientY - rect.top
      });

      console.info('[investigation-console] graph-context-menu-opened', {
        caseId,
        source: 'graph-canvas',
        clientPosition: { x: event.clientX, y: event.clientY },
        flowPosition
      });
    }
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleAddNode = async (type: 'artifact' | 'issue', labelKey: 'graph.newArtifact' | 'graph.newIssue') => {
    if (!caseId || snapshot.historical) {
      return;
    }

    const label = t(labelKey);
    setMutationPending(true);
    setMutationError(null);

    try {
      let createdIds: string[] = [];

      if (type === 'issue') {
        const result = await invokeTool<{ createdIds?: string[] }>('investigation.issue.record', {
          caseId,
          ifCaseRevision: currentRevision,
          issueKind: 'symptom',
          title: label,
          summary: label,
          priority: normalizePriority(caseRecord?.severity),
          reproducibility: 'unknown',
          idempotencyKey: buildIdempotencyKey('graph-issue-record')
        });
        createdIds = result.createdIds ?? [];
      } else {
        const result = await invokeTool<{ createdIds?: string[] }>('investigation.artifact.attach', {
          caseId,
          ifCaseRevision: currentRevision,
          artifactKind: 'log',
          title: label,
          source: {
            uri: `manual://graph-canvas/${caseId}/${Date.now()}`
          },
          excerpt: label,
          idempotencyKey: buildIdempotencyKey('graph-artifact-attach')
        });
        createdIds = result.createdIds ?? [];
      }

      console.info('[investigation-console] graph-node-persisted', {
        caseId,
        createdIds,
        nodeType: type,
        source: 'graph-canvas'
      });

      setContextMenu(null);
      await onMutationComplete?.();
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : t('errors.mutationFailed');
      console.error('[investigation-console] graph-node-persist-failed', {
        caseId,
        message,
        nodeType: type,
        source: 'graph-canvas'
      });
      setMutationError(message);
    } finally {
      setMutationPending(false);
    }
  };

  const summaryTags = summarizeGraphNodes(graph.data.nodes).map((item) => `${formatEnumLabel(item.kind)} ${item.count}`);
  
  if (nodes.length === 0) {
    return (
      <section className="panel panel-primary graph-stage workspace-stage-fill" data-testid="graph-stage">
        <div className="graph-header">
          <div className="graph-summary-row">
            {snapshot.historical ? (
              <p className="history-banner graph-history-banner">
                <span data-testid="historical-mode">{t('snapshot.historical')}</span>
              </p>
            ) : null}
            <div aria-label={t('graph.controls')} className="graph-controls-readout">
              <span className="focus-chip">{snapshot.historical ? t('graph.historical') : t('graph.live')}</span>
            </div>
            <div aria-label={t('graph.legend')} className="graph-legend">
              <span className="graph-legend-item graph-legend-supports">{t('graph.edge.supports')}</span>
              <span className="graph-legend-item graph-legend-explains">{t('graph.edge.explains')}</span>
              <span className="graph-legend-item graph-legend-tests">{t('graph.edge.tests')}</span>
            </div>
            <div className="metric-strip graph-context-tags">
              {summaryTags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
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
        <div className="graph-summary-row">
          {snapshot.historical ? (
            <p className="history-banner graph-history-banner">
              <span data-testid="historical-mode">{t('snapshot.historical')}</span>
            </p>
          ) : null}
          <div aria-label={t('graph.controls')} className="graph-controls-readout">
            <span className="focus-chip">{snapshot.historical ? t('graph.historical') : t('graph.live')}</span>
          </div>
          <div aria-label={t('graph.legend')} className="graph-legend">
            <span className="graph-legend-item graph-legend-supports">{t('graph.edge.supports')}</span>
            <span className="graph-legend-item graph-legend-explains">{t('graph.edge.explains')}</span>
            <span className="graph-legend-item graph-legend-tests">{t('graph.edge.tests')}</span>
          </div>
          <div className="metric-strip graph-context-tags">
            {summaryTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
      </div>
      {mutationError ? <p className="inline-error">{mutationError}</p> : null}

      <div className="graph-canvas-container">
        {/* @ts-expect-error ReactFlow has TypeScript compatibility issues with React 19 */}
        <ReactFlow
          onInit={setReactFlowInstance}
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
          nodesConnectable
          elementsSelectable
          selectionOnDrag={false}
          panOnDrag={[0]}
          panActivationKeyCode="Space"
          autoPanOnNodeDrag={false}
          onConnect={handleConnect}
          onNodesChange={handleNodesChange}
          onNodeDragStop={handleNodeDragStop}
          onMoveEnd={handleMoveEnd}
          onNodeClick={(_event: React.MouseEvent, node: Node<GraphNodeViewData>) => onSelectNode(node.id)}
          onPaneContextMenu={handlePaneContextMenu}
        >
          <Background color="rgba(0, 240, 255, 0.05)" gap={16} />
          <Controls className="graph-flow-controls" />
          <MiniMap
            nodeColor={(node) => getNodeColor(node.type)}
            maskColor="rgba(3, 3, 3, 0.85)"
            className="graph-minimap"
          />
        </ReactFlow>

        {contextMenu && (
          <div 
            className="context-menu"
            style={{
              position: 'absolute',
              top: contextMenu.paneY,
              left: contextMenu.paneX,
              zIndex: 1000
            }}
            onClick={handleCloseContextMenu}
          >
            <div className="context-menu-header">
              {t('graph.addNode')}
            </div>
            {contextMenuNodeOptions.map((option) => (
              <div
                key={option.type}
                className="context-menu-item"
                onClick={() => void handleAddNode(option.type, option.defaultLabelKey)}
              >
                {t(option.labelKey)}
              </div>
            ))}
          </div>
        )}
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

function normalizePriority(severity: unknown): 'critical' | 'high' | 'medium' | 'low' {
  switch (severity) {
    case 'critical':
    case 'high':
    case 'medium':
    case 'low':
      return severity;
    default:
      return 'medium';
  }
}
