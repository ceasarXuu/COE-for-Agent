import type { NodeProps } from 'reactflow';

import { GraphNodeCard, type GraphNodeViewData } from '@/components/workspace/graph/graph-node-card.js';

export function RepairAttemptNode({ data }: NodeProps<GraphNodeViewData>) {
  return <GraphNodeCard data={data} toneClassName="border-orange-500/30 bg-orange-500/10" />;
}
