/**
 * Mux Direct Integration Test
 *
 * Tests Mux credentials and upload flow DIRECTLY (bypasses the API server).
 * Useful when the production server hasn't been deployed yet with Mux changes.
 *
 * Flow:
 *   1. Verify MUX_TOKEN_ID + MUX_TOKEN_SECRET work
 *   2. Create a direct upload URL
 *   3. Upload test video directly to Mux
 *   4. Poll asset status until READY (max 3 min)
 *   5. Print playback URL + thumbnail URL
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/test-mux-direct.ts
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ─── Colors ───────────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m',
};
function log(msg: string, color = c.reset) { console.log(`${color}${msg}${c.reset}`); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Validate env ─────────────────────────────────────────────────────────────

const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID;
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET;

if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
  log('❌ MUX_TOKEN_ID and MUX_TOKEN_SECRET must be set in .env', c.red);
  log('   Add them to .env and retry.', c.yellow);
  process.exit(1);
}

// ─── Mux API helper ───────────────────────────────────────────────────────────

const MUX_AUTH = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');

async function muxRequest(method: string, endpoint: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: 'api.mux.com',
      path: endpoint,
      method,
      headers: {
        'Authorization': `Basic ${MUX_AUTH}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Download helper ──────────────────────────────────────────────────────────

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

// ─── Upload to Mux direct upload URL ─────────────────────────────────────────

function uploadToMux(uploadUrl: string, videoBuffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(uploadUrl);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoBuffer.length,
      },
    }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Mux upload failed: HTTP ${res.statusCode} — ${body.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(videoBuffer);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`\n${c.bold}╔═══════════════════════════════════════╗${c.reset}`);
  log(`${c.bold}║   Mux Direct Integration Test         ║${c.reset}`);
  log(`${c.bold}╚═══════════════════════════════════════╝${c.reset}`);

  // ── 1. Verify credentials ──────────────────────────────────────────────────
  log('\n[1/4] Verifying Mux credentials...', c.cyan);
  const credCheck = await muxRequest('GET', '/video/v1/assets?limit=1');
  if (credCheck.status === 401) {
    log('❌ Invalid Mux credentials (401 Unauthorized)', c.red);
    log('   Check MUX_TOKEN_ID and MUX_TOKEN_SECRET in .env', c.yellow);
    process.exit(1);
  }
  if (credCheck.status !== 200) {
    log(`❌ Unexpected response: HTTP ${credCheck.status}`, c.red);
    log(JSON.stringify(credCheck.body, null, 2), c.red);
    process.exit(1);
  }
  log('  ✓ Mux credentials valid', c.green);
  log(`  ✓ Token ID: ${MUX_TOKEN_ID}`, c.green);

  // ── 2. Ensure test video ───────────────────────────────────────────────────
  log('\n[2/4] Checking test video...', c.cyan);
  const videoPath = path.resolve(__dirname, 'test.mp4');

  if (!fs.existsSync(videoPath)) {
    log('  ℹ  Downloading sample video...', c.yellow);
    const sources = [
      'https://www.w3schools.com/html/mov_bbb.mp4',
      'https://filesamples.com/samples/video/mp4/sample_640x360.mp4',
    ];
    let downloaded = false;
    for (const url of sources) {
      try {
        await downloadFile(url, videoPath);
        if (fs.statSync(videoPath).size > 10000) { downloaded = true; break; }
        fs.unlinkSync(videoPath);
      } catch (e: any) {
        log(`  ⚠  ${url}: ${e.message}`, c.yellow);
      }
    }
    if (!downloaded) {
      // Generate with ffmpeg
      try {
        const { execSync } = require('child_process');
        execSync(`ffmpeg -f lavfi -i testsrc=duration=10:size=320x240:rate=25 -f lavfi -i sine=frequency=440:duration=10 -c:v libx264 -c:a aac -shortest "${videoPath}" -y`, { stdio: 'pipe' });
        downloaded = true;
      } catch (e: any) {
        log(`  ⚠  ffmpeg: ${e.message}`, c.yellow);
      }
    }
    if (!downloaded) {
      log(`❌ Could not obtain test video. Place a short MP4 at: ${videoPath}`, c.red);
      process.exit(1);
    }
  }

  const videoBuffer = fs.readFileSync(videoPath);
  log(`  ✓ test.mp4 ready (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`, c.green);

  // ── 3. Create Mux direct upload ────────────────────────────────────────────
  log('\n[3/4] Creating Mux direct upload...', c.cyan);
  const uploadRes = await muxRequest('POST', '/video/v1/uploads', {
    cors_origin: '*',
    new_asset_settings: {
      playback_policy: ['public'],
      video_quality: 'basic',
      passthrough: 'test-script',
    },
  });

  if (uploadRes.status !== 201) {
    log(`❌ Failed to create upload: HTTP ${uploadRes.status}`, c.red);
    log(JSON.stringify(uploadRes.body, null, 2), c.red);
    process.exit(1);
  }

  const uploadId: string = uploadRes.body.data.id;
  const uploadUrl: string = uploadRes.body.data.url;
  log(`  ✓ Upload created: ${uploadId}`, c.green);
  log(`  ✓ Upload URL: ${uploadUrl.substring(0, 60)}...`, c.green);

  // ── 4. Upload video to Mux ─────────────────────────────────────────────────
  log('\n  Uploading video to Mux...', c.yellow);
  await uploadToMux(uploadUrl, videoBuffer);
  log('  ✓ Video uploaded to Mux successfully', c.green);

  // ── 5. Poll asset status ───────────────────────────────────────────────────
  log('\n[4/4] Polling asset status (max 3 min)...', c.cyan);

  const MAX_POLLS = 60; // 60 × 3s = 3 min
  let assetId: string | null = null;

  for (let i = 1; i <= MAX_POLLS; i++) {
    await sleep(3000);

    // First get the upload to find the asset ID
    if (!assetId) {
      const uploadStatus = await muxRequest('GET', `/video/v1/uploads/${uploadId}`);
      assetId = uploadStatus.body?.data?.asset_id ?? null;
      if (!assetId) {
        process.stdout.write(`\r  [${i}/${MAX_POLLS}] ${i * 3}s — waiting for asset creation...   `);
        continue;
      }
      log(`\n  ✓ Asset created: ${assetId}`, c.green);
    }

    const assetStatus = await muxRequest('GET', `/video/v1/assets/${assetId}`);
    const status: string = assetStatus.body?.data?.status ?? 'unknown';
    const elapsed = (i * 3).toFixed(0);

    if (status === 'ready') {
      const playbackIds: any[] = assetStatus.body?.data?.playback_ids ?? [];
      const playbackId = playbackIds.find((p: any) => p.policy === 'public')?.id ?? playbackIds[0]?.id;

      log(`\n  ✅ Asset READY after ${elapsed}s!`, c.green);
      log(`\n${c.bold}═══════════════════════════════════════${c.reset}`);
      log(`${c.bold}  FINAL RESULT${c.reset}`);
      log(`${c.bold}═══════════════════════════════════════${c.reset}`);
      log(`  Upload ID:      ${uploadId}`, c.green);
      log(`  Asset ID:       ${assetId}`, c.green);
      log(`  Playback ID:    ${playbackId}`, c.green);
      log(`  Video URL:      https://stream.mux.com/${playbackId}.m3u8`, c.green);
      log(`  Thumbnail URL:  https://image.mux.com/${playbackId}/thumbnail.jpg?time=1`, c.green);
      log(`  Duration:       ${assetStatus.body?.data?.duration?.toFixed(1)}s`, c.green);
      log(`${c.bold}═══════════════════════════════════════${c.reset}\n`);
      log('  ✅ Mux integration is working correctly!', c.green);
      log('  ✅ HLS URL confirmed: stream.mux.com', c.green);
      return;
    }

    if (status === 'errored') {
      log(`\n  ❌ Asset ERRORED after ${elapsed}s`, c.red);
      log(JSON.stringify(assetStatus.body?.data?.errors, null, 2), c.red);
      process.exit(1);
    }

    process.stdout.write(`\r  [${i}/${MAX_POLLS}] ${elapsed}s — ${status}...   `);
  }

  log(`\n  ⏰ Timeout after 3 minutes. Asset ID: ${assetId}`, c.yellow);
  log('  Check Mux dashboard: https://dashboard.mux.com', c.yellow);
}

main().catch((err) => {
  log(`\n❌ Test failed: ${err.message}`, c.red);
  if (err.stack) log(err.stack, c.red);
  process.exit(1);
});
