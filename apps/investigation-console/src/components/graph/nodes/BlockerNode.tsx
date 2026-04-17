import type { NodeProps } from 'reactflow';

import { GraphNodeCard, type GraphNodeViewData } from './GraphNodeCard.js';

export function BlockerNode({ data }: NodeProps<GraphNodeViewData>) {
  return <GraphNodeCard data={data} toneClassName="graph-node-blocker" />;
}
