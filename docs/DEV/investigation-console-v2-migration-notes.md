# Investigation Console V2 Migration Notes

Updated: 2026-04-22

## 1. shadcn monorepo add path caveat

When `apps/investigation-console-v2/components.json` used package-style aliases such as `@coe/ui/components`, `shadcn add` resolved the target as a literal app-local path like:

```text
apps/investigation-console-v2/@coe/ui/components/*
```

instead of writing directly into `packages/ui/src/components/*`.

Working practice for this repo:
- keep `packages/ui` as the only shared UI source of truth
- review every `shadcn add` result immediately
- if the CLI writes into `apps/investigation-console-v2/@coe/ui/components`, move the files into `packages/ui/src/components`
- re-run typecheck after the move before using the new components

This keeps the monorepo boundary correct even when the CLI path resolution is imperfect.

## 2. Current startup shape

The v2 app is now the default Investigation Console frontend and owns its Fastify BFF entry under `apps/investigation-console-v2/server/index.ts`.

Current dev commands:

```bash
pnpm dev:console
pnpm --filter @coe/investigation-console-v2 dev
pnpm --filter @coe/investigation-console-v2 dev:web
pnpm --filter @coe/investigation-console-v2 dev:server
```

Default local ports:
- console web: `http://127.0.0.1:4173`
- console BFF: `http://127.0.0.1:4318`

## 3. Current verification shape

Use this order:

```bash
pnpm --filter @coe/investigation-console-v2 typecheck
pnpm --filter @coe/investigation-console-v2 test
pnpm --filter @coe/investigation-console-v2 build
pnpm --filter @coe/investigation-console-v2 test:e2e
```

The e2e runner starts:
- real-backend seeded BFF from `apps/investigation-console-v2/server/e2e-real.ts`
- v2 Vite web server
- Playwright smoke and real-backend flows in `apps/investigation-console-v2/e2e/*.spec.ts`

## 4. Shared-client follow-up checks

Because `apps/investigation-console-v2/src/lib/api.ts` and `src/lib/sse.ts` re-export shared code from `@coe/console-client`, any shared-client refactor should be followed by:

```bash
pnpm --filter @coe/investigation-console-v2 typecheck
pnpm --filter @coe/investigation-console-v2 test
```

## 5. Graph drag persistence

The v2 graph now persists dragged node positions in local storage so nodes do not snap back after selection changes or reloads.

Current behavior:
- drag start selects the dragged node
- drag stop writes persisted node positions to:

```text
investigation-console-v2.graph-node-positions:<caseId>:<revision-or-head>
```

- draft nodes keep their drag position for the current session through in-memory overrides
- persisted nodes restore from local storage on the next render/load

Operational note:
- if a future graph change appears to "forget" drag positions, inspect the browser local storage key first
- logs to look for:
  - `graph.node_positions_restored`
  - `graph.node_position_persisted`

## 6. Numeric typography with Raleway

The shadcn preset uses `Raleway Variable` as the app font. Its default numeral behavior can render digits with uneven heights that look unstable in IDs, counts, and inputs.

The current base style forces:

```css
font-variant-numeric: lining-nums tabular-nums;
font-feature-settings: "lnum" 1, "tnum" 1;
```

Keep these rules unless the product explicitly changes font behavior. If a future preset refresh reintroduces wobbly digits, check `packages/ui/src/styles/globals.css` first.
