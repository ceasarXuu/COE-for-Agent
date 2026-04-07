interface HeadRevisionChangedEvent {
  caseId: string;
  headRevision: number;
}

interface ProjectionUpdatedEvent {
  caseId: string;
  projection: string;
  headRevision: number;
  projectionRevision: number;
}

export function connectConsoleStream(handlers: {
  onHeadRevisionChanged?: (event: HeadRevisionChangedEvent) => void;
  onProjectionUpdated?: (event: ProjectionUpdatedEvent) => void;
}) {
  const source = new EventSource('/api/stream');

  source.addEventListener('case.head_revision.changed', (event) => {
    handlers.onHeadRevisionChanged?.(JSON.parse((event as MessageEvent).data) as HeadRevisionChangedEvent);
  });

  source.addEventListener('case.projection.updated', (event) => {
    handlers.onProjectionUpdated?.(JSON.parse((event as MessageEvent).data) as ProjectionUpdatedEvent);
  });

  return () => {
    source.close();
  };
}