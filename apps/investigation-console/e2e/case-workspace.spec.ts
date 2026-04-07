import { expect, test } from '@playwright/test';

import { FIXTURE_IDS } from './fixture-mcp-client.js';

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