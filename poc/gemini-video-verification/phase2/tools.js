import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PHASE2_ROOT = __dirname;
export const POC_ROOT = path.resolve(__dirname, '..');

const WINGET_FFMPEG =
  'C:\\Users\\Eltwaheed\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin';

export function findBinary(name) {
  const fromEnv = process.env[name.toUpperCase()];
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const which = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [name], {
    encoding: 'utf8',
  });
  const first = (which.stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
  if (first && fs.existsSync(first)) return first;
  const local = path.join(WINGET_FFMPEG, `${name}.exe`);
  if (fs.existsSync(local)) return local;
  return null;
}

export function ensurePhase2Dirs() {
  for (const rel of [
    'dataset',
    'downloads',
    'frames',
    'reports',
    'usage',
    'ground-truth',
    'device-tests',
  ]) {
    fs.mkdirSync(path.join(PHASE2_ROOT, rel), { recursive: true });
  }
}

export async function httpInspect(url, { maxRedirects = 5 } = {}) {
  const chain = [];
  let current = url;
  let redirects = 0;
  const started = Date.now();
  while (redirects <= maxRedirects) {
    let res;
    try {
      res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          Accept: '*/*',
          Referer: 'https://90plus.pro',
        },
        signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      return {
        ok: false,
        finalUrl: current,
        status: null,
        contentType: null,
        redirectChain: chain,
        error: String(error.message || error).slice(0, 300),
        durationMs: Date.now() - started,
      };
    }
    chain.push({ url: current, status: res.status, location: res.headers.get('location') });
    if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get('location')) {
      const next = new URL(res.headers.get('location'), current).toString();
      current = next;
      redirects += 1;
      continue;
    }
    const contentType = res.headers.get('content-type');
    // Drain/cancel body for non-download probes
    try {
      await res.body?.cancel?.();
    } catch {
      /* ignore */
    }
    return {
      ok: res.status >= 200 && res.status < 400,
      finalUrl: current,
      status: res.status,
      contentType,
      contentLength: res.headers.get('content-length'),
      redirectChain: chain,
      error: null,
      durationMs: Date.now() - started,
    };
  }
  return {
    ok: false,
    finalUrl: current,
    status: null,
    contentType: null,
    redirectChain: chain,
    error: 'too_many_redirects',
    durationMs: Date.now() - started,
  };
}

export async function downloadFile(url, destPath, { maxBytes = 40 * 1024 * 1024 } = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      Referer: 'https://90plus.pro',
    },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    throw new Error(`download_http_${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) {
    // Keep first maxBytes for probing short samples when files are huge
    fs.writeFileSync(destPath, buf.subarray(0, maxBytes));
    return { path: destPath, bytes: maxBytes, truncated: true, totalBytes: buf.length };
  }
  fs.writeFileSync(destPath, buf);
  return { path: destPath, bytes: buf.length, truncated: false, totalBytes: buf.length };
}

export function ffprobeMedia(filePath) {
  const ffprobe = findBinary('ffprobe');
  if (!ffprobe) return { available: false, error: 'ffprobe_missing' };
  const res = spawnSync(
    ffprobe,
    [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  );
  if (res.status !== 0) {
    return { available: true, ok: false, error: (res.stderr || res.stdout || '').slice(0, 500) };
  }
  try {
    const parsed = JSON.parse(res.stdout);
    const video = (parsed.streams || []).find((s) => s.codec_type === 'video');
    return {
      available: true,
      ok: true,
      durationSec: Number(parsed.format?.duration || video?.duration || 0) || null,
      sizeBytes: Number(parsed.format?.size || 0) || null,
      formatName: parsed.format?.format_name || null,
      codec: video?.codec_name || null,
      profile: video?.profile || null,
      width: video?.width || null,
      height: video?.height || null,
      pixFmt: video?.pix_fmt || null,
      avgFrameRate: video?.avg_frame_rate || null,
      raw: { format: parsed.format, video },
    };
  } catch (error) {
    return { available: true, ok: false, error: String(error.message || error) };
  }
}

export function extractFramesFfmpeg(videoPath, outDir, labels = ['first', 'mid', 'last']) {
  const ffmpeg = findBinary('ffmpeg');
  fs.mkdirSync(outDir, { recursive: true });
  if (!ffmpeg) return { ok: false, tool: null, frames: [], error: 'ffmpeg_missing' };

  const probe = ffprobeMedia(videoPath);
  const duration = probe.durationSec && probe.durationSec > 0 ? probe.durationSec : 5;
  const stamps = {
    first: Math.min(0.5, duration * 0.05),
    mid: duration * 0.5,
    last: Math.max(0, duration - 0.8),
  };
  const frames = [];
  for (const label of labels) {
    const t = stamps[label] ?? duration * 0.5;
    const out = path.join(outDir, `${label}.jpg`);
    const res = spawnSync(
      ffmpeg,
      ['-y', '-ss', String(t), '-i', videoPath, '-frames:v', '1', '-q:v', '3', out],
      { encoding: 'utf8' },
    );
    if (res.status === 0 && fs.existsSync(out)) {
      frames.push({ label, path: out, t });
    }
  }
  return { ok: frames.length > 0, tool: 'ffmpeg', frames, probe, error: frames.length ? null : 'no_frames' };
}
