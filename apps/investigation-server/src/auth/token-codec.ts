import { createHmac, timingSafeEqual } from 'node:crypto';

function encodeJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeJson(encoded: string): Record<string, unknown> {
  const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
  const value = JSON.parse(decoded) as unknown;

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Token payload must be an object');
  }

  return value as Record<string, unknown>;
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function issueSignedToken(payload: Record<string, unknown>, secret: string): string {
  const encodedPayload = encodeJson(payload);
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifySignedToken(token: string, secret: string): Record<string, unknown> {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Malformed signed token');
  }

  const expectedSignature = sign(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error('Signed token signature mismatch');
  }

  return decodeJson(encodedPayload);
}