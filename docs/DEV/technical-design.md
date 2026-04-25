# COE for Agent Technical Design

Updated: 2026-04-25

This document describes the current implemented runtime. It is the canonical
engineering reference for the local MVP and should match code, schemas, MCP
metadata, agent skills, and console behavior.

## Current Shape

COE for Agent is an MCP-first investigation runtime with a human console.

- Agents interact through the `coe-investigation` MCP server.
- Humans review and edit through `apps/investigation-console-v2`.
- Shared frontend API and i18n types live in `packages/console-client`.
- Domain rules live in `packages/domain`.
- Runtime contract names live in `packages/mcp-contracts`.
- JSON schemas live in `schemas/resources/v1` and are validated by resource tests.
- Persistence is a local JSON file store selected by `COE_DATA_DIR`.

The local MVP deliberately favors a stable single-machine workflow over a remote
database deployment. The persistence boundary is explicit: callers configure a
data directory, not a database URL.

## Core Model

Every case has one canonical root problem and a constrained graph:

- `problem`
- `hypothesis`
- `blocker`
- `repair_attempt`
- `evidence_ref`
- reusable `evidence` entities in the case evidence pool

The main graph only renders structural investigation nodes. Reusable evidence is
read through the evidence-pool resource and attached to the graph through
`evidence_ref` nodes.

Allowed structural edges:

- `problem -> hypothesis`
- `hypothesis -> hypothesis`
- `hypothesis -> blocker`
- `hypothesis -> repair_attempt`
- `hypothesis -> evidence_ref`
- `repair_attempt -> repair_attempt`
- `repair_attempt -> evidence_ref`

Repair attempts are only valid after the parent hypothesis is confirmed.

## MCP Surface

The implemented surface is versioned by `packages/mcp-contracts`.

### Mutation Tools

There are 18 mutation tools:

- `investigation.case.open`
- `investigation.case.close`
- `investigation.problem.update`
- `investigation.problem.set_status`
- `investigation.problem.add_reference_material`
- `investigation.hypothesis.create`
- `investigation.hypothesis.update`
- `investigation.hypothesis.set_status`
- `investigation.blocker.open`
- `investigation.blocker.update`
- `investigation.blocker.close`
- `investigation.repair_attempt.create`
- `investigation.repair_attempt.update`
- `investigation.repair_attempt.set_status`
- `investigation.evidence.capture`
- `investigation.evidence.attach_existing`
- `investigation.evidence_ref.update`
- `investigation.evidence.capture_and_attach`

### Guardrail Tools

There are 4 guardrail tools:

- `investigation.guardrail.check`
- `investigation.guardrail.stall_check`
- `investigation.guardrail.ready_to_patch_check`
- `investigation.guardrail.close_case_check`

### Resources

There are 7 resource families:

- `investigation://profile`
- `investigation://cases`
- `investigation://cases/{caseId}/snapshot`
- `investigation://cases/{caseId}/timeline`
- `investigation://cases/{caseId}/graph`
- `investigation://cases/{caseId}/evidence-pool`
- `investigation://cases/{caseId}/diff`

The graph resource is canonical-only. It returns `problem`, `hypothesis`,
`blocker`, `repair_attempt`, and `evidence_ref` nodes. It does not expose
evidence-pool entities as graph nodes.

### Prompts

The MCP server exposes 3 prompts:

- `coe_investigate_issue`
- `coe_ready_to_patch`
- `coe_reviewer_handoff`

Prompt text must remain usable by generic MCP clients. It should point agents to
`investigation://profile` first, then to snapshot, timeline, graph,
evidence-pool, and diff resources for case context.

## Agent Workflow

Agents should follow this path:

1. Read `investigation://profile`.
2. Open or select a case.
3. Keep the root problem current.
4. Capture reusable evidence or attach existing evidence through structured tools.
5. Create hypotheses and blockers while the cause is still unresolved.
6. Create repair attempts only after a hypothesis is confirmed.
7. Read snapshot, timeline, graph, evidence-pool, and diff before handoff.
8. Run guardrails before repair preparation or closure.
9. Escalate reviewer-only actions instead of simulating human confirmation.

Agent-facing docs live in:

- `.agents/skills/coe-investigation/SKILL.md`
- `.claude/commands`
- `.opencode/commands`

The conformance test `apps/investigation-server/test/mcp/agent-surface-alignment.test.ts`
keeps those files aligned with MCP contracts.

## Human Console

The current console is `apps/investigation-console-v2`.

Runtime shape:

- Vite React app for the browser UI.
- Fastify BFF under `apps/investigation-console-v2/server`.
- Shared API and translation contracts from `@coe/console-client`.
- BFF uses `@coe/investigation-server/console-adapter` instead of importing server internals.

The console supports:

- case list
- case snapshot
- timeline
- canonical graph
- node editor
- evidence pool
- revision-aware reads
- history-mode write freeze
- explicit reviewer confirmation flow

Mutation requests from the console must carry `x-session-token`. Missing tokens
return 401 and log `console_bff.session_token_missing`.

## Persistence

The implemented persistence client is local-file based.

- `createPersistenceClient({ dataDir })` constructs a local persistence database.
- `COE_DATA_DIR` selects the runtime data directory.
- reset helpers move data into a timestamped backup directory before creating a
  fresh store.
- Tests use isolated temporary data directories.

No production database adapter is exposed by the current package API.

## Schemas

Resource schemas are source-controlled under `schemas/resources/v1`.

Important contracts:

- `case.graph.schema.json` allows only canonical graph node kinds.
- `case.diff.schema.json` uses `changedEdgeKeys` and `stateTransitions`.
- `case.evidence-pool.schema.json` validates reusable evidence reads.
- `case.snapshot.schema.json` allows an empty case payload for unknown cases.

Server resource tests validate real resource output against these schemas.

## Security Boundary

The local console issues signed sessions for human review. Reviewer confirmation
tokens bind command name, case id, target ids, session id, role, reason hash, and
expiry.

Rules:

- Console mutations require an explicit session token.
- Guardrail reads may run without injecting actor context.
- Reviewer-only actions require human confirmation.
- Agent sessions should not mint reviewer confirmation tokens.

## Verification

Use targeted verification for contract work:

```bash
./node_modules/.bin/tsc -p apps/investigation-server/tsconfig.json --noEmit
./node_modules/.bin/tsc -p apps/investigation-console-v2/tsconfig.json --noEmit
./node_modules/.bin/tsc -p packages/console-client/tsconfig.json --noEmit
./node_modules/.bin/tsc -p packages/mcp-contracts/tsconfig.json --noEmit
./node_modules/.bin/tsc -p packages/schemas/tsconfig.json --noEmit
```

Use Homebrew Node for Vitest on this machine:

```bash
PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run test/mcp/agent-surface-alignment.test.ts --maxWorkers=1
```

## Drift Rules

- Add new MCP tools only through `packages/mcp-contracts`.
- Update skill and command docs in the same change as the contract.
- Update resource schemas before shipping resource output changes.
- Keep frontend types in `packages/console-client` aligned with schemas.
- Do not expose server source layout as a console runtime contract.
- Do not describe future adapters as current runtime behavior.
