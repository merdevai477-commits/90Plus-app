/**
 * Validates Apple App Site Association (AASA) endpoints on production (or local).
 *
 * Usage:
 *   npm run test:universal-links
 *   UNIVERSAL_LINKS_BASE_URL=http://localhost:3000 npm run test:universal-links
 */

import { AASA_ACTIVE_PATHS } from '../src/config/appleAppSite';

const BASE_URL = (process.env.UNIVERSAL_LINKS_BASE_URL ?? 'https://90plus.pro').replace(
  /\/$/,
  '',
);

const PATHS = [
  '/.well-known/apple-app-site-association',
  '/apple-app-site-association',
] as const;

const EXPECTED_BUNDLE = 'com.mhmdsh1892.ninetyplusapp';
/*
 * Read from the config the server actually serves, so this validator can never
 * pass while a newly claimed path (e.g. the Share & Earn '/invite/*') is
 * missing from production. A hardcoded copy here is exactly how /invite/* went
 * unnoticed: the checker only ever asked about the paths it already knew.
 */
const EXPECTED_PATHS: string[] = [...AASA_ACTIVE_PATHS];

interface CheckResult {
  label: string;
  ok: boolean;
}

async function validatePath(path: string): Promise<{
  checks: CheckResult[];
  body?: unknown;
}> {
  const checks: CheckResult[] = [];
  const url = `${BASE_URL}${path}`;
  let res: Response;

  try {
    res = await fetch(url, { redirect: 'manual' });
  } catch (err) {
    checks.push({
      label: `${path} → fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      ok: false,
    });
    return { checks };
  }

  checks.push({
    label: `${path} → ${res.status}`,
    ok: res.status === 200,
  });

  const isRedirect = res.status >= 300 && res.status < 400;
  checks.push({
    label: `${path} → no redirect`,
    ok: !isRedirect,
  });

  const contentType = res.headers.get('content-type') ?? '';
  checks.push({
    label: `${path} → Content-Type: application/json`,
    ok: contentType.toLowerCase().includes('application/json'),
  });

  let body: unknown;
  const text = await res.text();
  try {
    body = JSON.parse(text);
    checks.push({ label: `${path} → valid JSON`, ok: true });
  } catch {
    checks.push({ label: `${path} → valid JSON`, ok: false });
    return { checks };
  }

  const aasa = body as {
    applinks?: { details?: Array<{ appIDs?: string[]; components?: Array<{ '/': string }> }> };
    webcredentials?: { apps?: string[] };
  };

  checks.push({
    label: `${path} → applinks.details present`,
    ok: Array.isArray(aasa.applinks?.details) && aasa.applinks.details.length > 0,
  });

  const appIds = aasa.applinks?.details?.[0]?.appIDs ?? [];
  checks.push({
    label: `${path} → appID contains ${EXPECTED_BUNDLE}`,
    ok: appIds.some((id) => id.includes(EXPECTED_BUNDLE)),
  });

  const components = aasa.applinks?.details?.[0]?.components ?? [];
  const paths = components.map((c) => c['/']).filter(Boolean);
  for (const expected of EXPECTED_PATHS) {
    checks.push({
      label: `${path} → path ${expected}`,
      ok: paths.includes(expected),
    });
  }

  return { checks, body };
}

async function main(): Promise<void> {
  console.log('════════════════════════════════════════════');
  console.log('▶ Apple App Site Association — Validation');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log('════════════════════════════════════════════');

  let allOk = true;
  let lastAppId = '';
  let lastPaths: string[] = [];

  for (const path of PATHS) {
    const { checks, body } = await validatePath(path);
    for (const c of checks) {
      const icon = c.ok ? '✅' : '❌';
      console.log(`   ${icon} ${c.label}`);
      if (!c.ok) allOk = false;
    }

    const aasa = body as {
      applinks?: { details?: Array<{ appIDs?: string[]; components?: Array<{ '/': string }> }> };
    };
    if (aasa?.applinks?.details?.[0]) {
      lastAppId = aasa.applinks.details[0].appIDs?.[0] ?? '';
      lastPaths =
        aasa.applinks.details[0].components?.map((c) => c['/']).filter(Boolean) ?? [];
    }
    console.log('');
  }

  if (lastAppId) {
    console.log(`   ✅ appID found: ${lastAppId}`);
  }
  if (lastPaths.length) {
    console.log(`   ✅ paths: ${lastPaths.join(', ')}`);
  }
  console.log('════════════════════════════════════════════');

  process.exit(allOk ? 0 : 1);
}

main();
