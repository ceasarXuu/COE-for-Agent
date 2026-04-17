# Investigation Console E2E Notes

## Startup

- `pnpm --filter @coe/investigation-console test:e2e` requires `CONSOLE_BFF_PORT=4318` and `CONSOLE_WEB_PORT=4173` to be free before the script starts.
- If `4318` is already occupied by a leftover local console server, stop that process first:

```bash
lsof -nP -iTCP:4318 -sTCP:LISTEN
kill <pid>
```

- When you only need a targeted browser regression and the default ports are already in use, do not kill unknown processes just to make the happy path work. Start the Vite app and fixture BFF on temporary ports instead, for example `CONSOLE_WEB_PORT=4175` with `CONSOLE_BFF_PORT=4319`, and pass the same pair into the Playwright command.

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

## Graph Selection Behavior

- The case graph in `cases.$caseId.tsx` is now a stable full-graph view; node selection should only refresh the inspector and must not alter graph query params or enter a focused slice mode.
- Keep `getCaseGraph` requests revision-aware only in the workspace route unless the product explicitly reintroduces subgraph behavior.
- Regression coverage should verify both the route contract and the React Flow props so future graph work does not silently reintroduce focus chips, pane-clear behavior, or selection-driven layout changes.
- For graph context-menu regressions, verify both sides of the React Flow contract: the canvas menu must bind through `onPaneContextMenu`, and the flow instance used for `screenToFlowPosition` must come from `onInit` instead of the wrapper `ref`.
- For graph context-menu dismissal, do not restrict outside-click detection to `HTMLElement` targets or bubble-phase listeners. React Flow can route canvas clicks through SVG elements and internal handlers, so the stable fix is a capture-phase listener that treats any non-`.context-menu` `Element` as an outside click.

## Snapshot Placement

- Snapshot context no longer renders as a standalone side-rail card in the workspace; stage, severity, objective, and the inquiry/symptom/artifact/fact badges now live in the graph header area.
- If the workspace layout changes again, verify both the route structure and the graph header rendering together so a blank summary rail is not reintroduced.

## Workspace Pruning

- The case detail side rail no longer mounts the standalone guardrail panel or diff summary panel; keep the workspace focused on graph, timeline, inspector, and actions unless those modules regain a clear decision-making use case.
- When pruning detail-page modules, also remove dead data fetches from the route so the page does not keep paying network and render cost for hidden panels.
- Case-level stage advancement no longer lives in a fixed “next action” block; detail-page mutations should be driven from selected graph nodes and their related domain actions instead of a process-oriented control panel.
- The side rail is now reserved for the timeline; when removing inspector or action panels from the workspace, also strip their selection state and resource reads so graph clicks do not keep hidden UI state alive.

## Locale Toggle Verification

- Header locale selection follows a stable precedence order: explicit local preference first, then browser language detection.
- The console stores manual locale overrides in `localStorage["investigation-console.locale"]`; if verification looks “stuck,” clear that key before assuming browser detection is broken.
- Expected baseline behavior is English by default, with automatic switch to Simplified Chinese only when no stored override exists and the browser reports a `zh*` language preference.
- When validating regressions, check both the visible header labels and `document.documentElement.lang` so copy and accessibility state stay aligned.

## Workspace Height Chain

- For the case detail page, full-height graph and timeline panels depend on the entire chain staying shrinkable: `layout-main -> workspace-shell -> workspace-grid -> workspace-main/workspace-rail`.
- The root `.layout` must also be pinned to the viewport with an explicit height, not just `min-height`; otherwise the workspace can still grow the whole page past the browser bottom after graph content loads.
- If either the parent flex container loses `min-height: 0`, or the grid keeps `align-items: start`, the right-hand timeline will collapse back to content height and the graph will stop consuming the remaining viewport.
- Keep the timeline panel itself as a flex column with the event list scrolling internally; that preserves a full-height shell without forcing the whole page to grow with long histories.

## Revision Slider Visibility

- Timeline revision controls should stay hidden when the case has fewer than two revisions; showing a `1 -> 1` slider adds noise without adding any history navigation value.
- The stable regression check is package-local: `pnpm --filter @coe/investigation-console test -- timeline-view.test.ts`.
- Keep the guard in `TimelineView` itself so any caller that passes revision controls for a single-revision snapshot still renders the correct UI.

## Revision Slider Dragging

- Keep the revision range input on a local draft value while dragging, then let route state catch up; binding the thumb directly to async workspace revision state makes the slider feel like it snaps back before the pointer reaches the end.
- Do not wire both `onChange` and `onInput` on the same React range input. React already normalizes range updates through `onChange`, and doubling the handler causes duplicate navigation churn during drag.
- A quick manual regression check is enough when fixture servers are running: drag the slider to the far left and far right and confirm both the visible revision label and the URL reach `?revision=1` and head mode respectively.
