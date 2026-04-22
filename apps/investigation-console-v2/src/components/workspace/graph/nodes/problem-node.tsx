import type { NodeProps } from 'reactflow';

import { GraphNodeCard, type GraphNodeViewData } from '@/components/workspace/graph/graph-node-card.js';

export function ProblemNode({ data }: NodeProps<GraphNodeViewData>) {
  return <GraphNodeCard data={data} toneClassName="border-primary/25 bg-primary/5" />;
}
