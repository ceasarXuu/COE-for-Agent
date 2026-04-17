# Canonical Case Graph Model

Date: 2026-04-18

## Goal

Replace the current mixed legacy investigation graph with a single canonical model that is shared by:

- storage
- command validation
- projection / graph derivation
- console editing
- agent editing

The graph is a constrained knowledge graph with node-local state machines. It is not a free-form graph and it is not a pure global workflow state machine.

## Core Principles

1. `Case` is the aggregate container, not a graph node.
2. Every case graph has exactly one visible root node: `problem`.
3. Main-graph nodes have exactly one structural parent.
4. The main graph is always a DAG.
5. Reuse is expressed through shared entities, never through multi-parent structural nodes.
6. Storage, commands, projections, and UI use the same canonical vocabulary.
7. There is no generic `create_node` or `create_edge` API.

## Layers

### Aggregate Container

`Case` owns:

- case metadata
- the unique root `problem`
- the main graph nodes
- the shared evidence pool
- event log / revision history

### Problem Reference Materials

Problem-scoped materials are not evidence yet. They live inside `problem.referenceMaterials[]` and represent potentially useful inputs such as logs, screenshots, tickets, code excerpts, or conversations that have not yet been attached to a concrete validation path.

### Main Graph

The main graph contains only nodes that participate in the investigation structure:

- `problem`
- `hypothesis`
- `evidence_ref`
- `blocker`
- `repair_attempt`

### Shared Evidence Pool

Shared evidence is stored separately as reusable `evidence` entities. Main-graph `evidence_ref` nodes point to an `evidenceId`.

## Canonical Node Types

### `problem`

- root-only
- status: `open | resolved | abandoned`
- children: `hypothesis`
- fields:
  - `title`
  - `description`
  - `environment`
  - `symptoms`
  - `resolutionCriteria`
  - `referenceMaterials[]`

### `hypothesis`

- parent: `problem | hypothesis`
- status: `unverified | blocked | confirmed | rejected`
- children:
  - `hypothesis`
  - `evidence_ref`
  - `blocker`
  - `repair_attempt` only when parent hypothesis is `confirmed`
- fields:
  - `statement`
  - `falsificationCriteria[]`
  - `derivedFromEvidenceIds[]`

### `evidence_ref`

- parent: `hypothesis | repair_attempt`
- leaf node
- no status
- fields:
  - `evidenceId`
  - `effectOnParent`
  - `interpretation`
  - `localConfidence?`

`effectOnParent` depends on parent type:

- parent `hypothesis`: `supports | refutes | neutral`
- parent `repair_attempt`: `validates | invalidates | neutral`

### `blocker`

- parent: `hypothesis`
- leaf node
- status: `active | closed`
- fields:
  - `description`
  - `possibleWorkarounds[]`

### `repair_attempt`

- parent: `hypothesis | repair_attempt`
- status: `proposed | running | effective | ineffective`
- children:
  - `evidence_ref`
  - `repair_attempt` only when parent repair attempt is `ineffective`
- fields:
  - `changeSummary`
  - `scope`
  - `confidence`

## Shared Entities

### `evidence`

Reusable shared evidence pool entity.

- `evidenceId`
- `kind`: `log | code | trace | reasoning | experiment_result | document | other`
- `title`
- `summary`
- `contentRef`
- `provenance`
- `confidence`

### `reference_material`

Problem-scoped pre-evidence material.

- `materialId`
- `kind`: `log | code | trace | screenshot | conversation | ticket | document | other`
- `title`
- `contentRef`
- `note`

## Structural Edge Rules

Allowed structural parent -> child relations:

- `problem -> hypothesis`
- `hypothesis -> hypothesis`
- `hypothesis -> evidence_ref`
- `hypothesis -> blocker`
- `hypothesis -> repair_attempt` only when hypothesis is `confirmed`
- `repair_attempt -> evidence_ref`
- `repair_attempt -> repair_attempt` only when repair attempt is `ineffective`

Everything else is rejected.

Additional global rules:

- exactly one `problem` node per case graph
- `problem` has no parent
- `evidence_ref` and `blocker` are always leaves
- no node may point to itself
- no edge may introduce an ancestor cycle

## State Machine Rules

### Problem

- `open -> resolved`
- `open -> abandoned`
- `resolved` and `abandoned` are terminal

### Hypothesis

- initial: `unverified`
- `unverified -> blocked`
- `blocked -> unverified`
- `unverified -> confirmed`
- `unverified -> rejected`
- `confirmed` and `rejected` are terminal in v1

Constraint:

- if there exists at least one active child blocker, the effective hypothesis status must be `blocked`

### Blocker

- initial: `active`
- `active -> closed`
- `closed` is terminal

### Repair Attempt

- initial: `proposed`
- `proposed -> running`
- `running -> effective`
- `running -> ineffective`
- `effective` and `ineffective` are terminal

Constraint:

- only `ineffective` repair attempts may spawn another repair attempt

## Command Model

Canonical write commands to introduce incrementally:

- `investigation.problem.update`
- `investigation.problem.set_status`
- `investigation.problem.add_reference_material`
- `investigation.hypothesis.create`
- `investigation.hypothesis.set_status`
- `investigation.blocker.open`
- `investigation.blocker.close`
- `investigation.repair_attempt.create`
- `investigation.repair_attempt.set_status`
- `investigation.evidence.capture`
- `investigation.evidence.attach_existing`
- `investigation.evidence.capture_and_attach`

## Storage Direction

Introduce canonical current-state records for:

- `problems`
- `hypotheses`
- `blockers`
- `repair_attempts`
- `evidence_pool`
- `evidence_refs`
- `problem_reference_materials`

Structural edges are derived from `parentNodeId` + `parentNodeType`; they are not stored as a free-form mutable edge table.

## Projection Direction

`/graph` should derive:

- nodes from canonical current-state records
- structural edges from parent pointers

Shared evidence pool should be exposed through a dedicated resource, not mixed into the main graph.

## UI Direction

Editing model:

- drag from existing node only
- drop on canvas -> present only allowed child types for that parent state
- submit minimal required form
- command executes atomically and refreshes graph

The UI must not create local fake nodes or fake edges that are not representable in canonical storage.

## Migration Strategy

### Phase 1

- introduce canonical domain definitions and rule validators
- keep legacy commands / projections untouched
- block new UI work from adding more legacy concepts

### Phase 2

- add canonical commands and current-state records
- add canonical graph projection behind a feature flag or case-type gate

### Phase 3

- migrate console graph editor and inspector
- migrate new cases to canonical-only mode

### Phase 4

- design legacy-to-canonical migration for historical cases
- retire legacy graph vocabulary from writable surfaces

## Implementation Start

This turn starts Phase 1 by adding:

- canonical node kinds, statuses, and evidence semantics to `packages/domain`
- canonical structural rule helpers and DAG validation helpers
- canonical state machines for `problem`, `blocker`, and `repair_attempt`
