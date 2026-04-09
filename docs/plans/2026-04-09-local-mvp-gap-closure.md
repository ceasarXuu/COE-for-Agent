# Local MVP Gap Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining local-MVP gaps so the product runs smoothly on a single developer machine with real end-to-end behavior, stable validation, and complete core reviewer workflows.

**Architecture:** Keep the existing two-app shape: Investigation Server remains the MCP-first source of truth, and Investigation Console remains the human review surface through its BFF. Do not add production-grade platform concerns; instead, remove local-only friction, replace demo-only seams on critical paths with real integrations, and finish the high-value workflows already implied by the domain model.

**Tech Stack:** Node.js 22, TypeScript, Fastify, React, React Router, PostgreSQL 16, Playwright, Vitest, Turbo, pnpm

---

### Task 1: Lock the Local-Only Product Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/DEV/technical-design.md`
- Test: none

**Step 1: Narrow the declared target**

Document that success means:
- fresh-machine local bootstrap works
- real MCP server + console path works
- core review workflows are complete
- automated checks are stable enough for local development

Explicitly mark out of scope:
- enterprise auth
- multi-tenant isolation
- org governance
- production deployment hardening

**Step 2: Add a concrete local acceptance checklist**

Include a short “done means” section with:
- `docker compose up -d`
- `pnpm install`
- `pnpm dev`
- open console
- create/read/update a case through real flows
- run local validation commands successfully

**Step 3: Review docs for conflicting promises**

Remove or demote statements that imply production readiness.

**Step 4: Commit**

Stage only the docs touched in this task.

### Task 2: Make Local Validation Deterministic

**Files:**
- Modify: `apps/investigation-console/scripts/run-e2e.mjs`
- Modify: `apps/investigation-console/package.json`
- Modify: `apps/investigation-console/playwright.config.ts`
- Modify: `package.json`
- Test: `apps/investigation-console/e2e/*.spec.ts`

**Step 1: Write a failing validation test/expectation**

Define the expected behavior:
- local e2e runner should fail fast if browsers are missing
- or install/check them automatically
- runner should always exit cleanly

**Step 2: Reproduce the current failure**

Run:
```bash
pnpm --filter @coe/investigation-console test:e2e
```

Expected current failure:
- hangs, or
- fails because browser binaries are not installed

**Step 3: Implement minimal runner hardening**

Update the runner so it:
- performs a browser dependency preflight
- surfaces failures clearly
- reliably tears down child processes
- avoids silent hangs

**Step 4: Verify the runner behavior**

Run:
```bash
pnpm --filter @coe/investigation-console test:e2e
```

Expected:
- tests run or fail with actionable output
- no orphan processes remain

**Step 5: Commit**

Stage only the runner/config files touched in this task.

### Task 3: Replace Demo-Only Console E2E Coverage on Critical Paths

**Files:**
- Modify: `apps/investigation-console/server/e2e.ts`
- Modify: `apps/investigation-console/e2e/case-workspace.spec.ts`
- Modify: `apps/investigation-console/e2e/history-mode.spec.ts`
- Create or Modify: `apps/investigation-console/e2e/helpers/*.ts`
- Test: `apps/investigation-console/e2e/*.spec.ts`

**Step 1: Write one failing real-backend e2e**

Cover one critical path against the real server and database:
- create/open case data
- navigate console
- perform a reviewer mutation
- observe revision update

**Step 2: Keep fixture-driven tests only where they add value**

Retain fixtures for purely visual or deterministic replay cases, but split out at least one real integration lane.

**Step 3: Implement a real local e2e harness**

Wire console e2e so a subset of tests runs against:
- real investigation server
- real local Postgres
- real BFF proxying

**Step 4: Verify both lanes**

Run:
```bash
pnpm --filter @coe/investigation-console test:e2e
```

Expected:
- core integration path uses the real backend
- deterministic replay/path-specific tests still pass

**Step 5: Commit**

Stage the harness and spec files touched in this task.

### Task 4: Finish the Core Reviewer Workflow Surface in Console

**Files:**
- Modify: `apps/investigation-console/src/components/action-panel.tsx`
- Modify: `apps/investigation-console/src/routes/cases.index.tsx`
- Modify: `apps/investigation-console/src/routes/cases.$caseId.tsx`
- Modify: `apps/investigation-console/src/lib/api.ts`
- Modify: `apps/investigation-console/src/lib/i18n.tsx`
- Modify: relevant inspector/view components under `apps/investigation-console/src/components/`
- Test: `apps/investigation-console/test/action-panel.test.ts`
- Test: `apps/investigation-console/e2e/case-workspace.spec.ts`

**Step 1: Write failing tests for missing high-value flows**

Cover the reviewer actions still missing or thinly covered:
- open/resolve gap end-to-end
- accept residual risk end-to-end
- record readiness decision with guardrail-aware behavior
- preserve list/workspace navigation state

**Step 2: Implement minimal UI and API plumbing**

Expose only the highest-value missing reviewer capabilities already supported by MCP.

Do not add a generic admin console.

**Step 3: Verify history-mode correctness**

Ensure all newly exposed writes:
- disable in historical mode
- require confirmToken where policy says so
- update revision-aware UI after success

**Step 4: Run focused tests**

Run:
```bash
pnpm --filter @coe/investigation-console test
pnpm --filter @coe/investigation-console test:e2e
```

**Step 5: Commit**

Stage only the console workflow files touched in this task.

### Task 5: Remove or Fence Remaining Stub/Placeholder Surface Area

**Files:**
- Modify: `apps/investigation-server/src/mcp/register-tools.ts`
- Modify: `apps/investigation-server/src/mcp/register-resources.ts`
- Modify: `apps/investigation-server/test/mcp/*.test.ts`
- Modify: `spec/*.md` as needed
- Test: server MCP/resource tests

**Step 1: Write failing tests for MCP metadata quality**

Assert that:
- tool descriptions are meaningful
- profile/resource metadata reflects actual local capabilities
- fallback/stub modes are not exposed in the normal local runtime path

**Step 2: Replace placeholder descriptions**

Change `Stub registration for ...` descriptions into real MCP-facing descriptions.

**Step 3: Fence fallback behavior**

Keep empty-envelope fallback only for explicit isolated test mode, or remove it where unnecessary in normal app wiring.

**Step 4: Verify MCP contract behavior**

Run:
```bash
pnpm --filter @coe/investigation-server test
```

Focus on MCP and resource tests.

**Step 5: Commit**

Stage only MCP metadata/runtime files touched in this task.

### Task 6: Ship a One-Pass Local Developer Workflow

**Files:**
- Modify: `README.md`
- Modify: root `package.json`
- Modify: `apps/investigation-console/package.json`
- Modify: `apps/investigation-server/package.json`
- Create or Modify: helper scripts under `ops/` or app `scripts/`
- Test: smoke-run commands only

**Step 1: Define the supported local command set**

Target commands:
- bootstrap dependencies
- start local stack
- run server tests
- run console tests
- run e2e

**Step 2: Implement missing glue scripts**

Add the minimum scripts needed so a new developer can go from clone to working demo without manual debugging.

Examples:
- browser preinstall
- local reset/seed
- e2e prerequisite check

**Step 3: Verify the top-level workflow**

Run:
```bash
pnpm install
docker compose up -d
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Record which commands pass and which ones still need documented caveats.

**Step 4: Commit**

Stage only workflow/script/doc files touched in this task.

### Task 7: Final Local MVP Closure Pass

**Files:**
- Modify: `README.md`
- Modify: `docs/DEV/technical-design.md`
- Modify: any touched tests if flaky
- Test: full local validation set

**Step 1: Re-run the full local checklist**

Run the local acceptance checklist from Task 1.

**Step 2: Remove stale caveats**

Delete doc statements that no longer match reality.

**Step 3: Write a short known-limitations section**

Keep only local-MVP-relevant residual gaps, such as:
- unsupported UI actions not needed for demo
- performance not tuned
- no remote deployment story

**Step 4: Final verification**

Run:
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Expected:
- local developer path is reproducible
- core reviewer workflows are complete
- validation output is stable enough for iteration

**Step 5: Commit**

Create a final closure commit for the local-MVP completion pass.
