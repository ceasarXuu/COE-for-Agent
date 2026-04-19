import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

interface RealBackendSeedState {
  caseId: string;
  hypothesisId: string;
  searchTerm: string;
  title: string;
  headRevision: number;
}

async function readSeedState(): Promise<RealBackendSeedState> {
  const seedPath = process.env.REAL_E2E_SEED_FILE;
  if (!seedPath) {
    throw new Error('REAL_E2E_SEED_FILE is required for real backend e2e');
  }

  return JSON.parse(await readFile(seedPath, 'utf8')) as RealBackendSeedState;
}

test('real backend reviewer flow confirms a canonical hypothesis end-to-end', async ({ page }) => {
  const seed = await readSeedState();

  await page.goto(`/cases?q=${seed.searchTerm}`);
  await expect(page.getByTestId(`case-card-${seed.caseId}`)).toBeVisible();
  await page.getByTestId(`case-card-${seed.caseId}`).click();

  await expect(page.getByTestId('snapshot-panel')).toHaveCount(0);
  await page.getByTestId(`graph-node-${seed.hypothesisId}`).click();
  await expect(page.getByTestId('inspector-status')).toHaveText('Unverified');

  await page.getByTestId('canonical-status-reason').fill('real backend confirmation path is working');
  await page.getByTestId('action-canonical-hypothesis-confirm').click();

  await expect(page.getByTestId('inspector-status')).toHaveText('Confirmed');
  await expect(page.getByTestId('revision-value')).toHaveText(String(seed.headRevision + 1));
});
