# Frontend Copy Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove non-functional explanatory copy from the active web frontend while preserving functional titles, labels, controls, counts, errors, and business data.

**Architecture:** Clean the active route tree first, then remove dead translation keys and CSS that only exists to support promotional or instructional text blocks. Keep behavior stable by updating tests before and alongside UI copy removal.

**Tech Stack:** React 19, React Router, Vite, Vitest, Playwright, i18n message map

---

### Task 1: Lock cleanup scope with tests

**Files:**
- Modify: `apps/investigation-console/test/action-panel.test.ts`
- Modify: `apps/investigation-console/test/inspector-panel.test.ts`
- Modify: `apps/investigation-console/e2e/case-workspace.spec.ts`

**Steps:**
1. Replace assertions that depend on long explanatory sentences with assertions on controls, labels, and data-testid targets.
2. Keep coverage for historical-mode disabling and inspector/action availability.
3. Run targeted tests after each update.

### Task 2: Remove shell and list-page explanatory copy

**Files:**
- Modify: `apps/investigation-console/src/routes/__root.tsx`
- Modify: `apps/investigation-console/src/routes/cases.index.tsx`
- Modify: `apps/investigation-console/src/components/case-list.tsx`
- Modify: `apps/investigation-console/src/styles/molecules/layout.css`
- Modify: `apps/investigation-console/src/styles/app.css`

**Steps:**
1. Remove header kicker and promo badges from the root shell.
2. Remove the case-list hero block and toolbar status chatter.
3. Collapse empty-state copy to a minimal functional heading.
4. Keep search, navigation, case titles, metadata, and links intact.

### Task 3: Strip explanatory copy from workspace panels

**Files:**
- Modify: `apps/investigation-console/src/routes/cases.$caseId.tsx`
- Modify: `apps/investigation-console/src/components/snapshot-view.tsx`
- Modify: `apps/investigation-console/src/components/coverage-view.tsx`
- Modify: `apps/investigation-console/src/components/guardrail-view.tsx`
- Modify: `apps/investigation-console/src/components/timeline-view.tsx`
- Modify: `apps/investigation-console/src/components/inspector-panel.tsx`
- Modify: `apps/investigation-console/src/components/inspector/inspector-shell.tsx`
- Modify: `apps/investigation-console/src/components/graph/GraphCanvas.tsx`

**Steps:**
1. Keep panel titles and data chips; remove helper paragraphs and long empty-state guidance.
2. Shorten historical-mode and diff-state text to minimal status indicators.
3. Keep inspector section titles and linked item lists; remove narrative summaries from panel rendering.
4. Keep graph empty state minimal.

### Task 4: Strip instructional copy from action forms

**Files:**
- Modify: `apps/investigation-console/src/components/action-panel.tsx`

**Steps:**
1. Remove top-of-panel description text.
2. Keep labels and buttons, but remove or minimize explanatory placeholders.
3. Reduce confirmation and historical-mode text to minimal functional wording.

### Task 5: Remove unused i18n keys and CSS

**Files:**
- Modify: `apps/investigation-console/src/lib/i18n.tsx`
- Modify: `apps/investigation-console/src/styles/app.css`

**Steps:**
1. Delete message keys no longer rendered by active components.
2. Remove obsolete hero/empty/promo styles and preserve layout integrity after simplification.

### Task 6: Verify

**Commands:**
- `pnpm --filter @coe/investigation-console test`
- `pnpm --filter @coe/investigation-console typecheck`

**Expected:**
- Tests pass
- Typecheck passes
- No copy-only regressions in the active route tree
