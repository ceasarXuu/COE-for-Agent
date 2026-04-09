import { Handle, Position, type NodeProps } from 'reactflow';
import type { GraphNodeRecord } from '../useGraphLayout.js';

export function ExperimentNode({ data }: NodeProps<GraphNodeRecord & { isSelected?: boolean }>) {
  return (
    <div className={`graph-node graph-node-experiment ${data.isSelected ? 'selected' : ''}`} data-testid={`graph-node-${data.id}`}>
      <Handle type="target" position={Position.Left} className="node-handle" />
      
      <div className="node-header">
        <span className="node-type">EXPERIMENT</span>
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
