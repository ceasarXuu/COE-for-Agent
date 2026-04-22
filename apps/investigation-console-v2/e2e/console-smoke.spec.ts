import { expect, test } from '@playwright/test';

test('v2 cases page and workspace basic flow render correctly', async ({ page }) => {
  await page.goto('/cases');

  await expect(page.locator('[data-testid="cases-gallery-v2"]')).toBeVisible();
  await expect(page.locator('[data-testid="case-create-card"]')).toBeVisible();

  await page.locator('[data-testid="case-create-card"]').click();
  await expect(page.locator('[data-testid="create-case-submit"]')).toBeVisible();
  await page.keyboard.press('Escape');

  const firstCaseCard = page.locator('[data-testid^="case-card-"]').first();
  await expect(firstCaseCard).toBeVisible();
  await firstCaseCard.click();

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
