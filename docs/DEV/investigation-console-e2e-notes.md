# Investigation Console E2E Notes

## Startup

- `pnpm --filter @coe/investigation-console test:e2e` now prefers `CONSOLE_BFF_PORT=4318` and `CONSOLE_WEB_PORT=4173`, but when those defaults are already occupied it automatically scans upward to the next free pair.
- If you explicitly pin `CONSOLE_BFF_PORT` or `CONSOLE_WEB_PORT`, the script treats those ports as strict requirements and will still fail fast when the requested port is already in use.
- If you want to inspect or reclaim a specific occupied port, use:

```bash
lsof -nP -iTCP:4318 -sTCP:LISTEN
kill <pid>
```

- When you only need a targeted browser regression and the default ports are already in use, do not kill unknown processes just to make the happy path work. You can still pin temporary ports yourself, for example `CONSOLE_WEB_PORT=4175` with `CONSOLE_BFF_PORT=4319`, and pass the same pair into the Playwright command.
- The same override pattern works for the full console e2e script as well, for example:

```bash
CONSOLE_WEB_PORT=4200 CONSOLE_BFF_PORT=4340 pnpm --filter @coe/investigation-console test:e2e
```

## Form Stability

- Manual create form handlers must read `event.currentTarget.value` before entering `setState` callbacks.
- Reading the synthetic event inside the updater callback can null out `currentTarget` and crash the drawer after the first keystroke.

## Node Editor Stability

- Saved-node editor drafts must sync on a stable selection key such as `nodeId + revision`, not on the raw `selectedNode` object identity.
- Background refreshes rebuild graph node objects even when the selected canonical node has not changed. If the editor effect depends on the whole object reference, unsaved input will be overwritten during innocuous workspace refreshes.
- A quick local probe is enough before escalating to a full e2e lane: select a saved node, type into a field, wait through at least one short refresh window, and confirm the field value still matches the typed content while the save button stays enabled.
- Keep a structured console log for editor resync boundaries. It gives a direct breadcrumb when someone reports “输入后又被打回去” and helps distinguish real draft resets from keyboard/focus issues.

## Graph Viewport Check

- For React Flow startup zoom changes, do not trust `defaultViewport` alone when `fitView` is enabled. The real cap must be enforced through `fitViewOptions.maxZoom`.
- The fastest browser verification is to inspect `.react-flow__viewport` and read its computed transform. A healthy “about 60%” startup now shows a matrix scale near `0.6`, for example `matrix(0.6, 0, 0, 0.6, ...)`.

## Verification

- Stable local verification for the web console remains:

```bash
pnpm --filter @coe/investigation-console typecheck
pnpm --filter @coe/investigation-console test
pnpm --filter @coe/investigation-console test:e2e
```

- When doing ad hoc browser probes against the Vite dev server, prefer `domcontentloaded` plus an explicit short wait over `networkidle`; the latter can hang on persistent local activity and slow down quick regression checks.
- For graph-create regressions, the fixture e2e lane is the quickest signal because it exercises drag-create on the real canvas without waiting on the seeded real-backend bootstrap path.
- If `test:e2e` fails only in the real-backend phase with the page stuck on `Loading workspace…`, inspect `apps/investigation-console/test-results/*/error-context.md` and the retained Playwright trace before assuming the graph create path regressed; the timeout can happen before the first graph resource is rendered.

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
- The blank-canvas graph context menu should expose only context-free concepts that can be persisted immediately: `issue` and `artifact`. Keep `fact`, `hypothesis`, `experiment`, and `decision` on context-aware flows such as the Action Panel, where the required supporting refs already exist.
- For graph edge-creation regressions, check both the React Flow contract and the physical layout. `nodesConnectable` plus `onConnect` must both be wired on the controlled canvas, and the rendered card width in CSS must stay aligned with `useGraphLayout` lane width; otherwise adjacent nodes can visually overlap and cover each other's handles even when connection logic is enabled.
- Case detail edits are now split across two persistence lanes: domain-safe mutations such as blank-canvas `issue` / `artifact` creation must go through backend tools immediately, while case-detail drafts and graph-only overlay edits such as textarea input, node repositioning, and manual edges must autosave to case-scoped local storage and survive reloads.
- Do not infer canonical mode from the mere presence of a `problem` node. Mixed legacy cases also carry a canonical root as sidecar state, and the stable client rule is: switch to canonical UI only when the graph has no legacy node kinds, or when canonical-only node kinds such as `blocker`, `repair_attempt`, or `evidence_ref` are present.

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
