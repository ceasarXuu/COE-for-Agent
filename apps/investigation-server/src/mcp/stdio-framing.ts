export interface JsonRpcEnvelope {
  jsonrpc: '2.0';
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const HEADER_SEPARATOR = '\r\n\r\n';

export function createStdioFrame(message: JsonRpcEnvelope): string {
  const payload = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n${payload}`;
}

export function createStdioMessageDecoder() {
  let buffer = '';

  return {
    push(chunk: string): JsonRpcEnvelope[] {
      buffer += chunk;
      const messages: JsonRpcEnvelope[] = [];

      while (true) {
        const headerEnd = buffer.indexOf(HEADER_SEPARATOR);
        if (headerEnd === -1) {
          break;
        }

        const rawHeaders = buffer.slice(0, headerEnd).split('\r\n');
        const contentLengthHeader = rawHeaders.find((header) => header.toLowerCase().startsWith('content-length:'));
        if (!contentLengthHeader) {
          throw new Error('Missing Content-Length header');
        }

        const contentLength = Number(contentLengthHeader.split(':')[1]?.trim());
        if (!Number.isInteger(contentLength) || contentLength < 0) {
          throw new Error('Invalid Content-Length header');
        }

        const bodyStart = headerEnd + HEADER_SEPARATOR.length;
        const bodyEnd = bodyStart + contentLength;
        if (buffer.length < bodyEnd) {
          break;
        }

        const body = buffer.slice(bodyStart, bodyEnd);
        messages.push(JSON.parse(body) as JsonRpcEnvelope);
        buffer = buffer.slice(bodyEnd);
      }

      return messages;
    }
  };
}
