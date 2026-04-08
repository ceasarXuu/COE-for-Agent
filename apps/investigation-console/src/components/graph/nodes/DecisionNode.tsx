import { Handle, Position, type NodeProps } from 'reactflow';
import type { GraphNodeRecord } from '../useGraphLayout.js';

export function DecisionNode({ data }: NodeProps<GraphNodeRecord & { isSelected?: boolean }>) {
  return (
    <div className={`graph-node graph-node-decision ${data.isSelected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="node-handle" />
      
      <div className="node-header">
        <span className="node-type">DECISION</span>
        {data.status && <span className="node-status">{data.status}</span>}
      </div>
      
      <h4 className="node-title">{data.label}</h4>
      
      <div className="node-meta">
        <span className="node-revision">rev {data.revision}</span>
      </div>
      
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}