import type { NodeProps } from 'reactflow';

import { GraphNodeCard, type GraphNodeViewData } from './GraphNodeCard.js';

export function CaseNode({ data }: NodeProps<GraphNodeViewData>) {
  return <GraphNodeCard data={data} toneClassName="graph-node-case" />;
}