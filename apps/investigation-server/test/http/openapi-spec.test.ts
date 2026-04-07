import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

describe('control plane OpenAPI spec', () => {
  test('documents the non-MCP control plane surface', async () => {
    const spec = await readFile(new URL('../../../../openapi/control-plane.v1.yaml', import.meta.url), 'utf8');

    expect(spec).toContain('/healthz:');
    expect(spec).toContain('/readyz:');
    expect(spec).toContain('/version:');
    expect(spec).toContain('/cases/{caseId}/export/prov:');
    expect(spec).toContain('/cases/{caseId}/export/events:');
    expect(spec).toContain('/admin/rebuild-projection:');
  });
});