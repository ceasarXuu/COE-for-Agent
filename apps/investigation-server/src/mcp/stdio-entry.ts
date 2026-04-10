import { buildInvestigationApp } from '../app.js';
import { loadConfig } from '../config.js';

import { createStdioMessageDecoder, createStdioFrame } from './stdio-framing.js';
import { DEFAULT_HOST_CONFIG, handleStdioProtocolMessage } from './stdio-protocol.js';

async function main(): Promise<void> {
  const config = loadConfig({
    ...process.env,
    MCP_TRANSPORT: 'stdio'
  });
  const app = await buildInvestigationApp({ config });
  const state = {
    initialized: false
  };
  const decoder = createStdioMessageDecoder();

  try {
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
      let messages;
      try {
        messages = decoder.push(chunk);
      } catch (error) {
        process.stdout.write(
          createStdioFrame({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: error instanceof Error ? error.message : 'Parse error'
            }
          })
        );
        continue;
      }

      for (const parsed of messages) {
        const response = await handleStdioProtocolMessage(parsed as Parameters<typeof handleStdioProtocolMessage>[0], {
          server: app.mcpServer,
          state,
          hostConfig: {
            ...DEFAULT_HOST_CONFIG,
            version: config.version
          }
        });

        if (response) {
          process.stdout.write(createStdioFrame(response));
        }
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
