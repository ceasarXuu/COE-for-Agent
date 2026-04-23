import { readFile } from 'node:fs/promises';

export interface RealBackendSeedState {
  caseId: string;
  hypothesisId: string;
  searchTerm: string;
  title: string;
  headRevision: number;
}

export async function readSeedState(): Promise<RealBackendSeedState> {
  const seedPath = process.env.REAL_E2E_SEED_FILE;
  if (!seedPath) {
    throw new Error('REAL_E2E_SEED_FILE is required for real backend e2e');
  }

  return JSON.parse(await readFile(seedPath, 'utf8')) as RealBackendSeedState;
}
