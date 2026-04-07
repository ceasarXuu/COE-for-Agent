import { EventEmitter } from 'node:events';

export interface ProjectionTelemetryEvent {
  caseId: string;
  projection: string;
  headRevision: number;
  projectionRevision: number;
}

export interface CaseHeadRevisionChangedEvent {
  caseId: string;
  headRevision: number;
  eventId?: string;
}

type TelemetryEventMap = object;

export interface TypedTelemetryHub<TEvents extends TelemetryEventMap> {
  emit<TEventName extends keyof TEvents & string>(eventName: TEventName, payload: TEvents[TEventName]): void;
  subscribe<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    listener: (payload: TEvents[TEventName]) => void
  ): () => void;
}

export function createTypedTelemetry<TEvents extends TelemetryEventMap>(): TypedTelemetryHub<TEvents> {
  const emitter = new EventEmitter();

  return {
    emit(eventName, payload) {
      emitter.emit(eventName, payload);
    },
    subscribe(eventName, listener) {
      emitter.on(eventName, listener as (payload: unknown) => void);
      return () => {
        emitter.off(eventName, listener as (payload: unknown) => void);
      };
    }
  };
}