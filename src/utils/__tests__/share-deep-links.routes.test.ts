/**
 * SHARE & EARN DEEP LINKS — served over real HTTP.
 *
 * The manifest tests next door check what the config OBJECTS say. This one
 * boots the actual express handlers on a socket and asks the questions iOS and
 * Android ask at install/verification time, because those two agents are
 * fussy in ways a unit test cannot see:
 *
 *   • AASA must be 200, application/json, and NOT a redirect. The app's
 *     catch-all `app.get('*')` 301s everything unmatched to the marketing
 *     site, so a mis-ordered route silently turns link verification off.
 *   • assetlinks.json must carry the release SHA-256 or Android will not
 *     verify the App Link and the invite opens Chrome instead of the app.
 *   • /invite/:code must answer with the landing page (for phones without the
 *     app) rather than 404 or redirect to the website root.
 */

import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

import supportRoutes from '../../routes/support.routes';
import { buildAppleAppSiteAssociation } from '../../config/appleAppSite';
import {
  buildAssetLinksJson,
  resolveAndroidSha256Fingerprints,
  ANDROID_PACKAGE_NAME,
  ANDROID_RELEASE_SHA256,
} from '../../config/androidAppLinks';
import { PLAY_STORE_URL, APP_STORE_URL } from '../share-landing-pages';

/**
 * The same mounting ORDER src/main.ts uses. Order is the thing under test as
 * much as the handlers are: the catch-all redirect must come last and must
 * skip the well-known paths.
 */
function buildApp(): express.Express {
  const app = express();

  app.use('/', supportRoutes);

  app.get('/.well-known/assetlinks.json', (_req, res) => {
    const fingerprints = resolveAndroidSha256Fingerprints(process.env.ANDROID_RELEASE_SHA256);
    res.setHeader('Content-Type', 'application/json');
    res.json(buildAssetLinksJson(fingerprints));
  });

  const sendAasa = (_req: express.Request, res: express.Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).json(buildAppleAppSiteAssociation());
  };
  app.get('/.well-known/apple-app-site-association', sendAasa);
  app.get('/apple-app-site-association', sendAasa);

  const EXCLUDED = ['/api', '/.well-known', '/apple-app-site-association', '/health'];
  app.get('*', (req, res, next) => {
    if (EXCLUDED.some((prefix) => req.path.startsWith(prefix))) return next();
    res.redirect(301, 'https://90plus.pro');
  });

  return app;
}

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

/** `redirect: 'manual'` — a 301 must be observable, not followed. */
const get = (path: string) => fetch(`${base}${path}`, { redirect: 'manual' });

describe('GET /.well-known/apple-app-site-association', () => {
  it('answers 200 with no redirect', async () => {
    const res = await get('/.well-known/apple-app-site-association');
    expect(res.status).toBe(200);
  });

  it('is served as application/json', async () => {
    const res = await get('/.well-known/apple-app-site-association');
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('claims the referral paths', async () => {
    const res = await get('/.well-known/apple-app-site-association');
    const body = (await res.json()) as any;
    const claimed = body.applinks.details[0].components.map((c: Record<string, string>) => c['/']);

    expect(claimed).toContain('/invite/*');
    expect(claimed).toContain('/ref/*');
  });

  it('is also reachable at the legacy root path iOS still probes', async () => {
    const res = await get('/apple-app-site-association');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.applinks.details[0].components.map((c: Record<string, string>) => c['/'])).toContain(
      '/invite/*',
    );
  });
});

describe('GET /.well-known/assetlinks.json', () => {
  it('answers 200 as json', async () => {
    const res = await get('/.well-known/assetlinks.json');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('delegates all urls to the release-signed app', async () => {
    const res = await get('/.well-known/assetlinks.json');
    const body = (await res.json()) as any;

    expect(body[0].relation).toContain('delegate_permission/common.handle_all_urls');
    expect(body[0].target.package_name).toBe(ANDROID_PACKAGE_NAME);
    expect(body[0].target.sha256_cert_fingerprints).toContain(ANDROID_RELEASE_SHA256);
  });
});

describe('GET /invite/:code — the web fallback', () => {
  it('serves the landing page instead of redirecting to the website root', async () => {
    const res = await get('/invite/AB23CD');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('keeps the code in every route it offers', async () => {
    const html = await (await get('/invite/AB23CD')).text();

    expect(html).toContain('ninetyplus://invite/AB23CD');
    expect(html).toContain('intent://invite/AB23CD#Intent');
  });

  it('sends a phone with no app to a store, never back to itself', async () => {
    const html = await (await get('/invite/AB23CD')).text();
    const fallback = decodeURIComponent(/browser_fallback_url=([^;]+);/.exec(html)?.[1] ?? '');

    expect(fallback).toBe(PLAY_STORE_URL);
    expect(html).toContain(APP_STORE_URL);
  });

  it('accepts the /ref alias the same way', async () => {
    const html = await (await get('/ref/AB23CD')).text();
    expect(html).toContain('ninetyplus://invite/AB23CD');
  });

  it('lowercase codes still resolve — links get mangled by chat apps', async () => {
    const res = await get('/invite/ab23cd');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('ninetyplus://invite/AB23CD');
  });

  it('rejects a code that is not a real referral code', async () => {
    // 'I', 'O', '0', '1' are excluded from the alphabet on purpose.
    expect((await get('/invite/AB23C')).status).toBe(404);
    expect((await get('/invite/AB23CDE')).status).toBe(404);
    expect((await get('/invite/AB0O1D')).status).toBe(404);
  });

  it('does not swallow unrelated paths — those still go to the website', async () => {
    const res = await get('/something-else');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://90plus.pro');
  });
});
