/**
 * Sends a one-off test event to Sentry ingest (no native app required).
 * Usage: node scripts/test-sentry-ingest.mjs
 * Reads EXPO_PUBLIC_SENTRY_DSN from env or front/app.json extra.sentryDsn
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadDsn() {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN?.trim()) {
    return process.env.EXPO_PUBLIC_SENTRY_DSN.trim();
  }
  const appJson = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
  const dsn = appJson?.expo?.extra?.sentryDsn;
  if (dsn?.trim()) return dsn.trim();
  throw new Error('No DSN: set EXPO_PUBLIC_SENTRY_DSN or extra.sentryDsn in app.json');
}

function parseDsn(dsn) {
  const u = new URL(dsn);
  const projectId = u.pathname.replace(/^\//, '');
  const publicKey = u.username;
  const host = u.host;
  if (!publicKey || !projectId || !host) {
    throw new Error('Invalid DSN format');
  }
  return { publicKey, projectId, host };
}

const dsn = loadDsn();
const { publicKey, projectId, host } = parseDsn(dsn);
const eventId = crypto.randomUUID().replace(/-/g, '');

const envelope = [
  JSON.stringify({
    event_id: eventId,
    sent_at: new Date().toISOString(),
    sdk: { name: 'sentry.test-script', version: '1.0.0' },
  }),
  JSON.stringify({ type: 'event' }),
  JSON.stringify({
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'node',
    level: 'info',
    logger: '90plus-sentry-test',
    message: '90Plus Sentry connectivity test (automated)',
    tags: { source: 'test-sentry-ingest.mjs' },
  }),
].join('\n');

const url = `https://${host}/api/${projectId}/envelope/`;
const sentryAuth = `Sentry sentry_version=7, sentry_client=test-script/1.0, sentry_key=${publicKey}`;

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-sentry-envelope',
    'X-Sentry-Auth': sentryAuth,
  },
  body: envelope,
});

if (!res.ok) {
  const body = await res.text().catch(() => '');
  console.error('Sentry ingest FAILED:', res.status, res.statusText, body.slice(0, 200));
  process.exit(1);
}

console.log('Sentry ingest OK — event_id:', eventId);
console.log('Check Sentry → Issues (filter: test-sentry-ingest or message contains "connectivity test")');
