/**
 * Direct APNs (HTTP/2 + ES256 provider token) for iOS Live Activities.
 * Expo push cannot address Live Activity tokens, so these go straight to Apple.
 *
 * Env: APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (.p8 contents; literal "\n" accepted),
 * optional APNS_BUNDLE_ID (defaults to the app bundle id).
 */

import { createSign } from 'node:crypto';
import http2 from 'node:http2';
import { logger } from '../utils/logger';

const PRODUCTION_HOST = 'https://api.push.apple.com';
const SANDBOX_HOST = 'https://api.sandbox.push.apple.com';
/** Apple rejects provider tokens older than 60 minutes and throttles ones refreshed more than every 20. */
const TOKEN_TTL_MS = 50 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

export interface ApnsResult {
  status: number;
  reason: string | null;
}

let cachedJwt: { value: string; at: number } | null = null;
const sessions = new Map<string, http2.ClientHttp2Session>();

function config() {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const bundleId = process.env.APNS_BUNDLE_ID?.trim() || 'com.mhmdsh1892.ninetyplusapp';
  return { keyId, teamId, privateKey, bundleId };
}

export function isApnsConfigured(): boolean {
  const { keyId, teamId, privateKey } = config();
  return Boolean(keyId && teamId && privateKey);
}

function providerToken(): string {
  const now = Date.now();
  if (cachedJwt && now - cachedJwt.at < TOKEN_TTL_MS) return cachedJwt.value;
  const { keyId, teamId, privateKey } = config();
  if (!keyId || !teamId || !privateKey) throw new Error('APNs is not configured');
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ iss: teamId, iat: Math.floor(now / 1000) })).toString('base64url');
  const signer = createSign('SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  cachedJwt = { value: `${header}.${claims}.${signature}`, at: now };
  return cachedJwt.value;
}

function session(host: string): http2.ClientHttp2Session {
  const existing = sessions.get(host);
  if (existing && !existing.closed && !existing.destroyed) return existing;
  const created = http2.connect(host);
  created.on('error', (err) => {
    logger.warn(`[APNs] session error (${host}):`, err.message);
    sessions.delete(host);
  });
  created.on('close', () => sessions.delete(host));
  created.unref();
  sessions.set(host, created);
  return created;
}

function post(host: string, deviceToken: string, headers: Record<string, string>, body: string): Promise<ApnsResult> {
  return new Promise((resolve) => {
    let client: http2.ClientHttp2Session;
    try {
      client = session(host);
    } catch (err) {
      resolve({ status: 0, reason: (err as Error).message });
      return;
    }
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken()}`,
      ...headers,
    });
    let status = 0;
    let raw = '';
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.close(http2.constants.NGHTTP2_CANCEL));
    req.on('response', (h) => {
      status = Number(h[':status'] ?? 0);
    });
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      raw += chunk;
    });
    req.on('end', () => {
      let reason: string | null = null;
      if (raw) {
        try {
          reason = (JSON.parse(raw) as { reason?: string }).reason ?? null;
        } catch {
          reason = raw.slice(0, 120);
        }
      }
      resolve({ status, reason });
    });
    req.on('error', (err) => resolve({ status: 0, reason: err.message }));
    req.end(body);
  });
}

/** Whether a failed send means the token will never work again and should be forgotten. */
export function isDeadToken(result: ApnsResult): boolean {
  return (
    result.status === 410 ||
    result.reason === 'BadDeviceToken' ||
    result.reason === 'Unregistered' ||
    result.reason === 'DeviceTokenNotForTopic'
  );
}

/**
 * Sends a Live Activity push. Development builds register sandbox tokens, which production
 * rejects with BadDeviceToken, so an unknown token falls back to the sandbox once.
 */
export async function sendLiveActivityPush(
  deviceToken: string,
  aps: Record<string, unknown>,
  options: { priority: 5 | 10; sandbox: boolean | null },
): Promise<ApnsResult & { sandbox: boolean }> {
  const { bundleId } = config();
  const headers = {
    'apns-push-type': 'liveactivity',
    'apns-topic': `${bundleId}.push-type.liveactivity`,
    'apns-priority': String(options.priority),
    'apns-expiration': String(Math.floor(Date.now() / 1000) + 10 * 60),
  };
  const body = JSON.stringify({ aps });

  if (options.sandbox === true) {
    return { ...(await post(SANDBOX_HOST, deviceToken, headers, body)), sandbox: true };
  }
  const production = await post(PRODUCTION_HOST, deviceToken, headers, body);
  if (options.sandbox === null && production.reason === 'BadDeviceToken') {
    const sandbox = await post(SANDBOX_HOST, deviceToken, headers, body);
    if (sandbox.status === 200) return { ...sandbox, sandbox: true };
  }
  return { ...production, sandbox: false };
}

export function closeApnsSessions(): void {
  for (const s of sessions.values()) s.close();
  sessions.clear();
}
