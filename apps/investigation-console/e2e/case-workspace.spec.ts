import { expect, test, type Locator, type Page } from '@playwright/test';

import { FIXTURE_IDS } from './fixture-mcp-client.js';
import { clickGraphNode, setControlValue } from './graph-node-helpers.js';

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

  await page.getByRole('link', { name: 'Cases' }).click();

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
  await expect(page.locator('.breadcrumb-current')).toContainText('Manual intake from gallery');
});

test('loads the workspace and opens the node editor from graph selection', async ({ page }) => {
  await page.goto('/cases');

  await expect(page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`)).toBeVisible();
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  await expect(page.getByTestId('snapshot-panel')).toHaveCount(0);
  await clickGraphNode(page, FIXTURE_IDS.hypothesisId);

  await expect(page.getByTestId('node-editor-panel')).toBeVisible();
  await expect(page.getByTestId('node-editor-title')).toContainText('worker pool starvation hypothesis');
  await expect(page.getByTestId('node-editor-current-status')).toHaveText('Unverified');
  await expect(page.getByTestId('node-editor-hypothesis-statement')).toBeVisible();
  await expect(page.getByTestId('node-editor-status')).toBeVisible();

  await clickGraphNode(page, FIXTURE_IDS.blockerId);
  await expect(page.getByTestId('node-editor-current-status')).toHaveText('Active');
  await expect(page.getByTestId('node-editor-blocker-description')).toHaveValue('Need production-safe confirmation before rollout');

  await clickGraphNode(page, FIXTURE_IDS.evidenceRefId);
  await expect(page.getByTestId('node-editor-evidence-interpretation')).toHaveValue('Supports the starvation branch under replay load.');
});

test('selecting a problem node does not thrash the console event stream', async ({ page }) => {
  const streamCounts = {
    requests: 0,
    failures: 0
  };

  page.on('request', (request) => {
    if (request.url().includes('/api/stream')) {
      streamCounts.requests += 1;
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('/api/stream')) {
      streamCounts.failures += 1;
    }
  });

  await page.goto('/cases');
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  await expect(page.getByTestId('graph-stage')).toBeVisible();
  await page.waitForTimeout(300);

  const baseline = { ...streamCounts };

  await clickGraphNode(page, FIXTURE_IDS.problemId);
  await expect(page.getByTestId('node-editor-problem-description')).toBeVisible();
  await page.waitForTimeout(1000);

  expect(streamCounts.requests - baseline.requests).toBeLessThanOrEqual(3);
  expect(streamCounts.failures - baseline.failures).toBeLessThanOrEqual(3);
});

test('workspace keeps the revision strip above the graph and editor, then stacks graph and editor on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/cases');
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  const graphStage = page.getByTestId('graph-stage');
  const timelineStrip = page.getByTestId('timeline-strip');
  const nodeEditor = page.getByTestId('node-editor-panel');

  await expect(graphStage).toBeVisible();
  await expect(timelineStrip).toBeVisible();
  await expect(nodeEditor).toBeVisible();

  const tabletGraphBox = await graphStage.boundingBox();
  const tabletTimelineBox = await timelineStrip.boundingBox();
  const tabletEditorBox = await nodeEditor.boundingBox();

  expect(tabletGraphBox).not.toBeNull();
  expect(tabletTimelineBox).not.toBeNull();
  expect(tabletEditorBox).not.toBeNull();
  expect((tabletTimelineBox?.y ?? 0) < (tabletGraphBox?.y ?? 0)).toBeTruthy();
  expect((tabletTimelineBox?.y ?? 0) < (tabletEditorBox?.y ?? 0)).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nodeEditor).toBeVisible();
  await expect(timelineStrip).toBeVisible();

  const mobileTimelineBox = await timelineStrip.boundingBox();
  const mobileGraphBox = await graphStage.boundingBox();
  const mobileEditorBox = await nodeEditor.boundingBox();

  expect(mobileTimelineBox).not.toBeNull();
  expect(mobileGraphBox).not.toBeNull();
  expect(mobileEditorBox).not.toBeNull();
  expect((mobileTimelineBox?.y ?? 0) < (mobileGraphBox?.y ?? 0)).toBeTruthy();
  expect((mobileGraphBox?.y ?? 0) < (mobileEditorBox?.y ?? 0)).toBeTruthy();
});

test('workspace does not render the legacy graph summary strip above the canvas', async ({ page }) => {
  await page.goto('/cases');
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  const graphStage = page.getByTestId('graph-stage');

  await expect(graphStage).toBeVisible();
  await expect(graphStage.getByLabel('Graph legend')).toHaveCount(0);
  await expect(graphStage.getByLabel('Graph controls')).toHaveCount(0);
});

test('workspace does not open a blank-pane context menu on right click', async ({ page }) => {
  await page.goto('/cases');
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  const pane = page.locator('.react-flow__pane');
  const contextMenu = page.locator('.context-menu');

  await expect(pane).toBeVisible();

  await pane.click({
    button: 'right',
    position: { x: 96, y: 96 }
  });

  await expect(contextMenu).toHaveCount(0);
});

test('workspace creates canonical hypotheses from graph handles and persists them across reloads', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await createManualCase(page, {
    title: 'Graph save regression',
    objective: 'Verify canonical graph creations persist after navigation.',
    severity: 'high',
    projectDirectory: '/workspace/graph-save'
  });

  const pane = page.locator('.react-flow__pane');
  const graphNodes = page.locator('.react-flow__node');

  await expect(graphNodes).toHaveCount(1);
  await expect(pane).toBeVisible();

  const rootNodeId = await graphNodes.first().getAttribute('data-id');
  expect(rootNodeId).toBeTruthy();

  const sourceHandle = page.locator(`.react-flow__node[data-id="${rootNodeId}"] .react-flow__handle-right`);
  const sourcePoint = await centerOf(sourceHandle);
  const targetPoint = await pointInLocator(pane, 420, 220);

  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 12 });
  await page.mouse.up();

  const createMenu = page.locator('.context-menu');
  await expect(createMenu).toBeVisible();
  await expect(createMenu.locator('.context-menu-item')).toHaveCount(1);
  await expect(createMenu).toContainText('Hypothesis');

  await createMenu.locator('.context-menu-item').first().click();
  await expect.poll(() => graphNodes.count()).toBe(2);
  await setControlValue(page, 'node-editor-hypothesis-statement', 'The canonical branch should be persisted.');
  await setControlValue(page, 'node-editor-hypothesis-falsification', 'Disprove this branch if the follow-up evidence fails.');
  await page.getByTestId('node-editor-save').click();

  await expect.poll(() => page.getByTestId('node-editor-current-status').textContent()).toContain('Saving');

  const workspaceUrl = page.url();
  await page.goto(workspaceUrl);
  await expect.poll(() => graphNodes.count()).toBe(2);

  await page.getByRole('link', { name: 'Cases' }).click();
  await page.goto(workspaceUrl);
  await expect.poll(() => graphNodes.count()).toBe(2);
});

test('workspace preserves manually saved problem edits across reloads', async ({ page }) => {
  await createManualCase(page, {
    title: 'Problem autosave check',
    objective: 'Verify canonical problem edits survive a reload after manual save.',
    severity: 'medium',
    projectDirectory: '/workspace/problem-autosave'
  });

  const rootNodeId = await page.locator('.react-flow__node').first().getAttribute('data-id');
  expect(rootNodeId).toBeTruthy();

  await clickGraphNode(page, rootNodeId ?? '');

  const updateResponse = page.waitForResponse((response) =>
    response.url().includes('/api/tools/investigation.problem.update') && response.status() === 200
  );

  await setControlValue(page, 'node-editor-problem-title', 'Problem autosave survived reload');
  await setControlValue(page, 'node-editor-problem-description', 'Updated canonical problem description');
  await page.getByTestId('node-editor-save').click();
  await updateResponse;

  await page.reload();
  await clickGraphNode(page, rootNodeId ?? '');

  await expect(page.getByTestId('node-editor-problem-title')).toHaveValue('Problem autosave survived reload');
  await expect(page.getByTestId('node-editor-problem-description')).toHaveValue('Updated canonical problem description');
});

test('workspace preserves manually saved hypothesis edits across reloads', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await createManualCase(page, {
    title: 'Hypothesis manual save check',
    objective: 'Verify saved hypotheses stay editable.',
    severity: 'high',
    projectDirectory: '/workspace/hypothesis-manual-save'
  });

  const pane = page.locator('.react-flow__pane');
  const graphNodes = page.locator('.react-flow__node');
  const rootNodeId = await graphNodes.first().getAttribute('data-id');
  expect(rootNodeId).toBeTruthy();

  const sourceHandle = page.locator(`.react-flow__node[data-id="${rootNodeId}"] .react-flow__handle-right`);
  const sourcePoint = await centerOf(sourceHandle);
  const targetPoint = await pointInLocator(pane, 420, 220);

  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 12 });
  await page.mouse.up();

  await page.locator('.context-menu-item').first().click();
  await setControlValue(page, 'node-editor-hypothesis-statement', 'Initial saved hypothesis');
  await setControlValue(page, 'node-editor-hypothesis-falsification', 'Initial falsification');
  await page.getByTestId('node-editor-save').click();

  await expect.poll(() => graphNodes.count()).toBe(2);

  const hypothesisNode = page.locator('.react-flow__node').nth(1);
  const firstHypothesisNodeId = await hypothesisNode.getAttribute('data-id');
  expect(firstHypothesisNodeId).toBeTruthy();

  await clickGraphNode(page, firstHypothesisNodeId ?? '');

  const updateResponse = page.waitForResponse((response) =>
    response.url().includes('/api/tools/investigation.hypothesis.update') && response.status() === 200
  );

  await setControlValue(page, 'node-editor-hypothesis-title', 'Updated saved title');
  await setControlValue(page, 'node-editor-hypothesis-statement', 'Updated saved hypothesis');
  await setControlValue(page, 'node-editor-hypothesis-falsification', 'Updated falsification');
  await page.getByTestId('node-editor-save').click();
  await updateResponse;

  await page.reload();
  const persistedHypothesisNodeId = await page.locator('.react-flow__node').nth(1).getAttribute('data-id');
  expect(persistedHypothesisNodeId).toBeTruthy();
  await clickGraphNode(page, persistedHypothesisNodeId ?? '');

  await expect(page.getByTestId('node-editor-hypothesis-title')).toHaveValue('Updated saved title');
  await expect(page.getByTestId('node-editor-hypothesis-statement')).toHaveValue('Updated saved hypothesis');
  await expect(page.getByTestId('node-editor-hypothesis-falsification')).toHaveValue('Updated falsification');
});

test('workspace graph pans from blank-pane drags and keeps plain node drags for repositioning', async ({ page }) => {
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

  const viewportBeforePaneDrag = await readTransform(viewport);
  const nodeBeforePaneDrag = await readTransform(node);

  await dragPointer(page, await pointInLocator(pane, 72, 72), { x: 96, y: 72 });

  await expect.poll(() => readTransform(viewport)).not.toBe(viewportBeforePaneDrag);
  await expect.poll(() => readTransform(node)).toBe(nodeBeforePaneDrag);
});

async function createManualCase(page: Page, input: {
  title: string;
  objective: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  projectDirectory: string;
  labels?: string;
}) {
  await page.goto('/cases');
  await page.getByTestId('case-create-card').click();

  await page.getByTestId('create-case-title').fill(input.title);
  await page.getByTestId('create-case-objective').fill(input.objective);
  await page.getByTestId('create-case-severity').selectOption(input.severity);
  await page.getByTestId('create-case-project-directory').fill(input.projectDirectory);
  if (input.labels) {
    await page.getByTestId('create-case-labels').fill(input.labels);
  }
  await page.getByTestId('create-case-submit').click();

  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/cases\/case_/);
}

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
