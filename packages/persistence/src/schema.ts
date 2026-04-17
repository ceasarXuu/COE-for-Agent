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
  stage: string;
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

export interface CaseEdgesTable {
  case_id: string;
  from_id: string;
  to_id: string;
  edge_type: string;
  source_event_id: string;
  payload: JsonValue;
  created_at: Date;
}

export interface CaseSnapshotCacheTable {
  case_id: string;
  case_revision: number;
  payload: JsonValue;
  updated_at: Date;
}

export interface CoverageCacheTable {
  case_id: string;
  case_revision: number;
  payload: JsonValue;
  updated_at: Date;
}

export interface GuardrailCacheTable {
  case_id: string;
  case_revision: number;
  stall_risk: string | null;
  ready_to_patch_payload: JsonValue;
  updated_at: Date;
}

export interface CaseListProjectionTable {
  case_id: string;
  title: string | null;
  summary: string | null;
  severity: string | null;
  status: string | null;
  stage: string | null;
  active_hypothesis_count: number;
  open_gap_count: number;
  open_residual_count: number;
  stall_risk: string | null;
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

export interface ArtifactBlobsTable {
  artifact_id: string;
  storage_uri: string;
  digest: string | null;
  size_bytes: number | null;
  created_at: Date;
}

export interface PersistenceDatabase {
  investigation_events: InvestigationEventsTable;
  command_dedup: CommandDedupTable;
  cases: CasesTable;
  problems: CurrentStateTable;
  inquiries: CurrentStateTable;
  entities: CurrentStateTable;
  symptoms: CurrentStateTable;
  artifacts: CurrentStateTable;
  facts: CurrentStateTable;
  hypotheses: CurrentStateTable;
  experiments: CurrentStateTable;
  gaps: CurrentStateTable;
  residuals: CurrentStateTable;
  decisions: CurrentStateTable;
  case_edges: CaseEdgesTable;
  case_snapshot_cache: CaseSnapshotCacheTable;
  coverage_cache: CoverageCacheTable;
  guardrail_cache: GuardrailCacheTable;
  case_list_projection: CaseListProjectionTable;
  case_projection_checkpoints: CaseProjectionCheckpointTable;
  projection_outbox: ProjectionOutboxTable;
  artifact_blobs: ArtifactBlobsTable;
}
