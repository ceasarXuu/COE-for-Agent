# COE for Agent PRD

Updated: 2026-04-25

## Product Goal

COE for Agent turns complex agent work into a structured investigation that can
be reviewed, replayed, and safely continued by humans or agents.

The current product target is a local MVP for engineering validation. It must be
easy to run, easy to inspect, and strict about evidence before repair.

## Primary Users

- Coding agents that need durable investigation state.
- Human reviewers supervising risky changes.
- Product and platform engineers evaluating agent governance flows.

## Core Jobs

1. Open a case with a clear problem.
2. Record reusable evidence.
3. Create hypotheses and blockers while uncertainty remains.
4. Create repair attempts only after a hypothesis is confirmed.
5. Review the case through snapshot, timeline, graph, evidence-pool, and diff.
6. Run guardrails before repair preparation or closure.
7. Require explicit reviewer confirmation for human-only actions.

## Current Runtime Contract

The MCP server exposes:

- 18 mutation tools.
- 4 guardrail tools.
- 7 resource families.
- 3 prompts.

The exact names are owned by:

- `packages/mcp-contracts/src/tool-names.ts`
- `packages/mcp-contracts/src/resource-uris.ts`
- `apps/investigation-server/src/mcp/prompts.ts`

## Canonical Case Graph

The implemented graph model uses:

- `problem`
- `hypothesis`
- `blocker`
- `repair_attempt`
- `evidence_ref`
- reusable `evidence` in the evidence pool

The graph resource returns only structural graph nodes. Evidence-pool entities
are inspected through their dedicated resource and connected to the graph through
evidence references.

## Human Console Requirements

The current console is `apps/investigation-console-v2`.

Required user-visible surfaces:

- case list
- case creation
- snapshot
- timeline
- graph
- node editor
- evidence pool
- revision navigation
- reviewer confirmation

The console must not mutate without an explicit session token. History mode must
freeze writes that target a past revision.

## Agent Requirements

Agent-facing instructions must be complete enough for a generic MCP client:

- read `investigation://profile`
- list or open a case
- use canonical tools only
- read snapshot, timeline, graph, evidence-pool, and diff for context
- run guardrails before repair preparation or closure
- escalate reviewer-only actions

The shipped skill and command files are part of the product contract.

## Storage Scope

The MVP stores state in a local JSON file store rooted at `COE_DATA_DIR`.

This scope is intentional. Remote storage, multi-tenant identity, and production
operations are outside the current acceptance target.

## Done Criteria

The product is aligned when:

- MCP metadata lists only canonical tools, resources, and prompts.
- Agent skill and command docs reference only published MCP names.
- Resource schemas validate real server resource output.
- Console BFF imports a stable server adapter.
- Console mutations require explicit session tokens.
- Current docs describe implemented behavior, not future adapters.
- Typecheck and targeted tests pass.
