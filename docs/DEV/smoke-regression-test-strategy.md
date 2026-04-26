# Smoke and Regression Test Strategy

Updated: 2026-04-27

This document defines the local test system for COE for Agent. The goal is to
run the right verification immediately after each change, expose severe breaks
before human review, and keep every failure actionable.

## Core Functions Under Test

The product currently has four critical runtime surfaces:

1. Investigation Server MCP surface
   - Mutation tools for case, problem, hypothesis, blocker, repair attempt,
     evidence, and evidence reference operations.
   - Guardrail tools for stall, ready-to-patch, close-case, and generic checks.
   - MCP stdio protocol, prompts, resources, and agent-facing guidance.
2. Canonical investigation model
   - One root problem per case.
   - Canonical graph nodes: `problem`, `hypothesis`, `blocker`,
     `repair_attempt`, and `evidence_ref`.
   - Evidence entities live in the evidence pool and attach through
     `evidence_ref` nodes.
   - Revision envelopes protect history reads and conflict detection.
3. Local persistence and replay
   - Append-only events.
   - Current-state projections.
   - Checkpoints, replay, diff, dedup, outbox, and file locking.
   - Isolated `COE_DATA_DIR` usage for tests and local runs.
4. Investigation Console v2
   - Case list, workspace, snapshot header, timeline, canonical graph,
     node editor, evidence pool, and revision navigation.
   - Fastify BFF through the stable server console adapter.
   - Session token and reviewer confirmToken boundaries.
   - Playwright flows against fixture and real-backend seeded cases.

Shared package surfaces also need protection:

- `@coe/domain`: graph rules, state machines, IDs, revision envelopes.
- `@coe/mcp-contracts`: tool names, resource URIs, error codes.
- `@coe/schemas`: resource schemas and generated validators.
- `@coe/console-client`: API, SSE, UI store, and i18n contracts.
- `@coe/ui`: shared UI components and global styles.
- `@coe/telemetry` and `@coe/shared-utils`: cross-cutting utilities.

## Default Post-Change Gate

Run this after every non-trivial code change before handing work to a human:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

This is the full local gate. It is intentionally boring: TypeScript catches
contract drift, Vitest catches domain/server/client regressions, and Playwright
checks the browser-visible console path.

For documentation-only changes, run at least:

```bash
pnpm typecheck
```

If the documentation changes commands, runtime behavior, public contracts, test
expectations, or runbooks, use the full local gate.

## Fast Smoke Gate

Use this when iterating locally and the next edit depends on quick feedback:

```bash
pnpm typecheck
pnpm test
```

Expected signal:

- All packages still compile under their declared contracts.
- Domain, persistence, schemas, server, and console unit tests remain healthy.
- Severe integration drift is caught before opening the browser or running E2E.

This smoke gate does not replace the full gate before final handoff.

## Targeted Regression Matrix

Use the narrowest targeted lane first, then run the default post-change gate
when the implementation is ready.

| Change area | First targeted checks | Required final checks |
| --- | --- | --- |
| Domain graph rules, IDs, state machines, revision envelopes | `pnpm --filter @coe/domain test` | `pnpm typecheck && pnpm test` |
| Persistence, replay, checkpoints, dedup, outbox, file locking | `pnpm --filter @coe/persistence test` | `pnpm typecheck && pnpm test` |
| MCP tool names, resources, prompts, agent docs, command files | `pnpm --filter @coe/investigation-server test -- test/mcp/agent-surface-alignment.test.ts` | `pnpm lint && pnpm typecheck && pnpm test` |
| Server commands, guardrails, resources, export, control plane | `pnpm --filter @coe/investigation-server test` | `pnpm lint && pnpm typecheck && pnpm test` |
| Resource schema shape or generated validators | `pnpm --filter @coe/schemas test && pnpm --filter @coe/investigation-server test -- test/resources` | `pnpm build && pnpm test` |
| Console BFF routes, sessions, confirmToken, adapter integration | `pnpm --filter @coe/investigation-console-v2 test -- test/server` | `pnpm --filter @coe/investigation-console-v2 test && pnpm test:e2e` |
| Console graph, node editor, timeline, revision behavior | `pnpm --filter @coe/investigation-console-v2 test -- test/graph-canvas.behavior.test.ts test/node-editor.test.ts test/workspace-timeline.test.ts` | `pnpm --filter @coe/investigation-console-v2 test && pnpm test:e2e` |
| Console startup, port handling, Playwright config | `pnpm --filter @coe/investigation-console-v2 test -- test/run-e2e-ports.test.ts test/playwright-config.test.ts test/vite-config.test.ts` | `pnpm test:e2e` |
| Shared console client API, SSE, i18n, UI store | `pnpm --filter @coe/console-client test && pnpm --filter @coe/investigation-console-v2 test` | `pnpm typecheck && pnpm test:e2e` |
| Shared UI package or global CSS | `pnpm --filter @coe/ui typecheck && pnpm --filter @coe/investigation-console-v2 test` | `pnpm --filter @coe/investigation-console-v2 test:e2e` |
| Bootstrap, install, start, local host registration | `pnpm --filter @coe/investigation-server test -- test/bootstrap/host-bootstrap.test.ts` | `pnpm setup:agents:plan && pnpm typecheck && pnpm test` |

When a package-local Vitest script runs inside the package directory, pass
package-local paths such as `test/workspace-timeline.test.ts`, not repo-root
paths.

## Browser Smoke Checklist

Run this after console UI changes, even if Playwright is green, when the change
touches layout, graph interaction, timeline, session behavior, or copy:

1. Start the console through the canonical launcher:

   ```bash
   ./start.sh
   ```

2. Open the local console URL reported by the script, usually
   `http://127.0.0.1:4173/`.
3. Verify the case list renders and can create or open a case.
4. Open a workspace and verify:
   - snapshot counts and stage render in the graph header area;
   - graph nodes render, can be selected, and do not unexpectedly change route
     query params;
   - node editor text fields keep unsaved input during background refresh;
   - timeline revision controls appear only when history has more than one
     revision;
   - dragging the revision slider updates the visible revision and URL;
   - history mode freezes writes against past revisions;
   - evidence pool reads reusable evidence separately from graph nodes.
5. For graph viewport changes, inspect `.react-flow__viewport` and confirm the
   actual transform matches the intended scale.

If the launcher reports a live PID but the URL is unhealthy, follow
`docs/DEV/start-sh-runbook.md` before judging the application broken.

## Logging And Failure Evidence

Every bug fix or feature that changes runtime behavior should leave enough
structured logs to explain future failures. Prefer stable event names and small
payloads.

Existing examples to preserve:

- Console workspace load: `[investigation-console-v2] workspace-loaded`.
- Console session lifecycle: `[investigation-console] session-issued` and
  `[investigation-console] session-refreshed`.
- Missing BFF token: `console_bff.session_token_missing`.
- Real-backend E2E setup: `real_backend_e2e.runtime_prepared` and
  `real_backend_e2e.case_seeded`.
- Graph layout persistence: `graph.node_positions_restored` and
  `graph.node_position_persisted`.

When a regression fails, capture these before changing code:

```bash
git status --short
pnpm --filter <affected-package> test -- <target-test>
pnpm typecheck
```

For Playwright failures, inspect:

```bash
find apps/investigation-console-v2/test-results -maxdepth 3 -type f | sort
```

Then open the retained `error-context.md`, screenshots, or trace before
assuming the failing behavior is in the recently edited module.

## Test Data And Idempotency Rules

- E2E tests must use isolated runtime roots, not the default `.var/data`.
- Never seed real-backend E2E cases into the daily development store.
- Cleanup must be recoverable: move or back up runtime data before pruning it.
- Tests that create cases should use unique titles, objectives, or search terms.
- Regression tests should assert behavior, not timing-sensitive implementation
  details.
- If a test must wait for async UI state, wait on visible state or API response,
  not arbitrary long sleeps.

## Change Completion Rule

A change is not ready for handoff until the executed test lane matches the
affected surface:

1. Run the targeted lane while implementing.
2. Run the default post-change gate before final handoff.
3. If any gate is skipped, record the exact reason and the residual risk.
4. If a bug was fixed, verify the original symptom no longer reproduces.
5. If the fix required operational learning, update the relevant runbook in the
   same change.

This keeps review time focused on product judgment instead of discovering
avoidable build, type, contract, or console startup failures.
