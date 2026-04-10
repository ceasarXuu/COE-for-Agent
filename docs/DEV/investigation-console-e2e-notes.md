# Investigation Console E2E Notes

## Startup

- `pnpm --filter @coe/investigation-console test:e2e` requires `CONSOLE_BFF_PORT=4318` and `CONSOLE_WEB_PORT=4173` to be free before the script starts.
- If `4318` is already occupied by a leftover local console server, stop that process first:

```bash
lsof -nP -iTCP:4318 -sTCP:LISTEN
kill <pid>
```

## Form Stability

- Manual create form handlers must read `event.currentTarget.value` before entering `setState` callbacks.
- Reading the synthetic event inside the updater callback can null out `currentTarget` and crash the drawer after the first keystroke.

## Verification

- Stable local verification for the web console remains:

```bash
pnpm --filter @coe/investigation-console typecheck
pnpm --filter @coe/investigation-console test
pnpm --filter @coe/investigation-console test:e2e
```
