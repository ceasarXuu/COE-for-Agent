import { expect, test } from '@playwright/test';

import { FIXTURE_IDS } from './fixture-mcp-client.js';
import { clickGraphNode, setControlValue } from './graph-node-helpers.js';

test('loading a historical revision syncs the graph and disables the node editor', async ({ page }) => {
  const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
  const copyShortcut = process.platform === 'darwin' ? 'Meta+C' : 'Control+C';

  await page.goto(`/cases/${FIXTURE_IDS.caseId}`);

  await expect(page.getByTestId('snapshot-panel')).toHaveCount(0);
  await clickGraphNode(page, FIXTURE_IDS.hypothesisId);
  await expect(page.getByTestId('node-editor-current-status')).toHaveText('Unverified');
  await expect(page.getByTestId('node-editor-status')).toBeVisible();
  await expect(page.getByTestId(`graph-node-${FIXTURE_IDS.blockerId}`)).toBeVisible();
  await expect(page.getByTestId(`graph-node-${FIXTURE_IDS.evidenceRefId}`)).toBeVisible();

  await page.goto(`/cases/${FIXTURE_IDS.caseId}?revision=3`);
  await clickGraphNode(page, FIXTURE_IDS.hypothesisId);

  await expect(page).toHaveURL(new RegExp(`cases/${FIXTURE_IDS.caseId}\\?revision=3`));
  await expect(page.getByTestId('snapshot-panel')).toHaveCount(0);
  await expect(page.getByTestId('historical-mode')).toHaveCount(0);
  await expect(page.getByTestId('node-editor-current-status')).toHaveText('Unverified');
  await expect(page.getByTestId(`graph-node-${FIXTURE_IDS.blockerId}`)).toHaveCount(0);
  await expect(page.getByTestId(`graph-node-${FIXTURE_IDS.evidenceRefId}`)).toHaveCount(0);
  await expect(page.getByTestId('node-editor-status')).toBeDisabled();
  await expect(page.getByTestId('node-editor-save')).toHaveCount(0);

  const historicalStatement = page.getByTestId('node-editor-hypothesis-statement');
  await expect(historicalStatement).toBeEnabled();
  await expect(historicalStatement).toHaveAttribute('readonly', '');
  const statementValue = await historicalStatement.inputValue();

  await historicalStatement.focus();
  await page.keyboard.press(selectAllShortcut);
  await expect.poll(async () =>
    historicalStatement.evaluate((element) => {
      const textarea = element as HTMLTextAreaElement;
      return textarea.value.slice(textarea.selectionStart ?? 0, textarea.selectionEnd ?? 0);
    })
  ).toBe(statementValue);
  await page.keyboard.press(copyShortcut);
});

test('reviewer can confirm a canonical hypothesis through the node editor', async ({ page }) => {
  await page.goto(`/cases/${FIXTURE_IDS.caseId}`);

  await clickGraphNode(page, FIXTURE_IDS.hypothesisId);
  await page.getByTestId('node-editor-status').selectOption('confirmed');
  await setControlValue(page, 'node-editor-status-reason', 'load replay completed and direct evidence is stable');

  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/api/confirm-intent') && response.status() === 200
    ),
    page.waitForResponse((response) =>
      response.url().includes('/api/tools/investigation.hypothesis.set_status') && response.status() === 200
    ),
    page.getByTestId('node-editor-save').click()
  ]);

  await page.reload();
  await clickGraphNode(page, FIXTURE_IDS.hypothesisId);

  await expect(page.getByTestId('node-editor-current-status')).toHaveText('Confirmed');
  await expect(page.getByTestId('revision-value')).toHaveText('6');
});
