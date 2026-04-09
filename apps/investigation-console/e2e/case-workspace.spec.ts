import { expect, test } from '@playwright/test';

import { FIXTURE_IDS } from './fixture-mcp-client.js';

test('list search params survive entering a case workspace and returning to the list', async ({ page }) => {
  await page.goto(`/cases?q=worker&status=active&page=2`);

  await expect(page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`)).toBeVisible();
  await page.getByTestId(`case-card-${FIXTURE_IDS.caseId}`).click();

  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      pathname: url.pathname,
      q: url.searchParams.get('q'),
      status: url.searchParams.get('status'),
      page: url.searchParams.get('page'),
      revision: url.searchParams.get('revision')
    };
  }).toEqual({
    pathname: `/cases/${FIXTURE_IDS.caseId}`,
    q: 'worker',
    status: 'active',
    page: '2',
    revision: null
  });

  await page.getByRole('link', { name: 'Back to cases' }).click();

  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      pathname: url.pathname,
      q: url.searchParams.get('q'),
      status: url.searchParams.get('status'),
      page: url.searchParams.get('page')
    };
  }).toEqual({
    pathname: '/cases',
    q: 'worker',
    status: 'active',
    page: '2'
  });
  await expect(page.getByLabel('Search transcript')).toHaveValue('worker');
});

test('editing the list search query preserves unrelated list params', async ({ page }) => {
  await page.goto('/cases?status=active&page=2');

  const searchField = page.getByLabel('Search transcript');
  await searchField.fill('worker');

  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      q: url.searchParams.get('q'),
      status: url.searchParams.get('status'),
      page: url.searchParams.get('page')
    };
  }).toEqual({
    q: 'worker',
    status: 'active',
    page: '2'
  });

  await searchField.clear();

  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      q: url.searchParams.get('q'),
      status: url.searchParams.get('status'),
      page: url.searchParams.get('page')
    };
  }).toEqual({
    q: null,
    status: 'active',
    page: '2'
  });
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
