# Investigation Console V2 Migration Plan

Goal: rebuild the Investigation Console frontend as an isolated v2 surface using shadcn/ui, preserve the current business logic and BFF contract, and keep v1 available until v2 is verified and ready to become the default experience.

Scope:
- Create a new `apps/investigation-console-v2` frontend workspace.
- Create a shared `packages/ui` design-system package based on shadcn/ui preset `b37b8zzmt`.
- Extract API, SSE, and UI-state logic into a shared `packages/console-client` package.
- Migrate the current console workflows to the new v2 UI without reusing the legacy CSS system.
- Keep `apps/investigation-console` intact during migration.

Non-goals:
- No branch split or parallel product fork.
- No rewrite of the Fastify BFF contract or MCP server.
- No deletion of v1 during the initial v2 implementation round.

## 1. Refactor Boundary

This migration is a frontend-surface rewrite, not a backend rewrite.

Reuse:
- `apps/investigation-console/server/*`
- MCP resources and tools consumed through the BFF
- fetch contracts and payload shapes
- revision and node-selection behavior

Rebuild:
- app shell
- routes and page composition
- all visual components
- all CSS and tokens
- all user-facing interactions that currently depend on legacy class names

The migration boundary is the whole Investigation Console frontend view layer.

## 2. Legacy Contamination Map

The current frontend is not safe to evolve in place:

- `apps/investigation-console/src/styles/main.css` imports the full legacy style stack from one global entrypoint.
- `reset.css` styles `html`, `body`, `a`, `button`, `input`, `textarea`, `select`, list tags, scrollbars, and text selection globally.
- `app.css` still defines generic classes such as `.panel`, descendant rules such as `.panel h3`, and bare input selectors such as `textarea, input, select`.
- `atoms/button.css` and `atoms/card.css` keep compatibility-era class systems like `.btn`, `.card`, and `.btn-primary`.
- The current layout and components are visually coupled to those classes, so any redesign in the same workspace will remain inside the same pollution domain.

Conclusion: v2 must live in a separate frontend workspace with its own CSS entry and component namespace.

## 3. Recommended Isolation Strategy

Isolation strategy:
1. Separate workspace for v2 frontend.
2. Separate shared UI package for shadcn/ui components.
3. Separate shared logic package for API and state code.

This is sufficient because the main risk is CSS and component-system contamination, not host-page embedding. Shadow DOM is unnecessary. A route-level namespace alone is also insufficient because the legacy app imports global resets and generic classes at the app root.

## 4. Framework and Library Decision

Decision:
- `apps/investigation-console-v2`: Vite + React 19 + React Router DOM
- `packages/ui`: shadcn/ui monorepo package
- `packages/console-client`: shared API/state/SSE package

Reasoning:
- The existing console is already a Vite SPA with a Fastify BFF and proxy setup.
- There is no SSR or SEO requirement that justifies a framework jump to Next.js.
- Keeping Vite reduces migration cost and lets both v1 and v2 run side-by-side with minimal operational churn.
- shadcn/ui monorepo support allows us to centralize components in `packages/ui` and reuse them in future projects.

Preset baseline:
- shadcn/ui preset `b37b8zzmt`
- style: `radix-nova`
- base color: `olive`
- icon library: `tabler`
- font: `Raleway`
- Tailwind CSS v4

## 5. V2 Workspace Layout

Target structure:

```text
apps/
  investigation-console/        # v1, unchanged during migration
  investigation-console-v2/     # new Vite frontend
packages/
  console-client/               # shared types, api, sse, state, helpers
  ui/                           # shadcn/ui package
```

`packages/console-client` responsibilities:
- resource and mutation API clients
- session helpers
- SSE stream client
- revision and selection store
- shared typed helpers used by v1 and v2

`packages/ui` responsibilities:
- shadcn/ui primitives installed by CLI
- shared utility functions
- shared app-shell and reusable composed controls
- theme tokens and global CSS for the shadcn preset

`apps/investigation-console-v2` responsibilities:
- page routes
- v2 page-level composition
- React Flow integration layer
- v2-specific composed panels and feature widgets

## 6. View Rewrite Decision

Reuse logic, redo the view.

The v2 implementation should not reuse legacy visual components or class names. It may reuse business logic and protocol code, but it should rebuild DOM structure and styling from scratch.

Expected v2 surface:
- Cases list page
- Create case dialog
- Workspace shell
- Timeline and revision controls
- Graph stage
- Node editor / inspector rail
- Loading, empty, and error states

Target reuse rate:
- 90%+ of non-graph UI should come from shadcn/ui components or thin compositions built from them.
- Custom code should remain concentrated in React Flow nodes, graph layout/interaction, and domain-specific data mapping.

## 7. Migration Sequence

Phase 1: foundation
- add `packages/ui`
- add `packages/console-client`
- add `apps/investigation-console-v2`
- wire workspace scripts, typecheck, and dev flow

Phase 2: shared logic extraction
- move `lib/api.ts` into `packages/console-client`
- move SSE logic into `packages/console-client`
- move store logic into `packages/console-client`
- update v1 imports to prove the extraction works before heavy v2 UI work

Phase 3: v2 app shell and routes
- create v2 root layout
- create cases page
- create workspace page
- keep graph integration thin and isolated

Phase 4: migrate workflows
- create case
- list/search/sort
- timeline and revision switching
- node selection and editing
- evidence pool integration
- mutation completion refreshes

Phase 5: verification and cutover prep
- run targeted tests for shared logic and v2 routes
- run Playwright against v2
- keep v1 and v2 available behind explicit scripts/ports
- only consider default-route cutover after v2 passes behavior and visual checks

## 8. Cutover Strategy

During migration:
- v1 remains on its current app path and scripts.
- v2 gets its own dev script and its own port.
- both frontends talk to equivalent BFF routes.

Before default cutover:
- v2 must match the core user workflows
- regression suite must pass
- v2 screenshots must look correct on desktop and mobile breakpoints
- legacy CSS dependencies must remain confined to v1

After default cutover:
- switch the main console start command to v2
- keep v1 available temporarily as an explicit fallback
- delete v1 only after dependency and visual audits confirm it is unused

## 9. Verification Standard

Required verification:
- `pnpm typecheck`
- targeted unit tests for shared logic and v2 view composition
- Playwright flow for cases list, create case, workspace, graph selection, and node editing
- manual smoke run of v1 and v2 side-by-side

Visual gates:
- no v1 stylesheet imported by v2
- no generic legacy class names added to v2
- graph still renders and remains interactive
- form focus, dialog, sheet, and scroll behavior work with the shadcn theme

## 10. Operational Notes

- Do not open a new branch; stay on `main` per repo instruction.
- Commit and push at the end of each completed migration slice.
- Add explicit console logs for important v2 user flows and migration-sensitive state changes.
- Record any setup or migration pitfalls in docs as they are discovered so future frontend migrations do not repeat the same trial-and-error.
