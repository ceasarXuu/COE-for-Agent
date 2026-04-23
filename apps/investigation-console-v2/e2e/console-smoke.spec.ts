import { expect, test } from '@playwright/test';

import { readSeedState } from './real-backend-seed.js';

test('v2 cases page and workspace basic flow render correctly', async ({ page }) => {
  const seed = await readSeedState();

  await page.goto(`/cases?q=${seed.searchTerm}`);

  await expect(page.locator('[data-testid="cases-gallery-v2"]')).toBeVisible();
  await expect(page.locator('[data-testid="cases-toolbar-create"]')).toBeVisible();

  await page.locator('[data-testid="cases-toolbar-create"]').click();
  await expect(page.locator('[data-testid="create-case-submit"]')).toBeVisible();
  await page.keyboard.press('Escape');

  const seededCaseCard = page.getByTestId(`case-card-${seed.caseId}`);
  await expect(seededCaseCard).toBeVisible();
  await seededCaseCard.click();

  await expect(page.locator('[data-testid="graph-stage"]').first()).toBeVisible();
  await expect(page.locator('[data-testid="revision-marker-slot-1"]')).toBeVisible();
  await expect(page.locator('[data-testid="revision-marker-slot-2"]')).toBeVisible();

  await page.locator('[data-testid="revision-marker-slot-2"]').hover();
  await expect(page.locator('[data-testid="revision-bubble-2"]')).toBeVisible();
  await expect(page.locator('[data-testid="node-editor-panel"]')).toHaveCount(0);

  const firstNode = page.locator('.react-flow__node').first();
  await expect(firstNode).toBeVisible();
  await firstNode.click();

  await expect(page.locator('[data-testid="node-editor-title"]').first()).toBeVisible();

  await page.locator('.react-flow__pane').first().click({ position: { x: 40, y: 40 } });
  await expect(page.locator('[data-testid="node-editor-panel"]')).toHaveCount(0);
});
