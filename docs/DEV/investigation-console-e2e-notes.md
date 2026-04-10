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

- When doing ad hoc browser probes against the Vite dev server, prefer `domcontentloaded` plus an explicit short wait over `networkidle`; the latter can hang on persistent local activity and slow down quick regression checks.

## Drawer Header Layout

- In tight drawer headers with localized copy, keep secondary action buttons opted out of flex shrinking and text wrapping, otherwise short Chinese labels such as `关闭` can collapse into vertical text.

## Workspace Layout Regression

- When verifying `cases.$caseId.tsx` layout order, run Vitest with package-local paths such as `pnpm --filter @coe/investigation-console test -- test/case-workspace-layout.test.ts`.
- Passing workspace-root style paths into the package test script can miss the intended file filter because the script executes from `apps/investigation-console`.
- Keep a dedicated regression test for the main-column panel order so “案件图在上、时间线在下” does not silently flip during future workspace refactors.

## Graph Focus Recovery

- The case graph now needs an explicit “return to full graph” path whenever requests are made with `focusId`; otherwise the UI can get stuck on a focused slice after a node click.
- For React Flow based interactions, keep both a visible toolbar action and a pane-click fallback so users can recover from focused state without guessing hidden gestures.
- Regression coverage should verify both the visible control and the clear-focus callback path before changing graph selection behavior.

## Locale Toggle Verification

- Header locale selection follows a stable precedence order: explicit local preference first, then browser language detection.
- The console stores manual locale overrides in `localStorage["investigation-console.locale"]`; if verification looks “stuck,” clear that key before assuming browser detection is broken.
- Expected baseline behavior is English by default, with automatic switch to Simplified Chinese only when no stored override exists and the browser reports a `zh*` language preference.
- When validating regressions, check both the visible header labels and `document.documentElement.lang` so copy and accessibility state stay aligned.
