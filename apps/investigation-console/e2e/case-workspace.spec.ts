import { expect, test, type Locator, type Page } from '@playwright/test';

import { FIXTURE_IDS } from './fixture-mcp-client.js';

test('cases index filters the gallery without rendering an empty-state card', async ({ page }) => {
  await page.goto('/cases');

  await expect(page.getByLabel('Search transcript')).toHaveAttribute('placeholder', 'issue, objective, title…');
  await expect(page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`)).toBeVisible();

  await page.goto('/cases?q=no-match-token');

  await expect(page.getByTestId('cases-gallery')).toBeVisible();
  await expect(page.getByTestId('case-create-card')).toBeVisible();
  await expect(page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`)).toHaveCount(0);
});

test('list search params survive entering a case workspace and returning to the list', async ({ page }) => {
  await page.goto(`/cases?q=worker&status=active&page=2&sort=priority`);

  await expect(page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`)).toBeVisible();
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      pathname: url.pathname,
      q: url.searchParams.get('q'),
      status: url.searchParams.get('status'),
      page: url.searchParams.get('page'),
      sort: url.searchParams.get('sort'),
      revision: url.searchParams.get('revision')
    };
  }).toEqual({
    pathname: `/cases/${FIXTURE_IDS.caseId}`,
    q: 'worker',
    status: 'active',
    page: '2',
    sort: 'priority',
    revision: null
  });

  await page.getByRole('link', { name: 'Back to cases' }).click();

  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      pathname: url.pathname,
      q: url.searchParams.get('q'),
      status: url.searchParams.get('status'),
      page: url.searchParams.get('page'),
      sort: url.searchParams.get('sort')
    };
  }).toEqual({
    pathname: '/cases',
    q: 'worker',
    status: 'active',
    page: '2',
    sort: 'priority'
  });
  await expect(page.getByLabel('Search transcript')).toHaveValue('worker');
});

test('editing the list search query preserves unrelated list params', async ({ page }) => {
  await page.goto('/cases?status=active&page=2&sort=priority');

  const searchField = page.getByLabel('Search transcript');
  await searchField.fill('worker');

  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      q: url.searchParams.get('q'),
      status: url.searchParams.get('status'),
      page: url.searchParams.get('page'),
      sort: url.searchParams.get('sort')
    };
  }).toEqual({
    q: 'worker',
    status: 'active',
    page: '2',
    sort: 'priority'
  });

  await searchField.clear();

  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      q: url.searchParams.get('q'),
      status: url.searchParams.get('status'),
      page: url.searchParams.get('page'),
      sort: url.searchParams.get('sort')
    };
  }).toEqual({
    q: null,
    status: 'active',
    page: '2',
    sort: 'priority'
  });
});

test('cases index presents the gallery create card first and supports manual case creation', async ({ page }) => {
  await page.goto('/cases');

  const gallery = page.getByTestId('cases-gallery');
  await expect(gallery).toBeVisible();
  expect(await gallery.locator(':scope > *').first().getAttribute('data-testid')).toBe('case-create-card');

  await page.getByTestId('case-create-card').click();
  await expect(page.getByTestId('create-case-panel')).toBeVisible();

  await page.getByTestId('create-case-title').fill('Manual intake from gallery');
  await page.getByTestId('create-case-objective').fill('Validate that manual intake opens a fresh case workspace.');
  await page.getByTestId('create-case-severity').selectOption('critical');
  await page.getByTestId('create-case-project-directory').fill('/workspace/manual-intake');
  await page.getByTestId('create-case-labels').fill('manual, gallery');
  await page.getByTestId('create-case-submit').click();

  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/cases\/case_/);
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Manual intake from gallery');
});

test('loads the workspace and opens a hypothesis inspector from the graph', async ({ page }) => {
  await page.goto('/cases');

  await expect(page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`)).toBeVisible();
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  await expect(page.getByTestId('snapshot-panel')).toHaveCount(0);
  await page.getByTestId(`graph-node-${FIXTURE_IDS.hypothesisId}`).click();

  await expect(page.getByTestId('inspector-panel')).toBeVisible();
  await expect(page.getByTestId('inspector-title')).toContainText('worker pool starvation hypothesis');
  await expect(page.getByTestId('inspector-status')).toHaveText('Favored');
  await expect(page.getByTestId('action-confirm-hypothesis')).toBeVisible();
  await expect(page.getByTestId('action-open-gap')).toBeVisible();
  await expect(page.getByTestId('action-record-decision')).toBeVisible();

  await page.getByTestId(`graph-node-${FIXTURE_IDS.experimentId}`).click();
  await expect(page.getByTestId('inspector-panel')).toContainText('Linked hypotheses');
  await expect(page.getByTestId('inspector-panel')).toContainText('Expected outcomes');
});

test('workspace prioritizes the main graph surface on tablet widths and keeps actions ahead of diagnostics on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/cases');
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  const graphStage = page.getByTestId('graph-stage');
  const actionPanel = page.getByTestId('action-panel');

  await expect(graphStage).toBeVisible();
  await expect(actionPanel).toBeVisible();

  const tabletGraphBox = await graphStage.boundingBox();
  const tabletActionBox = await actionPanel.boundingBox();

  expect(tabletGraphBox).not.toBeNull();
  expect(tabletActionBox).not.toBeNull();
  expect((tabletGraphBox?.width ?? 0) > 500).toBeTruthy();
  expect((tabletActionBox?.x ?? 0) > (tabletGraphBox?.x ?? 0)).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });

  const guardrailPanel = page.getByTestId('guardrail-panel');
  const mobileSnapshotPanel = page.getByTestId('snapshot-panel');

  await expect(actionPanel).toBeVisible();
  await expect(guardrailPanel).toBeVisible();
  await expect(mobileSnapshotPanel).toHaveCount(0);

  const actionBox = await actionPanel.boundingBox();
  const guardrailBox = await guardrailPanel.boundingBox();

  expect(actionBox).not.toBeNull();
  expect(guardrailBox).not.toBeNull();
  expect((actionBox?.y ?? 0) < (guardrailBox?.y ?? 0)).toBeTruthy();
});

test('workspace graph surface includes orientation copy for graph state and controls', async ({ page }) => {
  await page.goto('/cases');
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  const graphStage = page.getByTestId('graph-stage');

  await expect(graphStage).toBeVisible();
  await expect(graphStage.getByText('Case graph')).toBeVisible();
  await expect(graphStage.getByLabel('Graph legend')).toBeVisible();
  await expect(graphStage.getByLabel('Graph controls')).toBeVisible();
  await expect(graphStage.getByLabel('Graph controls').getByText('live slice')).toBeVisible();
});

test('workspace opens the graph context menu on right click', async ({ page }) => {
  await page.goto('/cases');
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  const pane = page.locator('.react-flow__pane');
  const contextMenu = page.locator('.context-menu');

  await expect(pane).toBeVisible();

  await pane.click({
    button: 'right',
    position: { x: 96, y: 96 }
  });

  await expect(contextMenu).toBeVisible();
  await expect(contextMenu.locator('.context-menu-item')).toHaveCount(2);
  await expect(contextMenu).toContainText('Issue');
  await expect(contextMenu).toContainText('Artifact');
  await expect(contextMenu).not.toContainText('Fact');
  await expect(contextMenu).not.toContainText('Hypothesis');
  await expect(contextMenu).not.toContainText('Experiment');
  await expect(contextMenu).not.toContainText('Decision');
});

test('workspace closes the graph context menu when the canvas is clicked elsewhere', async ({ page }) => {
  await page.goto('/cases');
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  const pane = page.locator('.react-flow__pane');
  const contextMenu = page.locator('.context-menu');

  await expect(pane).toBeVisible();

  await pane.click({
    button: 'right',
    position: { x: 96, y: 96 }
  });

  await expect(contextMenu).toBeVisible();
  const dismissPoint = await pointInLocator(pane, 420, 120);
  await page.mouse.click(dismissPoint.x, dismissPoint.y);

  await expect(contextMenu).toHaveCount(0);
});

test('workspace connects nodes when dragging from one handle to another', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await page.goto('/cases');
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  const sourceHandle = page.locator(`.react-flow__node[data-id="${FIXTURE_IDS.hypothesisId}"] .react-flow__handle-right`);
  const targetHandle = page.locator(`.react-flow__node[data-id="${FIXTURE_IDS.experimentId}"] .react-flow__handle-left`);
  const edges = page.locator('.react-flow__edge');

  await expect(sourceHandle).toBeVisible();
  await expect(targetHandle).toBeVisible();

  const edgeCountBefore = await edges.count();
  const sourcePoint = await centerOf(sourceHandle);
  const targetPoint = await centerOf(targetHandle);

  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 12 });
  await page.mouse.up();

  await expect.poll(() => edges.count()).toBe(edgeCountBefore + 1);
  await page.reload();
  await expect.poll(() => page.locator('.react-flow__edge').count()).toBe(edgeCountBefore + 1);
});

test('workspace preserves dragged node positions across reloads', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await page.goto('/cases');
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  const node = page.locator(`.react-flow__node[data-id="${FIXTURE_IDS.hypothesisId}"]`);
  await expect(node).toBeVisible();

  const before = await node.boundingBox();
  const dragStart = await centerOf(node);

  expect(before).not.toBeNull();

  await dragPointer(page, dragStart, { x: 128, y: 0 });

  const after = await node.boundingBox();
  expect(after).not.toBeNull();
  expect((after?.x ?? 0) > (before?.x ?? 0)).toBeTruthy();

  await page.reload();

  await expect.poll(async () => {
    const current = await page.locator(`.react-flow__node[data-id="${FIXTURE_IDS.hypothesisId}"]`).boundingBox();
    return Math.round(current?.x ?? 0);
  }).toBe(Math.round(after?.x ?? 0));
});

test('workspace persists canonical hypothesis nodes across reloads', async ({ page }) => {
  await page.goto('/cases');
  await page.getByTestId('case-create-card').click();

  await page.getByTestId('create-case-title').fill('Graph save regression');
  await page.getByTestId('create-case-objective').fill('Verify graph context-menu additions persist after navigation.');
  await page.getByTestId('create-case-severity').selectOption('high');
  await page.getByTestId('create-case-project-directory').fill('/workspace/graph-save');
  await page.getByTestId('create-case-submit').click();

  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/cases\/case_/);

  const pane = page.locator('.react-flow__pane');
  const graphNodes = page.locator('.react-flow__node');
  const sourceHandle = page.locator('.react-flow__node .react-flow__handle-right').first();

  await expect(graphNodes).toHaveCount(1);
  await expect(sourceHandle).toBeVisible();

  const start = await centerOf(sourceHandle);
  const end = await pointInLocator(pane, 360, 120);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();

  await page.getByText('Hypothesis').click();
  const createMenu = page.locator('.graph-create-form');
  await expect(createMenu).toBeVisible();
  await createMenu.locator('textarea').nth(0).fill('The canonical branch should be persisted.');
  await createMenu.locator('textarea').nth(1).fill('The branch should be disproved if the follow-up evidence fails.');
  await createMenu.getByRole('button', { name: 'Create' }).click();

  await expect.poll(() => graphNodes.count()).toBe(2);
  const workspaceUrl = page.url();

  await page.getByRole('link', { name: 'Cases' }).click();
  await page.goto(workspaceUrl);

  await expect.poll(() => graphNodes.count()).toBe(2);
});

test('workspace preserves action-panel draft edits across reloads', async ({ page }) => {
  await page.goto(`/cases/${FIXTURE_IDS.caseId}`);
  await page.getByTestId(`graph-node-${FIXTURE_IDS.hypothesisId}`).click();

  const stageRationale = page.getByTestId('stage-rationale');
  const hypothesisRationale = page.getByTestId('hypothesis-rationale');

  await stageRationale.fill('Case-level draft should survive a reload.');
  await hypothesisRationale.fill('Draft rationale should survive a reload.');

  await page.reload();
  await page.getByTestId(`graph-node-${FIXTURE_IDS.hypothesisId}`).click();

  await expect(stageRationale).toHaveValue('Case-level draft should survive a reload.');
  await expect(hypothesisRationale).toHaveValue('Draft rationale should survive a reload.');
});

test('workspace graph pans only from blank-pane drags or space-drag and keeps plain node drags for repositioning', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await page.goto('/cases');
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  const pane = page.locator('.react-flow__pane');
  const viewport = page.locator('.react-flow__viewport');
  const node = page.locator(`.react-flow__node[data-id="${FIXTURE_IDS.hypothesisId}"]`);

  await expect(pane).toBeVisible();
  await expect(viewport).toBeVisible();
  await expect(node).toBeVisible();

  const nodeBeforeNodeDrag = await readTransform(node);
  const viewportBeforeNodeDrag = await readTransform(viewport);

  await dragPointer(page, await centerOf(node), { x: 128, y: 0 });

  await expect.poll(() => readTransform(node)).not.toBe(nodeBeforeNodeDrag);
  await expect.poll(() => readTransform(viewport)).toBe(viewportBeforeNodeDrag);
  const nodeAfterNodeDrag = await readTransform(node);

  const viewportBeforePaneDrag = await readTransform(viewport);
  const nodeBeforePaneDrag = await readTransform(node);

  await dragPointer(page, await pointInLocator(pane, 72, 72), { x: 96, y: 72 });

  await expect.poll(() => readTransform(viewport)).not.toBe(viewportBeforePaneDrag);
  const viewportAfterPaneDrag = await readTransform(viewport);
  await expect.poll(() => readTransform(node)).toBe(nodeBeforePaneDrag);

  const viewportBeforeSpaceDrag = await readTransform(viewport);
  const nodeBeforeSpaceDrag = await readTransform(node);

  await page.keyboard.down('Space');
  try {
    await dragPointer(page, await centerOf(node), { x: -108, y: 84 });
  } finally {
    await page.keyboard.up('Space');
  }

  await expect.poll(() => readTransform(viewport)).not.toBe(viewportBeforeSpaceDrag);
  await expect.poll(() => readTransform(node)).toBe(nodeBeforeSpaceDrag);
});

async function readTransform(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).transform);
}

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();

  expect(box).not.toBeNull();

  return {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2
  };
}

async function pointInLocator(locator: Locator, offsetX: number, offsetY: number) {
  const box = await locator.boundingBox();

  expect(box).not.toBeNull();

  return {
    x: (box?.x ?? 0) + offsetX,
    y: (box?.y ?? 0) + offsetY
  };
}

async function dragPointer(page: Page, start: { x: number; y: number }, delta: { x: number; y: number }) {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 12 });
  await page.mouse.up();
}
