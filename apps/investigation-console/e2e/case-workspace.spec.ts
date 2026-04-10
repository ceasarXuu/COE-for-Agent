import { expect, test } from '@playwright/test';

import { FIXTURE_IDS } from './fixture-mcp-client.js';

test('cases index filters the gallery without rendering an empty-state card', async ({ page }) => {
  await page.goto('/cases');

  await expect(page.getByLabel('Search transcript')).toHaveAttribute('placeholder', 'symptom, objective, title…');
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
  await page.getByTestId('create-case-environment').fill('prod-us-1, worker-cluster');
  await page.getByTestId('create-case-labels').fill('manual, gallery');
  await page.getByTestId('create-case-submit').click();

  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/cases\/case_/);
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Manual intake from gallery');
});

test('loads the workspace and opens a hypothesis inspector from the graph', async ({ page }) => {
  await page.goto('/cases');

  await expect(page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`)).toBeVisible();
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  await expect(page.getByTestId('snapshot-stage')).toHaveText('Discriminative Testing');
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
  const snapshotPanel = page.getByTestId('snapshot-panel');

  await expect(graphStage).toBeVisible();
  await expect(snapshotPanel).toBeVisible();

  const tabletGraphBox = await graphStage.boundingBox();
  const tabletSnapshotBox = await snapshotPanel.boundingBox();

  expect(tabletGraphBox).not.toBeNull();
  expect(tabletSnapshotBox).not.toBeNull();
  expect((tabletGraphBox?.width ?? 0) > 500).toBeTruthy();
  expect((tabletSnapshotBox?.y ?? 0) > (tabletGraphBox?.y ?? 0)).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });

  const actionPanel = page.getByTestId('action-panel');
  const guardrailPanel = page.getByTestId('guardrail-panel');
  const mobileSnapshotPanel = page.getByTestId('snapshot-panel');

  await expect(actionPanel).toBeVisible();
  await expect(guardrailPanel).toBeVisible();

  const actionBox = await actionPanel.boundingBox();
  const guardrailBox = await guardrailPanel.boundingBox();
  const mobileSnapshotBox = await mobileSnapshotPanel.boundingBox();

  expect(actionBox).not.toBeNull();
  expect(guardrailBox).not.toBeNull();
  expect(mobileSnapshotBox).not.toBeNull();
  expect((actionBox?.y ?? 0) < (guardrailBox?.y ?? 0)).toBeTruthy();
  expect((actionBox?.y ?? 0) < (mobileSnapshotBox?.y ?? 0)).toBeTruthy();
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
