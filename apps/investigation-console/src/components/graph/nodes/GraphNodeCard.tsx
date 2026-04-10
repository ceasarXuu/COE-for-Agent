import { Handle, Position } from 'reactflow';

import type { GraphNodeRecord } from '../useGraphLayout.js';

export interface GraphNodeViewData extends GraphNodeRecord {
  isSelected?: boolean;
  kindLabel?: string;
  revisionLabel?: string;
  statusLabel?: string;
}

export function GraphNodeCard(props: {
  data: GraphNodeViewData;
  toneClassName: string;
}) {
  const { data, toneClassName } = props;

  return (
    <div className={`graph-node ${toneClassName} ${data.isSelected ? 'selected' : ''}`} data-testid={`graph-node-${data.id}`}>
      <Handle type="target" position={Position.Left} className="node-handle" />

      <div className="node-header">
        <span className="node-type">{data.kindLabel ?? data.kind.toUpperCase()}</span>
        {data.statusLabel ? <span className="node-status">{data.statusLabel}</span> : null}
      </div>

      <h4 className="node-title">{data.label}</h4>

      <div className="node-meta">
        <span className="node-revision">{data.revisionLabel ?? `rev ${data.revision}`}</span>
      </div>

      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}
