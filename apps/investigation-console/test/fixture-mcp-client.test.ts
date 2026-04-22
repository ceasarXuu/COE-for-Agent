import { readFile } from 'node:fs/promises';

import { afterEach, describe, expect, test } from 'vitest';

import { createFixtureMcpClient, FIXTURE_IDS } from '../e2e/fixture-mcp-client.js';

const CANONICAL_NODE_KINDS = new Set([
  'case',
  'problem',
  'hypothesis',
  'blocker',
  'repair_attempt',
  'evidence_ref'
]);

describe('fixture MCP client', () => {
  let client = createFixtureMcpClient();

  afterEach(async () => {
    await client.close();
    client = createFixtureMcpClient();
  });

  test('exposes case summaries without a stage field', async () => {
    const headSnapshot = await client.readResource(`investigation://cases/${FIXTURE_IDS.caseId}/snapshot`);
    const historicalSnapshot = await client.readResource(
      `investigation://cases/${FIXTURE_IDS.caseId}/snapshot?atRevision=3`
    );

    expect('stage' in (headSnapshot.data as { data: { case: Record<string, unknown> } }).data.case).toBe(false);
    expect('stage' in (historicalSnapshot.data as { data: { case: Record<string, unknown> } }).data.case).toBe(false);
  });

  test('exposes only canonical snapshot counts and graph node kinds', async () => {
    const [headSnapshot, headGraph, historicalGraph] = await Promise.all([
      client.readResource(`investigation://cases/${FIXTURE_IDS.caseId}/snapshot`),
      client.readResource(`investigation://cases/${FIXTURE_IDS.caseId}/graph`),
      client.readResource(`investigation://cases/${FIXTURE_IDS.caseId}/graph?atRevision=3`)
    ]);

    expect((headSnapshot.data as { data: { counts: Record<string, number> } }).data.counts).toEqual({
      problems: 1,
      hypotheses: 1,
      blockers: 1,
      repairAttempts: 0,
      evidenceRefs: 1
    });

    const headNodes = (headGraph.data as { data: { nodes: Array<{ kind: string }> } }).data.nodes;
    const historicalNodes = (historicalGraph.data as { data: { nodes: Array<{ kind: string }> } }).data.nodes;

    expect(headNodes.every((node) => CANONICAL_NODE_KINDS.has(node.kind))).toBe(true);
    expect(headNodes.map((node) => node.kind).sort()).toEqual([
      'blocker',
      'case',
      'evidence_ref',
      'hypothesis',
      'problem'
    ]);
    expect(historicalNodes.every((node) => CANONICAL_NODE_KINDS.has(node.kind))).toBe(true);
    expect(historicalNodes.map((node) => node.kind).sort()).toEqual([
      'case',
      'hypothesis',
      'problem'
    ]);
  });

  test('manual case creation returns only canonical created ids', async () => {
    const result = await client.invokeTool('investigation.case.open', {
      caseId: 'case_ignore_input',
      title: 'Canonical manual case',
      objective: 'Create a manual canonical case from the gallery.',
      severity: 'high',
      projectDirectory: '/workspace/manual-canonical'
    }) as { createdIds?: string[] };

    expect(result.createdIds).toHaveLength(2);
    expect(result.createdIds?.[0]).toMatch(/^case_/);
    expect(result.createdIds?.[1]).toMatch(/^problem_/);
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

  test('does not expose removed legacy coverage or panel resources', async () => {
    await expect(
      client.readResource(`investigation://cases/${FIXTURE_IDS.caseId}/coverage`)
    ).rejects.toThrow(/Unsupported resource/);

    await expect(
      client.readResource(`investigation://cases/${FIXTURE_IDS.caseId}/hypotheses/${FIXTURE_IDS.hypothesisId}`)
    ).rejects.toThrow(/Unsupported resource/);

    await expect(
      client.readResource(`investigation://cases/${FIXTURE_IDS.caseId}/inquiries/inquiry_removed_from_canonical_fixture`)
    ).rejects.toThrow(/Unsupported resource/);
  });
});
