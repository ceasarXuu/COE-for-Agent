import {
  createConsoleStreamClient,
  type HeadRevisionChangedEvent,
  type ProjectionUpdatedEvent
} from '@coe/console-client/sse';

const streamClient = createConsoleStreamClient({
  logScope: '[investigation-console-v2]'
});

export type { HeadRevisionChangedEvent, ProjectionUpdatedEvent };

export function connectConsoleStream(handlers: {
  onHeadRevisionChanged?: (event: HeadRevisionChangedEvent) => void;
  onProjectionUpdated?: (event: ProjectionUpdatedEvent) => void;
}) {
  return streamClient.connect(handlers);
}
