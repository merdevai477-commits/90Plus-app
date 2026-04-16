/**
 * Mux Upload Integration Test
 *
 * Tests the full reel upload flow via the production API.
 * Gets a fresh Clerk session token before each request (tokens expire in 60s).
 *
 * Usage: npm run test:mux
 *
 * Required .env: CLERK_SECRET_KEY + TEST_CLERK_USER_ID
 * Optional .env: TEST_API_URL
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { createClerkClient } from '@clerk/backend';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_BASE = process.env.TEST_API_URL ||
  'https://90plus-app-production-b28d.up.railway.app/api';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY!;
if (!CLERK_SECRET_KEY) { console.error('❌ CLERK_SECRET_KEY not set'); process.exit(1); }

const TEST_CLERK_USER_ID = process.env.TEST_CLERK_USER_ID;
if (!TEST_CLERK_USER_ID) { console.error('❌ TEST_CLERK_USER_ID not set'); process.exit(1); }

const c = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m',
};
function log(msg: string, color = c.reset) { console.log(`${color}${msg}${c.reset}`); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Token factory — always fresh ────────────────────────────────────────────
// Clerk session tokens expire in 60s. We fetch a new one before each request.

const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
let _cachedSessionId: string | null = null;

async function getFreshToken(): Promise<string> {
  // Find active session once, then reuse session ID
  if (!_cachedSessionId) {
    const sessions = await clerk.sessions.getSessionList({
      userId: TEST_CLERK_USER_ID!,
      status: 'active',
    });
    if (!sessions.data.length) {
      throw new Error(
        `No active sessions for user ${TEST_CLERK_USER_ID}.\n` +
        `  Open the app on your phone to create an active session, then retry.`
      );
    }
    _cachedSessionId = sessions.data[0].id;
    log(`  ✓ Using session: ${_cachedSessionId!.substring(0, 25)}...`, c.green);
  }

  const result = await clerk.sessions.getToken(_cachedSessionId!, 'default');
  return result.jwt;
}

// ─── HTTPS helper ─────────────────────────────────────────────────────────────

function httpsRequest(options: https.RequestOptions, body?: Buffer | string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transport = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    transport.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.existsSync(dest) && fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', err => { fs.existsSync(dest) && fs.unlinkSync(dest); reject(err); });
  });
}

// ─── Step 1: Verify token works ───────────────────────────────────────────────

async function verifyAuth(): Promise<void> {
  log('\n[1/4] Verifying auth token...', c.cyan);
  log(`  ✓ Clerk User ID: ${TEST_CLERK_USER_ID}`, c.green);

  const token = await getFreshToken();
  log(`  ✓ Fresh token: ${token.substring(0, 40)}...`, c.green);

  // Test against /api/clerk/me
  const parsedUrl = new URL(`${API_BASE}/clerk/me`);
  const res = await httpsRequest({
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (res.status === 302) {
    throw new Error('Token rejected by server (302 redirect). Session may be expired.');
  }
  if (res.status !== 200) {
    throw new Error(`Auth check failed: HTTP ${res.status} — ${res.text.substring(0, 200)}`);
  }

  const data = JSON.parse(res.text);
  log(`  ✓ Authenticated as: ${data.data?.user?.username ?? 'unknown'}`, c.green);
}

// ─── Step 2: Ensure test video ────────────────────────────────────────────────

async function ensureTestVideo(): Promise<string> {
  log('\n[2/4] Checking test video...', c.cyan);
  const videoPath = path.resolve(__dirname, 'test.mp4');

  if (fs.existsSync(videoPath)) {
    log(`  ✓ test.mp4 ready (${(fs.statSync(videoPath).size / 1024 / 1024).toFixed(2)} MB)`, c.green);
    return videoPath;
  }

  for (const url of ['https://www.w3schools.com/html/mov_bbb.mp4']) {
    try {
      log(`  ⬇  Downloading ${url}`, c.yellow);
      await downloadFile(url, videoPath);
      if (fs.statSync(videoPath).size > 10000) {
        log(`  ✓ Downloaded (${(fs.statSync(videoPath).size / 1024 / 1024).toFixed(2)} MB)`, c.green);
        return videoPath;
      }
      fs.unlinkSync(videoPath);
    } catch (e: any) { log(`  ⚠  ${e.message}`, c.yellow); }
  }

  try {
    const { execSync } = require('child_process');
    execSync(`ffmpeg -f lavfi -i testsrc=duration=10:size=320x240:rate=25 -f lavfi -i sine=frequency=440:duration=10 -c:v libx264 -c:a aac -shortest "${videoPath}" -y`, { stdio: 'pipe' });
    log(`  ✓ Generated with ffmpeg`, c.green);
    return videoPath;
  } catch { /* ffmpeg not available */ }

  throw new Error(`Place a short MP4 at: ${videoPath}`);
}

// ─── Step 3: Upload reel ──────────────────────────────────────────────────────

async function uploadReel(videoPath: string): Promise<string> {
  log('\n[3/4] Uploading reel to API...', c.cyan);
  log(`  → POST ${API_BASE}/upload/reel`, c.yellow);

  const videoBuffer = fs.readFileSync(videoPath);
  log(`  ℹ  Video size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`, c.yellow);

  // Get fresh token right before upload
  const token = await getFreshToken();

  const FormData = require('form-data');
  const fd = new FormData();
  fd.append('video', videoBuffer, { filename: 'test.mp4', contentType: 'video/mp4' });
  fd.append('caption', 'تيست مكس - Mux integration test');

  const responseText = await new Promise<string>((resolve, reject) => {
    const parsedUrl = new URL(`${API_BASE}/upload/reel`);
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-mobile-app': 'true',
        ...fd.getHeaders(),
      },
    }, (res) => {
      log(`  ℹ  HTTP ${res.statusCode}`, c.yellow);
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
        return reject(new Error(`Server redirected (${res.statusCode}) to: ${res.headers.location}`));
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    fd.pipe(req);
  });

  let data: any;
  try { data = JSON.parse(responseText); }
  catch { throw new Error(`Non-JSON: ${responseText.substring(0, 300)}`); }

  if (data.status !== 'SUCCESS') {
    throw new Error(`Upload failed: ${data.message || JSON.stringify(data).substring(0, 200)}`);
  }

  const { reelId, muxUploadId, status } = data.data;
  log(`  ✓ Reel ID:       ${reelId}`, c.green);
  log(`  ✓ Mux Upload ID: ${muxUploadId ?? 'N/A'}`, c.green);
  log(`  ✓ Status:        ${status}`, c.green);
  return reelId;
}

// ─── Step 4: Poll status ──────────────────────────────────────────────────────

async function pollStatus(reelId: string): Promise<void> {
  log('\n[4/4] Polling status (max 2 min)...', c.cyan);

  for (let i = 1; i <= 40; i++) {
    await sleep(3000);

    // Fresh token for each poll
    const token = await getFreshToken();
    const parsedUrl = new URL(`${API_BASE}/upload/reels/${reelId}/status`);

    let pollData: any;
    try {
      const res = await httpsRequest({
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'x-mobile-app': 'true' },
      });
      pollData = JSON.parse(res.text);
    } catch (err: any) {
      log(`  [${i}/40] Poll error: ${err.message}`, c.red);
      continue;
    }

    const { status, videoUrl, thumbnailUrl, muxPlaybackId } = pollData.data ?? {};
    const elapsed = (i * 3).toFixed(0);

    if (status === 'READY') {
      log(`\n  ✅ READY after ${elapsed}s!`, c.green);
      log(`\n${c.bold}═══════════════════════════════════════${c.reset}`);
      log(`${c.bold}  FINAL RESULT${c.reset}`);
      log(`${c.bold}═══════════════════════════════════════${c.reset}`);
      log(`  Reel ID:        ${reelId}`, c.green);
      log(`  Mux Playback:   ${muxPlaybackId ?? 'N/A'}`, c.green);
      log(`  Video URL:      ${videoUrl ?? 'N/A'}`, c.green);
      log(`  Thumbnail URL:  ${thumbnailUrl ?? 'N/A'}`, c.green);
      log(`${c.bold}═══════════════════════════════════════${c.reset}\n`);
      if (videoUrl?.includes('stream.mux.com')) log('  ✅ HLS URL confirmed!', c.green);
      return;
    }

    if (status === 'FAILED') {
      log(`\n  ❌ FAILED after ${elapsed}s`, c.red);
      process.exit(1);
    }

    const dots = '.'.repeat((i % 3) + 1).padEnd(3);
    process.stdout.write(`\r  [${i}/40] ${elapsed}s — ${status ?? 'PROCESSING'}${dots}   `);
  }

  log(`\n  ⏰ Timeout. Reel ID: ${reelId}`, c.yellow);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`\n${c.bold}╔═══════════════════════════════════════╗${c.reset}`);
  log(`${c.bold}║   Mux Upload Integration Test         ║${c.reset}`);
  log(`${c.bold}╚═══════════════════════════════════════╝${c.reset}`);
  log(`  API: ${API_BASE}`, c.cyan);

  try {
    await verifyAuth();
    const videoPath = await ensureTestVideo();
    const reelId = await uploadReel(videoPath);
    await pollStatus(reelId);
  } catch (err: any) {
    log(`\n❌ ${err.message}`, c.red);
    process.exit(1);
  }
}

main();
