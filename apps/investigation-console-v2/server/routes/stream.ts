import type { FastifyInstance } from 'fastify';

import { consoleTelemetry } from '../telemetry.js';

export async function registerStreamRoutes(app: FastifyInstance) {
  app.get('/api/stream', async (_request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });

    const writeEvent = (eventName: string, payload: unknown) => {
      reply.raw.write(`event: ${eventName}\n`);
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const unsubscribeHead = consoleTelemetry.subscribe('case.head_revision.changed', (payload) => {
      writeEvent('case.head_revision.changed', payload);
    });
    const unsubscribeProjection = consoleTelemetry.subscribe('case.projection.updated', (payload) => {
      writeEvent('case.projection.updated', payload);
    });

    reply.raw.on('close', () => {
      unsubscribeHead();
      unsubscribeProjection();
      reply.raw.end();
    });

    writeEvent('ready', { ok: true });
    return reply;
  });
}