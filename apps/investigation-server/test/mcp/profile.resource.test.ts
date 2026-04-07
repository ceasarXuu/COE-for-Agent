import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { describe, expect, test } from 'vitest';

import { loadSchemaByRelativePath } from '@coe/schemas';

import { loadConfig } from '../../src/config.js';
import { createInvestigationMcpServer } from '../../src/mcp/server.js';

const Ajv2020 = Ajv2020Module as unknown as typeof import('ajv/dist/2020.js').default;
const addFormats = addFormatsModule as unknown as typeof import('ajv-formats').default;

describe('profile resource', () => {
  test('initializes the MCP server and serves investigation profile', async () => {
    const server = createInvestigationMcpServer({
      config: loadConfig({})
    });
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validateProfile = ajv.compile(loadSchemaByRelativePath('resources/v1/profile.schema.json'));

    expect(server.listResourceTemplates()).toContain('investigation://profile');

    const profile = await server.readResource('investigation://profile');
    expect(profile).toMatchObject({
      uri: 'investigation://profile',
      mimeType: 'application/json',
      data: {
        profileVersion: '1.0.0',
        mcpSurfaceVersion: '1.0.0'
      }
    });
    expect(validateProfile(profile.data)).toBe(true);
  });
});