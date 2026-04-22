import { BaseEdge, getBezierPath, type EdgeProps } from 'reactflow';

export function GlowingEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY
  });

  const edgeColor = getEdgeColor(data?.type as string);

  return (
    <>
      <path d={edgePath} stroke={edgeColor} strokeWidth={5} strokeLinecap="round" opacity={0.18} />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: edgeColor,
          strokeWidth: 2.2
        }}
      />
    </>
  );
}

function getEdgeColor(edgeType: string): string {
  const colors: Record<string, string> = {
    supports: '#b58a46',
    explains: '#7765f2',
    tests: '#4f87ff',
    structural: '#8a867c'
  };

  return colors[edgeType] ?? '#8a867c';
}
