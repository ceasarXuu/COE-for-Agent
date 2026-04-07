import {
  createTypedTelemetry,
  type CaseHeadRevisionChangedEvent,
  type ProjectionTelemetryEvent
} from '@coe/telemetry';

type TelemetryEvents = {
  'case.head_revision.changed': CaseHeadRevisionChangedEvent;
  'case.projection.updated': ProjectionTelemetryEvent;
};

type EventName = keyof TelemetryEvents;

class ConsoleTelemetry {
  private readonly hub = createTypedTelemetry<TelemetryEvents>();

  subscribe<T extends EventName>(eventName: T, listener: (payload: TelemetryEvents[T]) => void) {
    return this.hub.subscribe(eventName, listener);
  }

  emit<T extends EventName>(eventName: T, payload: TelemetryEvents[T]) {
    this.hub.emit(eventName, payload);
  }
}

export const consoleTelemetry = new ConsoleTelemetry();