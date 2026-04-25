# Canonical Case Graph Model

Date: 2026-04-18
Updated: 2026-04-25

## Status

Implemented for the local MVP.

This file describes the current canonical graph model shared by storage,
commands, projections, schemas, the console, and agent guidance.

## Principles

1. A case is the aggregate container.
2. Every case has exactly one root `problem`.
3. Graph nodes use fixed canonical kinds.
4. Structural parent-child edges are derived from node payload fields.
5. Reusable evidence lives in the evidence pool.
6. `evidence_ref` nodes connect the graph to evidence-pool entities.
7. There is no generic graph-node creation API.

## Node Kinds

### problem

- Root node.
- Status: `open | resolved | abandoned`.
- Children: `hypothesis`.
- Key payload fields: title, description, environment, symptoms,
  resolutionCriteria, referenceMaterials.

### hypothesis

- Parent: `problem | hypothesis`.
- Status: `unverified | blocked | confirmed | rejected`.
- Children: `hypothesis | blocker | repair_attempt | evidence_ref`.
- Repair-attempt children require the parent hypothesis to be confirmed.

### blocker

- Parent: `hypothesis`.
- Status: `active | closed`.
- Leaf node.

### repair_attempt

- Parent: `hypothesis | repair_attempt`.
- Status: `proposed | running | effective | ineffective`.
- Children: `repair_attempt | evidence_ref`.
- A repair attempt can spawn another repair attempt only after it is ineffective.

### evidence_ref

- Parent: `hypothesis | repair_attempt`.
- Leaf node.
- Points to one evidence-pool entity.
- Effect on parent is interpreted by parent kind.

### evidence

- Reusable case-level entity.
- Stored and read through `investigation://cases/{caseId}/evidence-pool`.
- Not rendered as a graph node.

## Tool Surface

The implemented canonical tools are the 18 mutation tools and 4 guardrail tools
listed in `packages/mcp-contracts/src/tool-names.ts`.

All UI and agent behavior must depend on those exported names.

## Resource Surface

The graph resource uses this model:

- `projectionModel` is `canonical`.
- graph node kinds are limited to structural graph nodes.
- graph edges are structural parent-child edges.
- evidence-pool entities are available through the evidence-pool resource.

## Guardrail Semantics

- `ready_to_patch` requires a confirmed hypothesis branch.
- Active blockers under the candidate branch block repair preparation.
- `close_case` requires a resolved problem and a validated effective repair.
- `stall_check` evaluates stalled investigation state from canonical records.

## Console Semantics

The console graph editor can create only valid child node kinds for the selected
parent and current state. Local draft nodes are temporary UI state; committed
nodes must be persisted through canonical MCP tools.

## Verification

Relevant tests:

- `apps/investigation-server/test/resources/graph.test.ts`
- `apps/investigation-server/test/resources/evidence-pool.test.ts`
- `apps/investigation-server/test/guardrails/canonical-guardrails.test.ts`
- `apps/investigation-server/test/mcp/agent-surface-alignment.test.ts`
