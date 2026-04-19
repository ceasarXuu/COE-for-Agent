# Frontend Canonical Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all remaining legacy investigation UI paths from the console and make the frontend canonical-only to match the backend.

**Architecture:** The workspace becomes a single canonical experience built around `problem`, `hypothesis`, `blocker`, `repair_attempt`, and `evidence_ref`. Delete the mixed-mode route branching, legacy action rail, legacy graph node registry, and legacy fixture data instead of trying to keep adapter layers alive. Keep the right rail focused on canonical inspector, canonical actions, timeline, and a thin canonical guardrail summary.

**Tech Stack:** React 19, React Router, React Flow, TypeScript, Vitest, Playwright, Fastify BFF

---

**Implementation notes**

- Stay on the current branch/worktree unless the user explicitly approves a new branch. Repo policy forbids opening a new branch without permission.
- Prefer deletion over adapter code. The backend no longer exposes legacy commands, so any legacy frontend entrypoint that remains is now dead weight.
- TDD still applies: write or update failing tests first, run them, then remove or simplify code.
- Commit at the end of each task slice and push immediately.

### Task 1: Make The Workspace Route Canonical-Only

**Files:**
- Modify: `apps/investigation-console/src/routes/cases.$caseId.tsx`
- Modify: `apps/investigation-console/src/routes/case-workspace-inspector.ts`
- Modify: `apps/investigation-console/src/lib/api.ts`
- Test: `apps/investigation-console/test/case-workspace-layout.test.ts`

**Step 1: Write the failing layout and contract assertions**

- Update `case-workspace-layout.test.ts` so it asserts:
  - `cases.$caseId.tsx` no longer imports `ActionPanel`
  - `cases.$caseId.tsx` no longer imports `GuardrailView`
  - `cases.$caseId.tsx` no longer uses `isCanonicalGraphProjection`
  - `cases.$caseId.tsx` no longer reads `defaultInquiryId`
  - the route always renders `CanonicalActionPanel`
- Update `CaseSnapshotEnvelope` / `CreateCaseResult` expectations in tests to use canonical-only fields:
  - `problemId`
  - canonical `counts`

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @coe/investigation-console exec vitest run test/case-workspace-layout.test.ts
```

Expected: FAIL because the route still imports legacy workspace modules.

**Step 3: Implement the route simplification**

- Remove `ActionPanel`, `GuardrailView`, and `isCanonicalGraphProjection` from `cases.$caseId.tsx`
- Always render `CanonicalActionPanel`
- Keep `TimelineView`
- Simplify `selectedNode` flow so there is no legacy/canonical branch split
- In `case-workspace-inspector.ts`, remove legacy `fact / experiment / decision / gap / residual / inquiry` cases
- Keep only `problem / hypothesis / blocker / repair_attempt / evidence_ref / node`
- In `lib/api.ts`, remove any remaining route-facing need for `defaultInquiryId` in workspace types

**Step 4: Run the tests again**

Run:

```bash
pnpm --filter @coe/investigation-console exec vitest run test/case-workspace-layout.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/investigation-console/src/routes/cases.$caseId.tsx \
  apps/investigation-console/src/routes/case-workspace-inspector.ts \
  apps/investigation-console/src/lib/api.ts \
  apps/investigation-console/test/case-workspace-layout.test.ts
git commit -m "refactor(console): make workspace route canonical only"
git push
```

### Task 2: Replace The Legacy Action Rail With Canonical Controls Only

**Files:**
- Delete: `apps/investigation-console/src/components/action-panel/ActionPanel.tsx`
- Delete: `apps/investigation-console/src/components/action-panel/ConfirmDialog.tsx`
- Delete: `apps/investigation-console/src/components/action-panel/ExperimentControls.tsx`
- Delete: `apps/investigation-console/src/components/action-panel/GapControls.tsx`
- Delete: `apps/investigation-console/src/components/action-panel/HypothesisControls.tsx`
- Delete: `apps/investigation-console/src/components/action-panel/InquiryControls.tsx`
- Delete: `apps/investigation-console/src/components/action-panel/ResidualControls.tsx`
- Delete: `apps/investigation-console/src/components/action-panel/SymptomControls.tsx`
- Delete: `apps/investigation-console/src/components/action-panel/useActionHandlers.ts`
- Delete: `apps/investigation-console/src/components/action-panel/useActionPanelState.ts`
- Delete: `apps/investigation-console/src/components/action-panel/index.ts`
- Delete: `apps/investigation-console/src/components/action-panel/types.ts`
- Modify: `apps/investigation-console/src/components/action-panel/CanonicalActionPanel.tsx`
- Create: `apps/investigation-console/src/components/canonical-guardrail-summary.tsx`
- Delete: `apps/investigation-console/src/components/guardrail-view.tsx`
- Test: `apps/investigation-console/test/action-panel.test.ts`
- Test: `apps/investigation-console/test/guardrail-view.test.ts`

**Step 1: Write replacement tests**

- Replace `action-panel.test.ts` with a new canonical suite that asserts:
  - problem autosave fields render
  - hypothesis confirm/block/reject actions render
  - blocker close renders
  - repair attempt running/effective/ineffective renders
  - evidence ref is read-only
- Replace `guardrail-view.test.ts` with a `canonical-guardrail-summary` test:
  - active blockers are highlighted
  - close-case readiness is visible
  - no legacy labels like “gap”, “residual”, or “inquiry” remain

**Step 2: Run failing tests**

Run:

```bash
pnpm --filter @coe/investigation-console exec vitest run test/action-panel.test.ts test/guardrail-view.test.ts
```

Expected: FAIL because the old files and expectations are still legacy-shaped.

**Step 3: Implement the canonical action rail**

- Delete the legacy action-panel stack
- Expand `CanonicalActionPanel.tsx` to be the only action surface
- Add a thin `canonical-guardrail-summary.tsx` that reads the existing guardrail bundle without legacy labels
- Mount the new summary in the workspace rail under the canonical action panel

**Step 4: Re-run tests**

Run:

```bash
pnpm --filter @coe/investigation-console exec vitest run test/action-panel.test.ts test/guardrail-view.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/investigation-console/src/components/action-panel \
  apps/investigation-console/src/components/canonical-guardrail-summary.tsx \
  apps/investigation-console/src/routes/cases.$caseId.tsx \
  apps/investigation-console/test/action-panel.test.ts \
  apps/investigation-console/test/guardrail-view.test.ts
git commit -m "refactor(console): remove legacy action rail"
git push
```

### Task 3: Remove Legacy Graph Nodes And Overlay Paths

**Files:**
- Modify: `apps/investigation-console/src/components/graph/GraphCanvas.tsx`
- Delete: `apps/investigation-console/src/components/graph/isCanonicalGraphProjection.ts`
- Delete: `apps/investigation-console/src/components/graph/useGraphOverlay.ts`
- Modify: `apps/investigation-console/src/components/graph/useGraphLayout.ts`
- Modify: `apps/investigation-console/src/components/graph/graph-node-presentation.ts`
- Delete:
  - `apps/investigation-console/src/components/graph/nodes/ArtifactNode.tsx`
  - `apps/investigation-console/src/components/graph/nodes/DecisionNode.tsx`
  - `apps/investigation-console/src/components/graph/nodes/ExperimentNode.tsx`
  - `apps/investigation-console/src/components/graph/nodes/FactNode.tsx`
  - `apps/investigation-console/src/components/graph/nodes/GapNode.tsx`
  - `apps/investigation-console/src/components/graph/nodes/InquiryNode.tsx`
  - `apps/investigation-console/src/components/graph/nodes/ResidualNode.tsx`
  - `apps/investigation-console/src/components/graph/nodes/SymptomNode.tsx`
  - `apps/investigation-console/src/components/graph/nodes/IssueNode.tsx`
  - `apps/investigation-console/src/components/graph/nodes/EntityNode.tsx`
- Test: `apps/investigation-console/test/graph-canvas-selection.test.ts`
- Test: `apps/investigation-console/test/graph-mode.test.ts`
- Test: `apps/investigation-console/e2e/case-workspace.spec.ts`

**Step 1: Update failing tests**

- Rewrite `graph-canvas-selection.test.ts` to use only canonical node kinds
- Remove `graph-mode.test.ts` entirely, or replace it with a test that asserts the graph is always canonical-only
- Update Playwright assertions in `case-workspace.spec.ts`:
  - remove right-click blank-canvas creation expectations
  - remove legacy hypothesis/experiment/gap/decision interactions
  - keep drag-create from canonical parent handles

**Step 2: Run tests to see failures**

Run:

```bash
pnpm --filter @coe/investigation-console exec vitest run test/graph-canvas-selection.test.ts test/graph-mode.test.ts
```

Expected: FAIL due to legacy node registry and mixed layout assumptions.

**Step 3: Implement graph cleanup**

- In `GraphCanvas.tsx`, keep only canonical node types
- Remove blank-pane context menu and legacy overlay writes
- Keep only canonical drag-create from node handles
- Remove legacy lane kinds from `useGraphLayout.ts`
- Remove legacy presentation normalization from `graph-node-presentation.ts`

**Step 4: Run graph tests and browser checks**

Run:

```bash
pnpm --filter @coe/investigation-console exec vitest run test/graph-canvas-selection.test.ts
CONSOLE_WEB_PORT=4206 CONSOLE_BFF_PORT=4346 pnpm --filter @coe/investigation-console exec playwright test e2e/case-workspace.spec.ts --reporter=line
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/investigation-console/src/components/graph \
  apps/investigation-console/test/graph-canvas-selection.test.ts \
  apps/investigation-console/test/graph-mode.test.ts \
  apps/investigation-console/e2e/case-workspace.spec.ts
git commit -m "refactor(console): remove legacy graph nodes"
git push
```

### Task 4: Canonicalize Inspectors And Delete Legacy Inspector Components

**Files:**
- Modify: `apps/investigation-console/src/components/inspector-panel.tsx`
- Modify: `apps/investigation-console/src/routes/case-workspace-inspector.ts`
- Delete:
  - `apps/investigation-console/src/components/inspector/decision-inspector.tsx`
  - `apps/investigation-console/src/components/inspector/experiment-inspector.tsx`
  - `apps/investigation-console/src/components/inspector/fact-inspector.tsx`
  - `apps/investigation-console/src/components/inspector/gap-inspector.tsx`
  - `apps/investigation-console/src/components/inspector/residual-inspector.tsx`
- Test: `apps/investigation-console/test/inspector-panel.test.ts`

**Step 1: Rewrite failing inspector tests**

- Replace legacy inspector cases with canonical ones only:
  - `problem`
  - `hypothesis`
  - `blocker`
  - `repair_attempt`
  - `evidence_ref`
- Remove assertions for legacy titles such as “Linked hypotheses”, “Risk treatment”, “Expected outcomes” when they belong to deleted node types

**Step 2: Run failing tests**

Run:

```bash
pnpm --filter @coe/investigation-console exec vitest run test/inspector-panel.test.ts
```

Expected: FAIL because legacy inspector paths still exist.

**Step 3: Implement inspector cleanup**

- Delete the legacy inspector components
- Simplify `inspector-panel.tsx` to a canonical switch
- Simplify `case-workspace-inspector.ts` to canonical graph relationships only

**Step 4: Run tests**

Run:

```bash
pnpm --filter @coe/investigation-console exec vitest run test/inspector-panel.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/investigation-console/src/components/inspector* \
  apps/investigation-console/src/routes/case-workspace-inspector.ts \
  apps/investigation-console/test/inspector-panel.test.ts
git commit -m "refactor(console): remove legacy inspectors"
git push
```

### Task 5: Rewrite Fixture Data And Browser Flows To Canonical-Only

**Files:**
- Modify: `apps/investigation-console/e2e/fixture-mcp-client.ts`
- Modify: `apps/investigation-console/e2e/fixtures/types.ts`
- Modify: `apps/investigation-console/e2e/fixtures/revision-data.ts`
- Modify: `apps/investigation-console/e2e/history-mode.spec.ts`
- Modify: `apps/investigation-console/e2e/case-workspace.spec.ts`
- Modify: `apps/investigation-console/test/fixture-mcp-client.test.ts`

**Step 1: Write or update failing fixture tests**

- `fixture-mcp-client.test.ts` should assert the fixture model exposes only canonical graph data
- Remove any remaining expectations around:
  - `inquiryPanel`
  - `hypothesisPanel`
  - legacy `coverage`
  - legacy issue or artifact writes

**Step 2: Run failing tests**

Run:

```bash
pnpm --filter @coe/investigation-console exec vitest run test/fixture-mcp-client.test.ts
```

Expected: FAIL because fixture data still models inquiry/symptom/fact/experiment revisions.

**Step 3: Implement fixture rewrite**

- Replace `RevisionState` and revision fixtures with canonical-only snapshots
- Use only canonical events in the timeline fixture
- Drop legacy node ids from `FIXTURE_IDS`
- Keep manual-case creation wired to canonical commands only

**Step 4: Run tests and e2e**

Run:

```bash
pnpm --filter @coe/investigation-console exec vitest run test/fixture-mcp-client.test.ts
CONSOLE_WEB_PORT=4207 CONSOLE_BFF_PORT=4347 pnpm --filter @coe/investigation-console exec playwright test e2e/history-mode.spec.ts e2e/case-workspace.spec.ts --reporter=line
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/investigation-console/e2e \
  apps/investigation-console/test/fixture-mcp-client.test.ts
git commit -m "test(console): canonicalize fixture data"
git push
```

### Task 6: Remove Dead Presentation And Demo Components

**Files:**
- Delete: `apps/investigation-console/src/components/graph-scene.tsx`
- Delete: `apps/investigation-console/src/components/graph-scene-layout.ts`
- Delete: `apps/investigation-console/test/graph-scene.test.ts`
- Delete: `apps/investigation-console/test/graph-scene-controls.test.ts`
- Delete any unused node-card variants or helper files discovered by TypeScript after Tasks 1-5

**Step 1: Write the failing proof**

- Run `tsc --noEmit` and `rg` to verify these files are no longer imported anywhere in `src/`

**Step 2: Remove dead files**

- Delete them once imports are gone

**Step 3: Run package typecheck**

Run:

```bash
pnpm --filter @coe/investigation-console typecheck
```

Expected: PASS

**Step 4: Commit**

```bash
git add apps/investigation-console/src/components apps/investigation-console/test
git commit -m "refactor(console): delete dead legacy presentation files"
git push
```

### Task 7: Canonicalize Copy And Timeline Labels

**Files:**
- Modify: `apps/investigation-console/src/lib/i18n.tsx`
- Test: `apps/investigation-console/test/i18n.test.ts`
- Test: `apps/investigation-console/test/timeline-view.test.ts`

**Step 1: Update failing copy tests**

- Remove expectations for legacy event labels:
  - `fact.asserted`
  - `decision.recorded`
  - `gap.opened`
  - `residual.updated`
  - `symptom.reported`
- Add expectations for canonical event labels:
  - `problem.updated`
  - `problem.status_updated`
  - `canonical.hypothesis.created`
  - `canonical.hypothesis.status_updated`
  - `canonical.blocker.opened`
  - `canonical.repair_attempt.created`
  - `canonical.evidence.attached`

**Step 2: Run failing tests**

Run:

```bash
pnpm --filter @coe/investigation-console exec vitest run test/i18n.test.ts test/timeline-view.test.ts
```

Expected: FAIL because old copy still exists.

**Step 3: Replace the strings**

- Remove unused legacy labels and action copy
- Add canonical event and field labels
- Keep bilingual parity between English and Chinese

**Step 4: Re-run tests**

Run:

```bash
pnpm --filter @coe/investigation-console exec vitest run test/i18n.test.ts test/timeline-view.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/investigation-console/src/lib/i18n.tsx \
  apps/investigation-console/test/i18n.test.ts \
  apps/investigation-console/test/timeline-view.test.ts
git commit -m "refactor(console): remove legacy copy vocabulary"
git push
```

### Task 8: Final Validation And Deletion Sweep

**Files:**
- Modify as needed based on failing imports or tests from previous tasks

**Step 1: Run full package validation**

Run:

```bash
pnpm --filter @coe/investigation-console typecheck
pnpm --filter @coe/investigation-console test
CONSOLE_WEB_PORT=4208 CONSOLE_BFF_PORT=4348 pnpm --filter @coe/investigation-console test:e2e
```

Expected: All green

**Step 2: Run repository grep sweep**

Run:

```bash
rg -n "defaultInquiryId|ActionPanel|GuardrailView|symptom|artifact|fact|experiment|decision|gap|residual|inquiry" apps/investigation-console/src -g '!**/dist/**'
```

Expected:
- only canonical problem field names like `symptoms` inside `problem` payload may remain
- no legacy components or command names remain in runtime source

**Step 3: Clean any leftover dead tests or fixtures**

- Delete any last files that are only preserved by now-obsolete test scaffolding

**Step 4: Final commit**

```bash
git add apps/investigation-console docs/plans/2026-04-19-frontend-canonical-cleanup.md
git commit -m "refactor(console): purge legacy frontend model"
git push
```

Plan complete and saved to `docs/plans/2026-04-19-frontend-canonical-cleanup.md`.

Two execution options:

1. Subagent-Driven (this session) - I execute the plan slice-by-slice here, reviewing each cleanup slice before moving on.
2. Parallel Session (separate) - Open a fresh execution session and drive this plan task-by-task from the document.
