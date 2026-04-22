import type { NodeProps } from 'reactflow';

import { GraphNodeCard, type GraphNodeViewData } from '@/components/workspace/graph/graph-node-card.js';

export function BlockerNode({ data }: NodeProps<GraphNodeViewData>) {
  return <GraphNodeCard data={data} toneClassName="border-amber-500/30 bg-amber-500/10" />;
}
