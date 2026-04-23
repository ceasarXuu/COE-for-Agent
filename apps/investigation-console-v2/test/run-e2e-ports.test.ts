import { describe, expect, test, vi } from 'vitest';

import { resolvePortPlan } from '../scripts/run-e2e-ports.mjs';

describe('run-e2e port selection', () => {
  test('falls back to the next free default ports when the defaults are occupied', async () => {
    const isPortAvailable = vi.fn(async (port: number) => ![4173, 4318].includes(port));

    await expect(resolvePortPlan({
      requestedWebPort: 4173,
      requestedBffPort: 4318,
      explicitWebPort: false,
      explicitBffPort: false,
      isPortAvailable
    })).resolves.toEqual({
      webPort: 4174,
      bffPort: 4319
    });
  });

  test('fails fast when an explicitly requested port is occupied', async () => {
    const isPortAvailable = vi.fn(async (port: number) => port !== 4173);

    await expect(resolvePortPlan({
      requestedWebPort: 4173,
      requestedBffPort: 4318,
      explicitWebPort: true,
      explicitBffPort: false,
      isPortAvailable
    })).rejects.toThrow('Console web port 4173 is already in use. Stop the existing process and retry.');
  });
});