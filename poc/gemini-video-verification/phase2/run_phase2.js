import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  PHASE2_ROOT,
  POC_ROOT,
  ensurePhase2Dirs,
  httpInspect,
  downloadFile,
  ffprobeMedia,
  extractFramesFfmpeg,
  findBinary,
} from './tools.js';
import { loadEnv } from '../src/loadEnv.js';
import { GeminiVideoAnalyzer } from '../src/GeminiVideoAnalyzer.js';
import { UsageTracker } from '../src/usageTracker.js';
import { discoverModels } from '../src/discoverModels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runOpenCvMetrics(framesDir) {
  const script = path.join(PHASE2_ROOT, 'opencv_frame_metrics.py');
  const res = spawnSync('python', [script, framesDir], { encoding: 'utf8' });
  if (res.status !== 0) {
    return { ok: false, error: (res.stderr || res.stdout || 'opencv_failed').slice(0, 400) };
  }
  try {
    return JSON.parse(res.stdout);
  } catch {
    return { ok: false, error: 'opencv_json_parse' };
  }
}

function isDirectDecodable(video) {
  return video.sourceClass === 'direct_mp4' || video.sourceClass === 'hls' || /\.mp4(\?|$)/i.test(video.playbackUrl);
}

function isYouTube(video) {
  return video.sourceClass === 'youtube';
}

async function processVideo(video, { analyzer, paceMs }) {
  const started = Date.now();
  const result = {
    datasetId: video.datasetId,
    highlightlyId: video.highlightlyId,
    fixtureId: video.fixtureId,
    category: video.category,
    sourceClass: video.sourceClass,
    title: video.title,
    url: video.url,
    playbackUrl: video.playbackUrl,
    http: null,
    download: null,
    probe: null,
    frames: null,
    opencv: null,
    gemini: null,
    decodingOk: false,
    errors: [],
  };

  // 1) HTTP inspect primary URL + playback URL
  const primary = await httpInspect(video.url || video.playbackUrl);
  result.http = { primary };
  if (video.playbackUrl && video.playbackUrl !== video.url) {
    result.http.playback = await httpInspect(video.playbackUrl);
  }

  const candidateUrl =
    result.http.playback?.ok ? result.http.playback.finalUrl : primary.ok ? primary.finalUrl : video.playbackUrl || video.url;

  // 2) YouTube path — no unauthorized download; use thumbnail if present
  if (isYouTube(video)) {
    result.probe = { skipped: true, reason: 'youtube_no_direct_download' };
    const thumbUrl = video.thumbnail;
    if (thumbUrl) {
      const thumbHttp = await httpInspect(thumbUrl);
      result.http.thumbnail = thumbHttp;
      if (thumbHttp.ok) {
        const thumbPath = path.join(PHASE2_ROOT, 'frames', video.datasetId, 'thumbnail.jpg');
        fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
        try {
          await downloadFile(thumbUrl, thumbPath, { maxBytes: 5 * 1024 * 1024 });
          result.frames = { ok: true, tool: 'thumbnail', frames: [{ label: 'thumbnail', path: thumbPath }] };
          result.opencv = runOpenCvMetrics(path.dirname(thumbPath));
          await sleep(paceMs);
          result.gemini = await analyzer.analyzeFrames([thumbPath], {
            label: `phase2-${video.datasetId}-yt-thumb`,
            opencvHints: result.opencv,
          });
        } catch (error) {
          result.errors.push(`thumb_download:${String(error.message || error)}`);
        }
      }
    }
    result.durationMs = Date.now() - started;
    return result;
  }

  // 3) Direct / other — attempt download if content looks like media or known CDN
  const inspect = result.http.playback || result.http.primary;
  const ctype = (inspect?.contentType || '').toLowerCase();
  const looksVideo =
    isDirectDecodable(video) ||
    ctype.includes('video') ||
    ctype.includes('mpegurl') ||
    ctype.includes('octet-stream');

  if (!inspect?.ok) {
    result.errors.push(`http_${inspect?.status || 'fail'}`);
    result.durationMs = Date.now() - started;
    return result;
  }

  if (!looksVideo && video.sourceClass === 'other') {
    result.errors.push('non_video_content_type_or_unknown_host');
    result.probe = { skipped: true, reason: 'not_direct_media', contentType: ctype };
    result.durationMs = Date.now() - started;
    return result;
  }

  const downloadPath = path.join(
    PHASE2_ROOT,
    'downloads',
    `${video.datasetId}${video.sourceClass === 'hls' ? '.m3u8' : '.mp4'}`,
  );
  try {
    if (video.sourceClass === 'hls') {
      result.download = { skipped: true, reason: 'hls_playlist_not_fully_downloaded' };
      // Probe playlist text only
      const playlistRes = await fetch(candidateUrl, { signal: AbortSignal.timeout(15000) });
      const text = await playlistRes.text();
      fs.writeFileSync(downloadPath, text.slice(0, 200_000));
      result.download = { path: downloadPath, bytes: Buffer.byteLength(text), playlist: true };
      result.probe = {
        available: true,
        ok: playlistRes.ok && text.includes('#EXTM3U'),
        formatName: 'hls',
        codec: null,
        note: 'Playlist fetched; segment decode not expanded in Phase2 POC',
      };
      result.decodingOk = false;
      result.durationMs = Date.now() - started;
      return result;
    }

    result.download = await downloadFile(candidateUrl, downloadPath);
    result.probe = ffprobeMedia(downloadPath);
    result.decodingOk = Boolean(result.probe?.ok && result.probe?.codec);

    const framesDir = path.join(PHASE2_ROOT, 'frames', video.datasetId);
    result.frames = extractFramesFfmpeg(downloadPath, framesDir, ['first', 'mid', 'last']);
    if (!result.frames.ok) {
      // OpenCV fallback extract via python one-liner path: copy using ffprobe-less read
      result.errors.push('ffmpeg_frame_extract_failed');
    } else {
      result.opencv = runOpenCvMetrics(framesDir);
      const framePaths = result.frames.frames.map((f) => f.path);
      await sleep(paceMs);
      result.gemini = await analyzer.analyzeFrames(framePaths, {
        label: `phase2-${video.datasetId}`,
        opencvHints: result.opencv,
      });
    }
  } catch (error) {
    result.errors.push(String(error.message || error).slice(0, 300));
  }

  result.durationMs = Date.now() - started;
  return result;
}

async function main() {
  loadEnv();
  ensurePhase2Dirs();
  process.env.GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-3.5-flash-lite';

  const datasetPath = path.join(PHASE2_ROOT, 'dataset', 'dataset-30.json');
  if (!fs.existsSync(datasetPath)) {
    throw new Error('Missing dataset-30.json — run scripts/fetch_highlight_dataset.js first');
  }
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  console.log(
    JSON.stringify(
      {
        ffmpeg: findBinary('ffmpeg'),
        ffprobe: findBinary('ffprobe'),
        videos: dataset.selectedCount,
        model: process.env.GEMINI_VISION_MODEL,
      },
      null,
      2,
    ),
  );

  await discoverModels({ skipProbe: true });
  const tracker = new UsageTracker(`phase2-${Date.now()}`);
  const analyzer = new GeminiVideoAnalyzer({
    model: process.env.GEMINI_VISION_MODEL,
    tracker,
  });
  const paceMs = Number(process.env.GEMINI_POC_PACE_MS || 5000);

  const results = [];
  for (const video of dataset.videos) {
    console.log(`Processing ${video.datasetId} (${video.sourceClass}, ${video.category})...`);
    const row = await processVideo(video, { analyzer, paceMs });
    results.push(row);
    fs.writeFileSync(
      path.join(PHASE2_ROOT, 'reports', `partial-${video.datasetId}.json`),
      JSON.stringify(row, null, 2),
    );
  }

  const outPath = path.join(PHASE2_ROOT, 'reports', 'phase2-raw-results.json');
  const payload = {
    createdAt: new Date().toISOString(),
    model: process.env.GEMINI_VISION_MODEL,
    ffmpeg: findBinary('ffmpeg'),
    ffprobe: findBinary('ffprobe'),
    dataset: {
      selectedCount: dataset.selectedCount,
      distribution: dataset.distribution,
      totalInDb: dataset.totalInDb,
    },
    usageSummary: tracker.summary(),
    results,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  tracker.writeSummary('phase2');
  console.log(JSON.stringify({ outPath, count: results.length, usage: tracker.summary() }, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith('run_phase2.js');
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
