import { expect, test } from '@playwright/test';

import { clickGraphNode, setControlValue } from './graph-node-helpers.js';
import { readSeedState } from './real-backend-seed.js';

test('real backend reviewer flow confirms a canonical hypothesis end-to-end', async ({ page }) => {
  const seed = await readSeedState();

  await page.goto(`/cases?q=${seed.searchTerm}`);
  await expect(page.getByTestId(`case-card-${seed.caseId}`)).toBeVisible();
  await page.getByTestId(`case-card-${seed.caseId}`).click();

  await clickGraphNode(page, seed.hypothesisId);
  await expect(page.getByTestId('node-editor-current-status')).toHaveText('Unverified');

  await page.getByTestId('node-editor-status').selectOption('confirmed');
  await setControlValue(page, 'node-editor-status-reason', 'real backend confirmation path is working');
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/api/tools/investigation.hypothesis.set_status') && response.status() === 200
    ),
    page.getByTestId('node-editor-save').click()
  ]);

  await page.reload();
  await clickGraphNode(page, seed.hypothesisId);

  await expect(page.getByTestId('node-editor-current-status')).toHaveText('Confirmed');
});
