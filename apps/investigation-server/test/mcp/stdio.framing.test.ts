import { describe, expect, test } from 'vitest';

import { createStdioFrame, createStdioMessageDecoder } from '../../src/mcp/stdio-framing.js';

describe('stdio MCP framing', () => {
  test('encodes JSON-RPC payloads with Content-Length framing', () => {
    const frame = createStdioFrame({
      jsonrpc: '2.0',
      id: 1,
      result: {}
    });

    expect(frame).toContain('Content-Length: ');
    expect(frame).toContain('\r\n\r\n');
    expect(frame.endsWith('{"jsonrpc":"2.0","id":1,"result":{}}')).toBe(true);
  });

  test('decodes framed messages across chunk boundaries', () => {
    const decoder = createStdioMessageDecoder();
    const frameA = createStdioFrame({
      jsonrpc: '2.0',
      id: 1,
      method: 'ping'
    });
    const frameB = createStdioFrame({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });
    const combined = frameA + frameB;

    const first = decoder.push(combined.slice(0, 25));
    const second = decoder.push(combined.slice(25, 70));
    const third = decoder.push(combined.slice(70));

    expect(first).toEqual([]);
    expect(second).toEqual([
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping'
      }
    ]);
    expect(third).toEqual([
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      }
    ]);
  });
});
