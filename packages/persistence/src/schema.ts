export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface InvestigationEventsTable {
  event_id: string;
  case_id: string;
  case_revision: number;
  event_type: string;
  command_name: string;
  actor: JsonValue;
  payload: JsonValue;
  metadata: JsonValue;
  created_at: Date;
}

export interface CommandDedupTable {
  case_id: string;
  tool_name: string;
  idempotency_key: string;
  event_id: string;
  command_result: JsonValue;
  created_at: Date;
}

export interface CasesTable {
  id: string;
  title: string | null;
  severity: string | null;
  status: string;
  revision: number;
  payload: JsonValue;
  created_at: Date;
  updated_at: Date;
}

export interface CurrentStateTable {
  id: string;
  case_id: string;
  revision: number;
  status: string | null;
  payload: JsonValue;
  created_at: Date;
  updated_at: Date;
}

export interface CaseListProjectionTable {
  case_id: string;
  title: string | null;
  summary: string | null;
  severity: string | null;
  status: string | null;
  active_hypothesis_count: number;
  updated_at: Date;
}

export interface CaseProjectionCheckpointTable {
  case_id: string;
  revision: number;
  projection_state: JsonValue;
  created_at: Date;
}

export interface ProjectionOutboxTable {
  outbox_id: string;
  case_id: string;
  head_revision: number;
  event_id: string;
  task_type: string;
  status: string;
  attempt_count: number;
  available_at: Date;
  claimed_by: string | null;
  claimed_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PersistenceDatabase {
  investigation_events: InvestigationEventsTable;
  command_dedup: CommandDedupTable;
  cases: CasesTable;
  problems: CurrentStateTable;
  blockers: CurrentStateTable;
  repair_attempts: CurrentStateTable;
  evidence_pool: CurrentStateTable;
  evidence_refs: CurrentStateTable;
  hypotheses: CurrentStateTable;
  case_list_projection: CaseListProjectionTable;
  case_projection_checkpoints: CaseProjectionCheckpointTable;
  projection_outbox: ProjectionOutboxTable;
}
