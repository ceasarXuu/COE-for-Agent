import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import type { CaseGraphEnvelope, GraphNodeRecord } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

const NODE_WIDTH = 190;
const NODE_HEIGHT = 118;
const COLUMN_GAP = 88;
const ROW_GAP = 42;
const PAD_X = 56;
const PAD_Y = 56;
const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 2] as const;
const MIN_ZOOM = ZOOM_LEVELS[0];
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? 2;
const LANE_ORDER = [
  ['case', 'inquiry'],
  ['symptom', 'entity', 'artifact'],
  ['fact'],
  ['hypothesis'],
  ['experiment', 'gap', 'residual'],
  ['decision']
] as const;

interface PositionedNode extends GraphNodeRecord {
  lane: number;
  x: number;
  y: number;
}

interface PositionedEdge {
  key: string;
  type: string;
  fromId: string;
  toId: string;
  path: string;
  labelX: number;
  labelY: number;
}

interface GraphLayout {
  width: number;
  height: number;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  laneIndexes: number[];
}

export function GraphScene(props: {
  graph: CaseGraphEnvelope;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}) {
  const { formatEnumLabel, t } = useI18n();
  const layout = useMemo(() => buildGraphLayout(props.graph), [props.graph]);
  const stageRef = useRef<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(stageRef.current && document.fullscreenElement === stageRef.current));
    };

    handleFullscreenChange();
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const scaledWidth = Math.max(Math.round(layout.width * zoom), layout.width);
  const scaledHeight = Math.max(Math.round(layout.height * zoom), layout.height);

  if (layout.nodes.length === 0) {
    return (
      <section className="panel workspace-stage graph-stage">
        <div className="panel-headline-row">
          <p className="panel-kicker">{t('graph.slice')}</p>
        </div>
        <p className="graph-empty-copy">{t('graph.empty')}</p>
      </section>
    );
  }

  return (
    <section className="panel workspace-stage graph-stage" ref={stageRef}>
      <div className="graph-toolbar">
        <div className="panel-headline-row">
          <p className="panel-kicker">{t('graph.caseGraph')}</p>
          {props.graph.data.focusId ? <span className="focus-chip">{t('graph.focus', { id: props.graph.data.focusId.slice(0, 10) })}</span> : null}
        </div>

        <div aria-label={t('graph.controls')} className="graph-controls">
          <span className="focus-chip graph-zoom-readout">{t('graph.zoomPercent', { percent: Math.round(zoom * 100) })}</span>
          <button
            aria-label={t('graph.zoomOut')}
            className="ghost-button graph-control-button"
            data-testid="graph-zoom-out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((currentZoom) => getNextZoom(currentZoom, -1))}
            title={t('graph.zoomOut')}
            type="button"
          >
            -
          </button>
          <button
            className="ghost-button graph-control-button"
            data-testid="graph-reset-view"
            onClick={() => setZoom(1)}
            type="button"
          >
            {t('graph.reset')}
          </button>
          <button
            aria-label={t('graph.zoomIn')}
            className="ghost-button graph-control-button"
            data-testid="graph-zoom-in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((currentZoom) => getNextZoom(currentZoom, 1))}
            title={t('graph.zoomIn')}
            type="button"
          >
            +
          </button>
          <button
            className="ghost-button graph-control-button"
            data-testid="graph-fullscreen"
            onClick={() => void toggleFullscreen(stageRef.current)}
            type="button"
          >
            {isFullscreen ? t('graph.exitFullscreen') : t('graph.fullscreen')}
          </button>
        </div>
      </div>

      <div className="graph-meta-row">
        <div className="metric-strip">
          <span>{t('graph.nodes', { count: layout.nodes.length })}</span>
          <span>{t('graph.links', { count: layout.edges.length })}</span>
          <span>{props.graph.historical ? t('graph.historical') : t('graph.live')}</span>
        </div>

        <div aria-label={t('graph.legend')} className="graph-legend">
          <span className="graph-legend-item graph-legend-supports">{t('graph.edge.supports')}</span>
          <span className="graph-legend-item graph-legend-explains">{t('graph.edge.explains')}</span>
          <span className="graph-legend-item graph-legend-tests">{t('graph.edge.tests')}</span>
        </div>
      </div>

      <div className="graph-viewport" data-testid="graph-canvas">
        <div
          className="graph-surface"
          style={{
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`
          }}
        >
          <div
            className="graph-canvas"
            style={{
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left'
            } satisfies CSSProperties}
          >
            {layout.laneIndexes.map((laneIndex) => (
              <div
                className="graph-lane-tag"
                key={`lane-${laneIndex}`}
                style={{
                  left: `${PAD_X + laneIndex * (NODE_WIDTH + COLUMN_GAP)}px`
                } satisfies CSSProperties}
              >
                {getLaneLabel(laneIndex, formatEnumLabel, t)}
              </div>
            ))}

            <svg
              aria-hidden="true"
              className="graph-layer"
              preserveAspectRatio="xMinYMin meet"
              viewBox={`0 0 ${layout.width} ${layout.height}`}
            >
              <defs>
                <marker
                  id="graph-arrowhead"
                  markerHeight="9"
                  markerWidth="9"
                  orient="auto-start-reverse"
                  refX="7"
                  refY="4.5"
                >
                  <path className="graph-arrowhead" d="M0,0 L9,4.5 L0,9 z" />
                </marker>
              </defs>

              {layout.edges.map((edge) => (
                <g className="graph-edge-group" key={edge.key}>
                  <path
                    className={`graph-edge graph-edge-${toCssToken(edge.type)}`}
                    d={edge.path}
                    markerEnd="url(#graph-arrowhead)"
                  />
                  <text className="graph-edge-label" x={edge.labelX} y={edge.labelY}>
                    {t(`graph.edge.${edge.type}`)}
                  </text>
                </g>
              ))}
            </svg>

            {layout.nodes.map((node) => (
              <button
                aria-label={`${formatEnumLabel(node.kind)} ${node.label}`}
                className={`graph-node graph-node-${toCssToken(node.kind)}${props.selectedNodeId === node.id ? ' graph-node-active' : ''}${props.graph.data.focusId === node.id ? ' graph-node-focus' : ''}`}
                data-testid={`graph-node-${node.id}`}
                key={node.id}
                onClick={() => props.onSelectNode(node.id)}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`
                } satisfies CSSProperties}
                type="button"
              >
                <p>{formatEnumLabel(node.kind)}</p>
                <h4>{node.label}</h4>
                <div className="graph-node-meta">
                  <span>{formatEnumLabel(node.status ?? 'stateless')}</span>
                  <em className="graph-node-revision">{t('graph.revision', { revision: node.revision })}</em>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function buildGraphLayout(graph: CaseGraphEnvelope): GraphLayout {
  const focusId = graph.data.focusId;
  const distances = computeFocusDistances(graph, focusId);
  const laneLookup = new Map<string, number>();

  LANE_ORDER.forEach((kinds, laneIndex) => {
    kinds.forEach((kind) => {
      laneLookup.set(kind, laneIndex);
    });
  });

  const laneCount = LANE_ORDER.length + 1;
  const lanes = Array.from({ length: laneCount }, () => [] as GraphNodeRecord[]);

  for (const node of graph.data.nodes) {
    const lane = laneLookup.get(node.kind) ?? laneCount - 1;
    const laneNodes = lanes[lane];

    if (!laneNodes) {
      continue;
    }

    laneNodes.push(node);
  }

  for (const lane of lanes) {
    lane.sort((left, right) => {
      const distanceDelta = getDistance(distances, left.id) - getDistance(distances, right.id);
      if (distanceDelta !== 0) {
        return distanceDelta;
      }

      return left.label.localeCompare(right.label);
    });
  }

  const maxRows = Math.max(...lanes.map((lane) => lane.length), 1);
  const activeLaneCount = Math.max(
    lanes.reduce((max, lane, laneIndex) => (lane.length > 0 ? laneIndex + 1 : max), 0),
    1
  );
  const width = PAD_X * 2 + activeLaneCount * NODE_WIDTH + (activeLaneCount - 1) * COLUMN_GAP;
  const height = PAD_Y * 2 + maxRows * NODE_HEIGHT + (maxRows - 1) * ROW_GAP;

  const positionedNodes: PositionedNode[] = [];
  const laneIndexes: number[] = [];

  lanes.forEach((lane, laneIndex) => {
    if (lane.length === 0) {
      return;
    }

    laneIndexes.push(laneIndex);

    const laneHeight = lane.length * NODE_HEIGHT + Math.max(lane.length - 1, 0) * ROW_GAP;
    const laneOffset = PAD_Y + (height - PAD_Y * 2 - laneHeight) / 2;
    const x = PAD_X + laneIndex * (NODE_WIDTH + COLUMN_GAP);

    lane.forEach((node, index) => {
      positionedNodes.push({
        ...node,
        lane: laneIndex,
        x,
        y: laneOffset + index * (NODE_HEIGHT + ROW_GAP)
      });
    });
  });

  const positionLookup = new Map(positionedNodes.map((node) => [node.id, node]));
  const positionedEdges: PositionedEdge[] = graph.data.edges
    .map((edge) => {
      const from = positionLookup.get(edge.fromId);
      const to = positionLookup.get(edge.toId);

      if (!from || !to) {
        return null;
      }

      return buildEdgePath(edge, from, to);
    })
    .filter((edge): edge is PositionedEdge => edge !== null);

  return {
    width,
    height,
    nodes: positionedNodes,
    edges: positionedEdges,
    laneIndexes
  };
}

function buildEdgePath(
  edge: CaseGraphEnvelope['data']['edges'][number],
  from: PositionedNode,
  to: PositionedNode
): PositionedEdge {
  const sameLane = from.lane === to.lane;
  const fromOnLeft = from.lane <= to.lane;
  const startX = fromOnLeft ? from.x + NODE_WIDTH : from.x;
  const endX = fromOnLeft ? to.x : to.x + NODE_WIDTH;
  const startY = from.y + NODE_HEIGHT / 2;
  const endY = to.y + NODE_HEIGHT / 2;

  if (sameLane) {
    const arcBend = 64;
    const elbowX = from.x + NODE_WIDTH + arcBend;
    const path = [
      `M ${from.x + NODE_WIDTH} ${startY}`,
      `C ${elbowX} ${startY}, ${elbowX} ${endY}, ${to.x + NODE_WIDTH} ${endY}`
    ].join(' ');

    return {
      key: edge.key,
      type: edge.type,
      fromId: edge.fromId,
      toId: edge.toId,
      path,
      labelX: elbowX - 8,
      labelY: (startY + endY) / 2 - 10
    };
  }

  const direction = fromOnLeft ? 1 : -1;
  const controlOffset = Math.max(COLUMN_GAP * 0.7, 48);
  const controlOneX = startX + controlOffset * direction;
  const controlTwoX = endX - controlOffset * direction;
  const path = [
    `M ${startX} ${startY}`,
    `C ${controlOneX} ${startY}, ${controlTwoX} ${endY}, ${endX} ${endY}`
  ].join(' ');

  return {
    key: edge.key,
    type: edge.type,
    fromId: edge.fromId,
    toId: edge.toId,
    path,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2 - 10
  };
}

function computeFocusDistances(graph: CaseGraphEnvelope, focusId: string | null): Map<string, number> {
  if (!focusId) {
    return new Map();
  }

  const adjacency = new Map<string, Set<string>>();

  for (const node of graph.data.nodes) {
    adjacency.set(node.id, new Set());
  }

  for (const edge of graph.data.edges) {
    adjacency.get(edge.fromId)?.add(edge.toId);
    adjacency.get(edge.toId)?.add(edge.fromId);
  }

  const distances = new Map<string, number>([[focusId, 0]]);
  const queue = [focusId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const currentDistance = distances.get(current) ?? 0;
    for (const next of adjacency.get(current) ?? []) {
      if (!distances.has(next)) {
        distances.set(next, currentDistance + 1);
        queue.push(next);
      }
    }
  }

  return distances;
}

function getDistance(distances: Map<string, number>, nodeId: string): number {
  return distances.get(nodeId) ?? Number.MAX_SAFE_INTEGER;
}

function toCssToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function getLaneLabel(
  laneIndex: number,
  formatEnumLabel: (value: null | string | undefined) => string,
  t: (key: string, params?: Record<string, number | string>) => string
): string {
  const laneKinds = LANE_ORDER[laneIndex];
  if (!laneKinds) {
    return t('graph.otherLane');
  }

  return laneKinds.map((kind) => formatEnumLabel(kind)).join(' / ');
}

function getNextZoom(currentZoom: number, direction: -1 | 1): number {
  const currentIndex = ZOOM_LEVELS.findIndex((level) => level >= currentZoom);
  const normalizedIndex = currentIndex === -1 ? ZOOM_LEVELS.length - 1 : currentIndex;
  const nextIndex = Math.min(Math.max(normalizedIndex + direction, 0), ZOOM_LEVELS.length - 1);
  return ZOOM_LEVELS[nextIndex] ?? currentZoom;
}

async function toggleFullscreen(element: HTMLElement | null): Promise<void> {
  if (!element || typeof document === 'undefined') {
    return;
  }

  if (document.fullscreenElement === element) {
    if (typeof document.exitFullscreen === 'function') {
      await document.exitFullscreen();
    }
    return;
  }

  if (typeof element.requestFullscreen === 'function') {
    await element.requestFullscreen();
  }
}