import type { NodeProps } from 'reactflow';

import { GraphNodeCard, type GraphNodeViewData } from '@/components/workspace/graph/graph-node-card.js';

export function HypothesisNode({ data }: NodeProps<GraphNodeViewData>) {
  return <GraphNodeCard data={data} toneClassName="border-violet-500/30 bg-violet-500/8" />;
}
