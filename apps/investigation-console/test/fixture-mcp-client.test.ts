import { readFile } from 'node:fs/promises';

import { afterEach, describe, expect, test } from 'vitest';

import { createFixtureMcpClient, FIXTURE_IDS } from '../e2e/fixture-mcp-client.js';

const VALID_CASE_STAGES = new Set([
  'intake',
  'scoping',
  'evidence_collection',
  'hypothesis_competition',
  'discriminative_testing',
  'repair_preparation',
  'repair_validation',
  'closed'
]);

describe('fixture MCP client', () => {
  let client = createFixtureMcpClient();

  afterEach(async () => {
    await client.close();
    client = createFixtureMcpClient();
  });

  test('uses case stages that conform to the published case schema', async () => {
    const headSnapshot = await client.readResource(`investigation://cases/${FIXTURE_IDS.caseId}/snapshot`);
    const historicalSnapshot = await client.readResource(
      `investigation://cases/${FIXTURE_IDS.caseId}/snapshot?atRevision=3`
    );

    expect(
      VALID_CASE_STAGES.has((headSnapshot.data as { data: { case: { stage: string } } }).data.case.stage)
    ).toBe(true);
    expect(
      VALID_CASE_STAGES.has((historicalSnapshot.data as { data: { case: { stage: string } } }).data.case.stage)
    ).toBe(true);
  });

  test('keeps e2e fixtures in external JSON assets', async () => {
    const [minimalCase, historyReplay] = await Promise.all([
      readFile(new URL('../e2e/fixtures/minimal-case.json', import.meta.url), 'utf8').then((value) => JSON.parse(value)),
      readFile(new URL('../e2e/fixtures/history-replay.json', import.meta.url), 'utf8').then((value) => JSON.parse(value))
    ]);

    expect(minimalCase).toMatchObject({
      caseId: FIXTURE_IDS.caseId,
      currentRevision: 5
    });
    expect(historyReplay).toMatchObject({
      caseId: FIXTURE_IDS.caseId,
      revisions: expect.arrayContaining([
        expect.objectContaining({ revision: 3 }),
        expect.objectContaining({ revision: 5 })
      ])
    });
  });
});