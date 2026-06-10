/**
 * Validates Android App Links (assetlinks.json) on production (or local).
 * Also prints iOS vs Android Universal Links health summary.
 *
 * Usage:
 *   npm run test:android-links
 *   UNIVERSAL_LINKS_BASE_URL=http://localhost:3000 npm run test:android-links
 */

const BASE_URL = (process.env.UNIVERSAL_LINKS_BASE_URL ?? 'https://90plus.pro').replace(
  /\/$/,
  '',
);

const ANDROID_PATH = '/.well-known/assetlinks.json';
const EXPECTED_PACKAGE = 'com.mhmdsh1892.ninetyplusapp';
const EXPECTED_RELATION = 'delegate_permission/common.handle_all_urls';

const IOS_PATHS = [
  '/.well-known/apple-app-site-association',
  '/apple-app-site-association',
] as const;

interface CheckResult {
  label: string;
  ok: boolean;
}

interface AssetLinksEntry {
  relation?: string[];
  target?: {
    namespace?: string;
    package_name?: string;
    sha256_cert_fingerprints?: string[];
  };
}

async function validateAndroidLinks(): Promise<boolean> {
  console.log('════════════════════════════════════════════');
  console.log('▶ Android App Links — Validation');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log('════════════════════════════════════════════');

  const checks: CheckResult[] = [];
  const url = `${BASE_URL}${ANDROID_PATH}`;
  let res: Response;

  try {
    res = await fetch(url, { redirect: 'manual' });
  } catch (err) {
    checks.push({
      label: `${ANDROID_PATH} → fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      ok: false,
    });
    for (const c of checks) {
      console.log(`   ${c.ok ? '✅' : '❌'} ${c.label}`);
    }
    console.log('════════════════════════════════════════════');
    return false;
  }

  checks.push({
    label: `${ANDROID_PATH} → ${res.status}`,
    ok: res.status === 200,
  });

  const isRedirect = res.status >= 300 && res.status < 400;
  checks.push({ label: 'no redirect', ok: !isRedirect });

  const contentType = res.headers.get('content-type') ?? '';
  checks.push({
    label: 'Content-Type: application/json',
    ok: contentType.toLowerCase().includes('application/json'),
  });

  let body: unknown;
  const text = await res.text();
  try {
    body = JSON.parse(text);
    checks.push({ label: 'valid JSON', ok: true });
  } catch {
    checks.push({ label: 'valid JSON', ok: false });
    for (const c of checks) {
      console.log(`   ${c.ok ? '✅' : '❌'} ${c.label}`);
    }
    console.log('════════════════════════════════════════════');
    return false;
  }

  const entries = body as AssetLinksEntry[];
  const entry = Array.isArray(entries) ? entries[0] : undefined;

  checks.push({
    label: `package_name: ${EXPECTED_PACKAGE}`,
    ok: entry?.target?.package_name === EXPECTED_PACKAGE,
  });

  checks.push({
    label: `relation: ${EXPECTED_RELATION}`,
    ok: Array.isArray(entry?.relation) && entry.relation.includes(EXPECTED_RELATION),
  });

  const fingerprints = entry?.target?.sha256_cert_fingerprints ?? [];
  checks.push({
    label: 'sha256_cert_fingerprints present',
    ok: Array.isArray(fingerprints) && fingerprints.length > 0,
  });

  let allOk = true;
  for (const c of checks) {
    console.log(`   ${c.ok ? '✅' : '❌'} ${c.label}`);
    if (!c.ok) allOk = false;
  }
  console.log('════════════════════════════════════════════');

  return allOk;
}

async function validateIosAasa(): Promise<boolean> {
  for (const path of IOS_PATHS) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, { redirect: 'manual' });
      if (res.status !== 200 || res.status >= 300) continue;

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('application/json')) continue;

      const body = (await res.json()) as {
        applinks?: { details?: Array<{ appIDs?: string[]; components?: Array<{ '/': string }> }> };
      };

      const details = body.applinks?.details?.[0];
      if (!details) continue;

      const hasAppId = (details.appIDs ?? []).some((id) => id.includes(EXPECTED_PACKAGE));
      const paths = (details.components ?? []).map((c) => c['/']);
      const hasReels = paths.includes('/reels/*');
      const hasProfile = paths.includes('/@*');

      if (hasAppId && hasReels && hasProfile) return true;
    } catch {
      // try next path
    }
  }
  return false;
}

async function main(): Promise<void> {
  const androidOk = await validateAndroidLinks();
  const iosOk = await validateIosAasa();

  console.log('');
  console.log('════════════════════════════════════════════');
  console.log('▶ Universal Links Health Check');
  console.log(`   iOS  AASA : ${iosOk ? '✅' : '❌'}`);
  console.log(`   Android App Links: ${androidOk ? '✅' : '❌'}`);
  console.log('════════════════════════════════════════════');

  process.exit(androidOk && iosOk ? 0 : 1);
}

main();
