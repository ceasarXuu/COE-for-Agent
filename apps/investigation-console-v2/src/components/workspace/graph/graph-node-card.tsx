import { Badge } from '@coe/ui/components/badge';
import { cn } from '@coe/ui/lib/utils';
import { Handle, Position } from 'reactflow';

import type { GraphNodeRecord } from '@/lib/workspace/use-graph-layout.js';

export interface GraphNodeViewData extends GraphNodeRecord {
  isDraft?: boolean;
  isSaving?: boolean;
  isSelected?: boolean;
  kindLabel?: string;
  kindDetailLabel?: string | null;
  revisionLabel?: string;
  statusLabel?: string;
}

export function GraphNodeCard(props: {
  data: GraphNodeViewData;
  toneClassName: string;
}) {
  const { data, toneClassName } = props;

  return (
    <div
      className={cn(
        'relative min-w-[220px] rounded-xl border bg-card/95 p-3 text-card-foreground shadow-sm transition-all',
        data.isSelected ? 'ring-2 ring-primary/60 shadow-lg' : 'ring-1 ring-foreground/10',
        data.isDraft ? 'border-dashed' : '',
        data.isSaving ? 'opacity-70' : '',
        toneClassName
      )}
      data-testid={`graph-node-${data.id}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!left-[-8px] !size-3 !border-2 !border-background !bg-primary"
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1">
          <Badge variant="outline">{data.kindLabel ?? data.kind.toUpperCase()}</Badge>
          {data.kindDetailLabel ? <Badge variant="secondary">{data.kindDetailLabel}</Badge> : null}
        </div>
        {data.statusLabel ? (
          <Badge variant={data.isDraft ? 'secondary' : 'outline'} className="shrink-0">
            {data.statusLabel}
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 line-clamp-3 text-sm font-medium leading-snug">
        {data.label}
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        {data.revisionLabel ?? `rev ${data.revision}`}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!right-[-8px] !size-3 !border-2 !border-background !bg-primary"
      />
    </div>
  );
}
