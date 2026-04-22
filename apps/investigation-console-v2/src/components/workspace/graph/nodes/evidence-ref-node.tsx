import type { NodeProps } from 'reactflow';

import { GraphNodeCard, type GraphNodeViewData } from '@/components/workspace/graph/graph-node-card.js';

export function EvidenceRefNode({ data }: NodeProps<GraphNodeViewData>) {
  return <GraphNodeCard data={data} toneClassName="border-indigo-500/30 bg-indigo-500/10" />;
}
