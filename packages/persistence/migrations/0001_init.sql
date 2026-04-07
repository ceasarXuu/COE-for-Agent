create table if not exists investigation_events (
  event_id text primary key,
  case_id text not null,
  case_revision integer not null,
  event_type text not null,
  command_name text not null,
  actor jsonb not null,
  payload jsonb not null,
  metadata jsonb not null,
  created_at timestamptz not null default now(),
  unique (case_id, case_revision)
);

create index if not exists idx_investigation_events_case_revision on investigation_events (case_id, case_revision desc);
create index if not exists idx_investigation_events_case_created_at on investigation_events (case_id, created_at desc);

create table if not exists command_dedup (
  case_id text not null,
  tool_name text not null,
  idempotency_key text not null,
  event_id text not null,
  command_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (case_id, tool_name, idempotency_key)
);

create table if not exists cases (
  id text primary key,
  title text,
  severity text,
  status text not null default 'active',
  stage text not null default 'intake',
  revision integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inquiries (
  id text primary key,
  case_id text not null,
  revision integer not null,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists entities (
  id text primary key,
  case_id text not null,
  revision integer not null,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists symptoms (
  id text primary key,
  case_id text not null,
  revision integer not null,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists artifacts (
  id text primary key,
  case_id text not null,
  revision integer not null,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists facts (
  id text primary key,
  case_id text not null,
  revision integer not null,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hypotheses (
  id text primary key,
  case_id text not null,
  revision integer not null,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists experiments (
  id text primary key,
  case_id text not null,
  revision integer not null,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists gaps (
  id text primary key,
  case_id text not null,
  revision integer not null,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists residuals (
  id text primary key,
  case_id text not null,
  revision integer not null,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists decisions (
  id text primary key,
  case_id text not null,
  revision integer not null,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists case_edges (
  case_id text not null,
  from_id text not null,
  to_id text not null,
  edge_type text not null,
  source_event_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (case_id, from_id, to_id, edge_type)
);

create index if not exists idx_case_edges_from on case_edges (case_id, from_id);
create index if not exists idx_case_edges_to on case_edges (case_id, to_id);

create table if not exists case_snapshot_cache (
  case_id text primary key,
  case_revision integer not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists coverage_cache (
  case_id text primary key,
  case_revision integer not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists guardrail_cache (
  case_id text primary key,
  case_revision integer not null,
  stall_risk text,
  ready_to_patch_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists case_list_projection (
  case_id text primary key,
  title text,
  summary text,
  severity text,
  status text,
  stage text,
  active_hypothesis_count integer not null default 0,
  open_gap_count integer not null default 0,
  open_residual_count integer not null default 0,
  stall_risk text,
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, ''))
  ) stored
);

create index if not exists idx_case_list_projection_status_updated on case_list_projection (status, updated_at desc);
create index if not exists idx_case_list_projection_search on case_list_projection using gin (search_document);

create table if not exists case_projection_checkpoints (
  case_id text not null,
  revision integer not null,
  projection_state jsonb not null,
  created_at timestamptz not null default now(),
  primary key (case_id, revision)
);

create index if not exists idx_case_projection_checkpoints_case_revision on case_projection_checkpoints (case_id, revision desc);

create table if not exists projection_outbox (
  outbox_id text primary key,
  case_id text not null,
  head_revision integer not null,
  event_id text not null,
  task_type text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  claimed_by text,
  claimed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projection_outbox_pending on projection_outbox (task_type, status, available_at, created_at);

create table if not exists artifact_blobs (
  artifact_id text primary key,
  storage_uri text not null,
  digest text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_hypotheses_case_status on hypotheses (case_id, status);
create index if not exists idx_gaps_case_status on gaps (case_id, status);
create index if not exists idx_residuals_case_status on residuals (case_id, status);