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
    targetY,
  });
  
  const edgeColor = getEdgeColor(data?.type as string);
  
  return (
    <>
      <path
        d={edgePath}
        className="edge-glow"
        style={{ stroke: edgeColor }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ 
          stroke: edgeColor,
          strokeWidth: 2
        }}
      />
    </>
  );
}

function getEdgeColor(edgeType: string): string {
  const colors: Record<string, string> = {
    supports: '#00f0ff',
    explains: '#a855f7',
    tests: '#22c55e'
  };
  
  return colors[edgeType] ?? '#71717a';
}