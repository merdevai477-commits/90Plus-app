#!/usr/bin/env npx tsx
/**
 * Detect Clerk/API mismatches that cause 401 on emulator (pk_test + sk_live).
 *
 * Run before testing: npx tsx scripts/verify-emulator-auth.ts
 * Or: npm run verify:auth
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const ROOT = process.cwd();
const PRODUCTION_API_HOSTS = ['90plus.pro', 'accounts.90plus.pro'];

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function clerkMode(pk?: string): 'live' | 'test' | 'missing' {
  if (!pk) return 'missing';
  if (pk.startsWith('pk_live_')) return 'live';
  if (pk.startsWith('pk_test_')) return 'test';
  return 'missing';
}

function apiHost(apiUrl?: string): string | null {
  if (!apiUrl) return null;
  try {
    return new URL(apiUrl).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isProductionApiHost(host: string | null): boolean {
  if (!host) return false;
  return PRODUCTION_API_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

function isLocalApiHost(host: string | null): boolean {
  if (!host) return false;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host === '10.0.2.2' ||
    host.includes('ngrok')
  );
}

function checkPair(
  label: string,
  pk: string | undefined,
  apiUrl: string | undefined,
  issues: string[],
  ok: string[],
): void {
  const mode = clerkMode(pk);
  const host = apiHost(apiUrl);

  if (!apiUrl) {
    issues.push(`${label}: EXPO_PUBLIC_API_URL missing`);
    return;
  }
  if (mode === 'missing') {
    issues.push(`${label}: EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY missing or invalid`);
    return;
  }

  const prodApi = isProductionApiHost(host);
  const localApi = isLocalApiHost(host);

  if (prodApi && mode === 'test') {
    issues.push(
      `${label}: pk_test + ${host} → 401 on /api/clerk/me (use pk_live or local API + sk_test backend)`,
    );
    return;
  }
  if (localApi && mode === 'live') {
    issues.push(
      `${label}: pk_live + ${host} → mismatch unless local backend uses sk_live (usually use pk_test + sk_test locally)`,
    );
    return;
  }
  if (prodApi && mode === 'live') {
    ok.push(`${label}: pk_live + ${host} ✅`);
    return;
  }
  if (localApi && mode === 'test') {
    ok.push(`${label}: pk_test + ${host} (local dev) ✅`);
    return;
  }
  ok.push(`${label}: ${mode} + ${host ?? apiUrl}`);
}

function readEasProfiles(): Array<{ name: string; env: Record<string, string> }> {
  const easPath = path.join(ROOT, 'front', 'eas.json');
  if (!fs.existsSync(easPath)) return [];
  const eas = JSON.parse(fs.readFileSync(easPath, 'utf8')) as {
    build?: Record<string, { env?: Record<string, string> }>;
  };
  return Object.entries(eas.build ?? {}).map(([name, cfg]) => ({
    name: `eas.json → ${name}`,
    env: cfg.env ?? {},
  }));
}

async function probeProductionBackend(): Promise<void> {
  const issues: string[] = [];
  const ok: string[] = [];

  try {
    const health = await fetch('https://90plus.pro/api/health');
    if (health.ok) ok.push('Production API /health OK');
    else issues.push(`Production API /health returned ${health.status}`);
  } catch (e) {
    issues.push(`Production API unreachable: ${(e as Error).message}`);
  }

  try {
    const me = await fetch('https://90plus.pro/api/clerk/me');
    if (me.status === 401) {
      ok.push('/api/clerk/me without token → 401 (expected until signed in)');
    } else {
      issues.push(`/api/clerk/me without token → ${me.status} (expected 401)`);
    }
  } catch (e) {
    issues.push(`Could not probe /clerk/me: ${(e as Error).message}`);
  }

  try {
    const wh = await fetch('https://90plus.pro/api/webhooks/clerk/health').then((r) => r.json());
    if (wh.webhookSecretConfigured) ok.push('Railway CLERK_WEBHOOK_SECRET configured');
    else issues.push('Railway CLERK_WEBHOOK_SECRET missing');
  } catch {
    issues.push('Could not reach /api/webhooks/clerk/health');
  }

  console.log('\n--- Production backend ---');
  ok.forEach((l) => console.log('✅', l));
  issues.forEach((l) => console.log('❌', l));
}

async function main() {
  const issues: string[] = [];
  const ok: string[] = [];

  const rootEnv = process.env;
  const frontEnv = parseEnvFile(path.join(ROOT, 'front', '.env'));

  if (fs.existsSync(path.join(ROOT, 'front', '.env'))) {
    if (frontEnv.CLERK_SECRET_KEY?.startsWith('sk_')) {
      issues.push('front/.env contains CLERK_SECRET_KEY — move to root .env only (security)');
    }
  } else {
    issues.push('front/.env missing — copy from front/.env.example');
  }

  checkPair(
    'front/.env (npm start / emulator)',
    frontEnv.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    frontEnv.EXPO_PUBLIC_API_URL,
    issues,
    ok,
  );

  const rootSk = rootEnv.CLERK_SECRET_KEY;
  const frontPk = frontEnv.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (rootSk?.startsWith('sk_live_') && clerkMode(frontPk) === 'test') {
    issues.push('root .env sk_live + front/.env pk_test → emulator 401');
  } else if (rootSk?.startsWith('sk_live_') && clerkMode(frontPk) === 'live') {
    ok.push('root .env sk_live + front/.env pk_live aligned');
  } else if (rootSk?.startsWith('sk_test_') && clerkMode(frontPk) === 'test') {
    ok.push('root .env sk_test + front/.env pk_test (local dev stack)');
  }

  for (const profile of readEasProfiles()) {
    checkPair(
      profile.name,
      profile.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
      profile.env.EXPO_PUBLIC_API_URL,
      issues,
      ok,
    );
  }

  console.log('\n=== 90Plus Emulator Auth Check ===\n');
  ok.forEach((line) => console.log('✅', line));
  issues.forEach((line) => console.log('❌', line));

  if (issues.length === 0) {
    console.log('\nNo Clerk/API mismatches detected.');
    console.log('If you still see 401: sign out → clear app data → expo start --clear → sign in (Production account).\n');
  } else {
    console.log('\nFix mismatches above, then: cd front && npx expo start --clear\n');
  }

  await probeProductionBackend();

  process.exit(issues.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
