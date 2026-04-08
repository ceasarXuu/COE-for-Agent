declare module 'reactflow' {
  import { ComponentType } from 'react';
  
  export interface Node<T = unknown> {
    id: string;
    type?: string;
    position: { x: number; y: number };
    data: T;
  }
  
  export interface Edge {
    id: string;
    source: string;
    target: string;
    type?: string;
    data?: Record<string, unknown>;
  }
  
  export interface NodeProps<T = unknown> {
    id: string;
    data: T;
    type: string;
    selected?: boolean;
    dragging?: boolean;
  }
  
  export interface EdgeProps {
    id: string;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition?: Position;
    targetPosition?: Position;
    data?: Record<string, unknown>;
  }
  
  export enum Position {
    Left = 'left',
    Right = 'right',
    Top = 'top',
    Bottom = 'bottom'
  }
  
  export const Handle: ComponentType<{
    type: 'source' | 'target';
    position: Position;
    className?: string;
    style?: React.CSSProperties;
  }>;
  
  export const BaseEdge: ComponentType<{
    id: string;
    path: string;
    style?: React.CSSProperties;
  }>;
  
  export function getBezierPath(params: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition?: Position;
    targetPosition?: Position;
  }): [string, number, number, number, number];
  
  export const ReactFlow: ComponentType<{
    nodes: Node[];
    edges: Edge[];
    onNodeClick?: (event: React.MouseEvent, node: Node) => void;
    nodeTypes?: Record<string, ComponentType<NodeProps>>;
    edgeTypes?: Record<string, ComponentType<EdgeProps>>;
    fitView?: boolean;
    fitViewOptions?: { padding?: number };
    minZoom?: number;
    maxZoom?: number;
    defaultViewport?: { x: number; y: number; zoom: number };
    nodesDraggable?: boolean;
    nodesConnectable?: boolean;
    elementsSelectable?: boolean;
    children?: React.ReactNode;
  }>;
  
  export const Background: ComponentType<{
    color?: string;
    gap?: number;
  }>;
  
  export const Controls: ComponentType<{
    className?: string;
  }>;
  
  export const MiniMap: ComponentType<{
    nodeColor?: (node: Node) => string;
    maskColor?: string;
    className?: string;
  }>;
}