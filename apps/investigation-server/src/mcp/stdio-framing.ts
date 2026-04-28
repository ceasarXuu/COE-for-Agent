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
        const parsed: unknown = JSON.parse(body);
        messages.push(validateJsonRpcEnvelope(parsed));
        buffer = buffer.slice(bodyEnd);
      }

      return messages;
    }
  };
}

function validateJsonRpcEnvelope(value: unknown): JsonRpcEnvelope {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('JSON-RPC envelope must be an object');
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.jsonrpc !== '2.0') {
    throw new Error('JSON-RPC envelope must have jsonrpc === "2.0"');
  }

  if ('id' in candidate) {
    const id = candidate.id;
    if (id !== null && typeof id !== 'string' && typeof id !== 'number') {
      throw new Error('JSON-RPC id must be string, number, or null');
    }
  }

  if ('method' in candidate && typeof candidate.method !== 'string') {
    throw new Error('JSON-RPC method must be a string when present');
  }

  for (const objectField of ['params', 'result'] as const) {
    if (objectField in candidate) {
      const fieldValue = candidate[objectField];
      if (fieldValue !== undefined && (typeof fieldValue !== 'object' || fieldValue === null || Array.isArray(fieldValue))) {
        throw new Error(`JSON-RPC ${objectField} must be an object when present`);
      }
    }
  }

  if ('error' in candidate && candidate.error !== undefined) {
    const error = candidate.error;
    if (typeof error !== 'object' || error === null || Array.isArray(error)) {
      throw new Error('JSON-RPC error must be an object when present');
    }
    const errorCandidate = error as Record<string, unknown>;
    if (typeof errorCandidate.code !== 'number') {
      throw new Error('JSON-RPC error.code must be a number');
    }
    if (typeof errorCandidate.message !== 'string') {
      throw new Error('JSON-RPC error.message must be a string');
    }
  }

  return candidate as unknown as JsonRpcEnvelope;
}
