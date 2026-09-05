import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { basicHealthCheck } from '../health-check.middleware';
import { KEEP_ALIVE_HEALTH_PATH, keepAliveUrl } from '../../services/warmup.service';

/**
 * Mirrors the production order that caused BACKEND-76/2K:
 * catch-all skips `/health`, then a 404 handler would fire unless `/health`
 * is registered first.
 */
function buildApp(): express.Express {
  const app = express();
  app.get('/health', basicHealthCheck);
  app.get('/api/health', basicHealthCheck);

  const EXCLUDED = ['/api', '/.well-known', '/apple-app-site-association', '/health'];
  app.get('*', (req, res, next) => {
    if (EXCLUDED.some((prefix) => req.path.startsWith(prefix))) return next();
    res.redirect(301, 'https://90plus.pro');
  });
  app.use((req, res) => {
    res.status(404).json({ status: 'ERROR', message: 'Route not found', path: req.path });
  });
  return app;
}

describe('public liveness probe (keep-alive target)', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = buildApp().listen(0, '127.0.0.1', () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it('keep-alive is aimed at GET /health, not /api/health', () => {
    expect(KEEP_ALIVE_HEALTH_PATH).toBe('/health');
    expect(keepAliveUrl(3000)).toBe('http://localhost:3000/health');
  });

  it('returns 200 for the keep-alive path', async () => {
    const response = await fetch(`${base}${KEEP_ALIVE_HEALTH_PATH}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('OK');
  });

  it('still serves /api/health as 200', async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(200);
  });
});
