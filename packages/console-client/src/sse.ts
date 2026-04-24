export interface HeadRevisionChangedEvent {
  caseId: string;
  headRevision: number;
}

export interface ProjectionUpdatedEvent {
  caseId: string;
  projection: string;
  headRevision: number;
  projectionRevision: number;
}

export interface ConsoleStreamClientOptions {
  streamUrl?: string;
  logScope?: string;
  eventSourceFactory?: (url: string) => EventSource;
}

export function createConsoleStreamClient(options: ConsoleStreamClientOptions = {}) {
  const streamUrl = options.streamUrl ?? '/api/stream';
  const logScope = options.logScope ?? '[investigation-console]';
  const eventSourceFactory = options.eventSourceFactory ?? ((url: string) => new EventSource(url));

  return {
    connect(handlers: {
      onHeadRevisionChanged?: (event: HeadRevisionChangedEvent) => void;
      onProjectionUpdated?: (event: ProjectionUpdatedEvent) => void;
    }) {
      const source = eventSourceFactory(streamUrl);

      console.info(`${logScope} stream-connected`, {
        event: 'stream.connected',
        streamUrl
      });

      source.addEventListener('case.head_revision.changed', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as HeadRevisionChangedEvent;
          handlers.onHeadRevisionChanged?.(data);
        } catch (error) {
          console.error(`${logScope} failed-to-parse-head-revision-event`, {
            event: 'stream.parse_error',
            originalEvent: (event as MessageEvent).data,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      source.addEventListener('case.projection.updated', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as ProjectionUpdatedEvent;
          handlers.onProjectionUpdated?.(data);
        } catch (error) {
          console.error(`${logScope} failed-to-parse-projection-updated-event`, {
            event: 'stream.parse_error',
            originalEvent: (event as MessageEvent).data,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      return () => {
        source.close();
        console.info(`${logScope} stream-closed`, {
          event: 'stream.closed',
          streamUrl
        });
      };
    }
  };
}

const defaultStreamClient = createConsoleStreamClient();

export function connectConsoleStream(handlers: {
  onHeadRevisionChanged?: (event: HeadRevisionChangedEvent) => void;
  onProjectionUpdated?: (event: ProjectionUpdatedEvent) => void;
}) {
  return defaultStreamClient.connect(handlers);
}
