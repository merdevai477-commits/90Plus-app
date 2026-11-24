import express from 'express';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import type { AddressInfo } from 'net';

/**
 * Mirrors the production YouTube embed CSP from main.ts so we can assert
 * headers without booting the full API process.
 */
function buildYoutubeEmbedApp(htmlPath: string) {
  const app = express();
  const isProduction = true;

  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
              mediaSrc: ["'self'", 'blob:', 'https://stream.mux.com', 'https://*.mux.com'],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              connectSrc: ["'self'", 'https://stream.mux.com', 'https://*.mux.com'],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const youtubeEmbedCsp = helmet.contentSecurityPolicy({
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://www.youtube.com',
        'https://www.youtube-nocookie.com',
        'https://s.ytimg.com',
      ],
      frameSrc: ['https://www.youtube.com', 'https://www.youtube-nocookie.com'],
      connectSrc: [
        "'self'",
        'https://www.youtube.com',
        'https://www.youtube-nocookie.com',
        'https://s.ytimg.com',
        'https://*.googlevideo.com',
      ],
      imgSrc: ["'self'", 'data:', 'https://i.ytimg.com', 'https://*.ytimg.com'],
      mediaSrc: ["'self'", 'blob:', 'https://*.googlevideo.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  });

  // Route before static — same ordering requirement as main.ts.
  app.get(['/embed/youtube', '/embed/youtube.html'], youtubeEmbedCsp, (_req, res) => {
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.sendFile(htmlPath);
  });

  app.use(express.static(path.dirname(path.dirname(htmlPath))));

  app.get('/api/health-csp-probe', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

async function fetchApp(
  app: express.Application,
  routePath: string,
): Promise<{ status: number; headers: Headers; text: string }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}${routePath}`);
    const text = await res.text();
    return { status: res.status, headers: res.headers, text };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe('YouTube embed CSP (route-scoped)', () => {
  const htmlPath = path.join(__dirname, '../../public/embed/youtube.html');

  it('ships the hosted player HTML used by production', () => {
    expect(fs.existsSync(htmlPath)).toBe(true);
    const html = fs.readFileSync(htmlPath, 'utf8');
    expect(html).toContain('https://www.youtube.com/iframe_api');
    expect(html).toContain("post('YT_ERROR:'");
    expect(html).toContain('onYouTubeIframeAPIReady');
  });

  it('overrides global Helmet CSP and no-referrer on the embed routes', async () => {
    const app = buildYoutubeEmbedApp(htmlPath);

    for (const route of ['/embed/youtube.html', '/embed/youtube']) {
      const res = await fetchApp(app, route);
      expect(res.status).toBe(200);
      const csp = String(res.headers.get('content-security-policy') || '');
      expect(csp).toContain('script-src');
      expect(csp).toContain('https://www.youtube.com');
      expect(csp).toContain('https://www.youtube-nocookie.com');
      expect(csp).toContain('https://s.ytimg.com');
      expect(csp).toContain('frame-src');
      expect(csp).toContain('https://*.googlevideo.com');
      expect(csp).not.toContain('unsafe-eval');
      // Must not be the global-only policy (script-src 'self' alone).
      expect(csp).not.toMatch(/script-src 'self'(;|$)/);
      expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      expect(res.text).toContain('iframe_api');
    }
  });

  it('leaves unrelated routes under the global script-src self policy', async () => {
    const app = buildYoutubeEmbedApp(htmlPath);
    const res = await fetchApp(app, '/api/health-csp-probe');
    expect(res.status).toBe(200);
    const csp = String(res.headers.get('content-security-policy') || '');
    expect(csp).toMatch(/script-src[^;]*'self'/);
    expect(csp).not.toContain('https://www.youtube.com');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });
});
