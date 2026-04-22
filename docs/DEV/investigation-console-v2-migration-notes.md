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

## 2. Current v2 startup shape

The v2 app is a new frontend only. It intentionally reuses the existing Fastify BFF entry from `apps/investigation-console/server/index.ts`.

Current dev commands:

```bash
pnpm --filter @coe/investigation-console-v2 dev
pnpm --filter @coe/investigation-console-v2 dev:web
pnpm --filter @coe/investigation-console-v2 dev:server
```

Default local ports:
- v2 web: `http://127.0.0.1:4273`
- shared console BFF: `http://127.0.0.1:4318`

Root shortcut:

```bash
pnpm dev:v2
```

## 3. Current v2 verification shape

Use this order:

```bash
pnpm --filter @coe/investigation-console-v2 typecheck
pnpm --filter @coe/investigation-console-v2 test
pnpm --filter @coe/investigation-console-v2 build
pnpm --filter @coe/investigation-console-v2 test:e2e
```

The e2e runner starts:
- existing fixture BFF from `apps/investigation-console/server/e2e.ts`
- v2 Vite web server
- Playwright smoke flow in `apps/investigation-console-v2/e2e/console-smoke.spec.ts`

## 4. v1 compatibility check

Because `apps/investigation-console/src/lib/api.ts`, `src/lib/sse.ts`, and `src/store/ui-store.ts` now re-export shared code from `@coe/console-client`, any shared-client refactor should be followed by:

```bash
pnpm --filter @coe/investigation-console typecheck
pnpm --filter @coe/investigation-console test
```

That is the fastest guard against silently breaking the legacy frontend while v2 is still in parallel rollout.
