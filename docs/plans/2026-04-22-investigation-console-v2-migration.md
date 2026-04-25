# Investigation Console V2 Migration Plan

Date: 2026-04-22
Updated: 2026-04-25

## Status

Implemented. Console v2 is the current console.

## Current Boundaries

- Browser UI: `apps/investigation-console-v2/src`.
- BFF: `apps/investigation-console-v2/server`.
- Shared API and i18n: `packages/console-client`.
- Shared UI primitives: `packages/ui`.
- Server adapter: `@coe/investigation-server/console-adapter`.

The BFF must depend on the adapter export, not server source files.

## Current Startup

```bash
pnpm dev:console
pnpm --filter @coe/investigation-console-v2 dev
```

Default ports:

- web: `http://127.0.0.1:4173`
- BFF: `http://127.0.0.1:4318`

## Current Verification

```bash
pnpm --filter @coe/investigation-console-v2 typecheck
pnpm --filter @coe/investigation-console-v2 test
pnpm --filter @coe/investigation-console-v2 test:e2e
```
