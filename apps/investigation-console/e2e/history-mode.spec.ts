import { expect, test } from '@playwright/test';

import { FIXTURE_IDS } from './fixture-mcp-client.js';

test('switching to a historical revision syncs snapshot graph and inspector while disabling writes', async ({ page }) => {
  await page.goto(`/cases/${FIXTURE_IDS.caseId}`);

  await expect(page.getByTestId('snapshot-panel')).toHaveCount(0);
  await page.getByTestId(`graph-node-${FIXTURE_IDS.hypothesisId}`).click();
  await expect(page.getByTestId('inspector-status')).toHaveText('Favored');
  await expect(page.getByTestId('action-confirm-hypothesis')).toBeVisible();

  await page.getByTestId('revision-slider').focus();
  await page.getByTestId('revision-slider').press('ArrowLeft');
  await page.getByTestId('revision-slider').press('ArrowLeft');

  await expect(page).toHaveURL(new RegExp(`cases/${FIXTURE_IDS.caseId}\\?revision=3`));
  await expect(page.getByTestId('snapshot-panel')).toHaveCount(0);
  await expect(page.getByTestId('historical-mode')).toBeVisible();
  await expect(page.getByTestId('inspector-status')).toHaveText('Proposed');
  await expect(page.getByTestId(`graph-node-${FIXTURE_IDS.experimentId}`)).toHaveCount(0);
  await expect(page.getByTestId('action-advance-stage')).toBeDisabled();
  await expect(page.getByTestId('action-confirm-hypothesis')).toBeDisabled();
  await expect(page.getByTestId('action-open-gap')).toBeDisabled();
});

test('high-risk stage changes require reviewer confirmation before mutation', async ({ page }) => {
  await page.goto(`/cases/${FIXTURE_IDS.caseId}`);

  await page.getByTestId('stage-rationale').fill('validated patch target and completed replay evidence');
  await page.getByTestId('action-advance-stage').click();

  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-submit').click();

  await expect(page.getByTestId('snapshot-panel')).toHaveCount(0);
  await expect(page.getByTestId('revision-value')).toHaveText('6');
});

test('reviewer can confirm a favored hypothesis through the action panel', async ({ page }) => {
  await page.goto(`/cases/${FIXTURE_IDS.caseId}`);

  await page.getByTestId(`graph-node-${FIXTURE_IDS.hypothesisId}`).click();
  await page.getByTestId('hypothesis-rationale').fill('load replay completed and direct evidence is stable');
  await page.getByTestId('action-confirm-hypothesis').click();

  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-submit').click();

  await expect(page.getByTestId('inspector-status')).toHaveText('Confirmed');
  await expect(page.getByTestId('revision-value')).toHaveText('7');
});
