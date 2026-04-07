import {
  createTypedTelemetry,
  type CaseHeadRevisionChangedEvent,
  type ProjectionTelemetryEvent
} from '@coe/telemetry';

export interface ToolCallTelemetryEvent {
  name: string;
  success: boolean;
  durationMs: number;
}

export interface ResourceReadTelemetryEvent {
  uri: string;
  success: boolean;
  durationMs: number;
}

interface InvestigationTelemetryEvents {
  'tool.call': ToolCallTelemetryEvent;
  'guardrail.evaluate': ToolCallTelemetryEvent;
  'resource.read': ResourceReadTelemetryEvent;
  'projection.rebuild': ProjectionTelemetryEvent;
  'case.head_revision.changed': CaseHeadRevisionChangedEvent;
  'case.projection.updated': ProjectionTelemetryEvent;
}

export class InvestigationTelemetry {
  private readonly emitter = createTypedTelemetry<InvestigationTelemetryEvents>();

  recordToolCall(event: ToolCallTelemetryEvent): void {
    this.emitter.emit('tool.call', event);
  }

  recordGuardrailEvaluate(event: ToolCallTelemetryEvent): void {
    this.emitter.emit('guardrail.evaluate', event);
  }

  recordResourceRead(event: ResourceReadTelemetryEvent): void {
    this.emitter.emit('resource.read', event);
  }

  recordProjectionRebuild(event: ProjectionTelemetryEvent): void {
    this.emitter.emit('projection.rebuild', event);
  }

  emitCaseHeadRevisionChanged(event: CaseHeadRevisionChangedEvent): void {
    this.emitter.emit('case.head_revision.changed', event);
  }

  emitCaseProjectionUpdated(event: ProjectionTelemetryEvent): void {
    this.recordProjectionRebuild(event);
    this.emitter.emit('case.projection.updated', event);
  }

  subscribe<TEventName extends keyof InvestigationTelemetryEvents>(
    eventName: TEventName,
    listener: (payload: InvestigationTelemetryEvents[TEventName]) => void
  ): () => void {
    return this.emitter.subscribe(eventName, listener);
  }
}

export const investigationTelemetry = new InvestigationTelemetry();