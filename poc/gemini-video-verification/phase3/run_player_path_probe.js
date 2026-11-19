/**
 * Phase 3 network/player-path probe.
 * Mirrors HighlightVideoSheet routing EXACTLY (resolveHighlightPlaybackUrl /
 * youtubeEmbedUrl / isDirectHighlightFile) without modifying production code.
 *
 * This measures what the production player would attempt and whether the
 * network/source layer can satisfy AVPlayer/ExoPlayer/WebView — it is NOT a
 * substitute for on-device first-frame confirmation, but it is deterministic
 * and uses the same URL decisions as HighlightVideoSheet + DirectClipPlayer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STREAMIN_HOSTS = new Set(['streamin.link', 'streamin.me']);

function resolveHighlightPlaybackUrl(pageUrl) {
  const trimmed = (pageUrl || '').trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (STREAMIN_HOSTS.has(host) || host.endsWith('.streamin.link') || host.endsWith('.streamin.me')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
      if (/^[a-z0-9]+$/i.test(id)) return `https://c-cdn.streamin.top/uploads/${id}.mp4`;
    }
  } catch {
    return trimmed;
  }
  return trimmed.split('#')[0];
}

function isDirectHighlightFile(url) {
  return /\.(mp4|m3u8)(?:$|\?)/i.test(url || '');
}

function youtubeVideoId(pageUrl) {
  try {
    const parsed = new URL(pageUrl.trim());
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
      return /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const fromQuery = parsed.searchParams.get('v');
      if (fromQuery && /^[\w-]{6,}$/.test(fromQuery)) return fromQuery;
      const parts = parsed.pathname.split('/').filter(Boolean);
      const marker = parts.findIndex((part) => part === 'embed' || part === 'shorts' || part === 'live');
      const id = marker >= 0 ? parts[marker + 1] ?? '' : '';
      return /^[\w-]{6,}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }
  return null;
}

function youtubeEmbedUrl(pageUrl) {
  const id = youtubeVideoId(pageUrl);
  if (!id) return null;
  const params = new URLSearchParams({
    autoplay: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    controls: '1',
    iv_load_policy: '3',
    enablejsapi: '1',
    origin: 'https://90plus.pro',
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

/** Same branching as HighlightVideoSheet.tsx */
function classifyPlayerPath(url) {
  const fileUrl = resolveHighlightPlaybackUrl(url);
  const embedUrl = url ? youtubeEmbedUrl(url) ?? youtubeEmbedUrl(fileUrl) : null;
  const direct = Boolean(url) && !embedUrl && isDirectHighlightFile(fileUrl);
  if (embedUrl) {
    return {
      playerPath: 'youtube_webview',
      productionComponent: 'HighlightVideoSheet/WebView',
      nativeEngine: { ios: 'WKWebView+YouTubeEmbed', android: 'WebView+YouTubeEmbed' },
      urlUsed: embedUrl,
      originalUrl: url,
      fileUrl,
    };
  }
  if (direct) {
    return {
      playerPath: 'direct_expo_video',
      productionComponent: 'HighlightVideoSheet/DirectClipPlayer',
      nativeEngine: { ios: 'AVPlayer(expo-video)', android: 'ExoPlayer(expo-video)' },
      urlUsed: fileUrl,
      originalUrl: url,
      fileUrl,
    };
  }
  return {
    playerPath: 'unsupported_error_ui',
    productionComponent: 'HighlightVideoSheet/errorText',
    nativeEngine: { ios: 'none', android: 'none' },
    urlUsed: fileUrl || url,
    originalUrl: url,
    fileUrl,
    note: 'Production shows hardcoded geo unavailable message without mounting a player',
  };
}

async function probeDirectMp4(url) {
  const started = Date.now();
  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    Referer: 'https://90plus.pro',
    Range: 'bytes=0-1',
  };
  try {
    const res = await fetch(url, { method: 'GET', headers, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const ctype = res.headers.get('content-type') || '';
    const acceptRanges = res.headers.get('accept-ranges');
    const contentRange = res.headers.get('content-range');
    // AVPlayer/ExoPlayer typically need 200/206 + video/*
    const okForNative =
      (res.status === 200 || res.status === 206) &&
      (/video\//i.test(ctype) || /octet-stream/i.test(ctype) || /\.mp4/i.test(url));
    try {
      await res.body?.cancel?.();
    } catch {
      /* ignore */
    }
    return {
      kind: 'direct_mp4',
      httpStatus: res.status,
      contentType: ctype,
      acceptRanges,
      contentRange,
      finalUrl: res.url,
      okForNativePlayer: okForNative,
      durationMs: Date.now() - started,
      error: null,
    };
  } catch (error) {
    return {
      kind: 'direct_mp4',
      httpStatus: null,
      okForNativePlayer: false,
      durationMs: Date.now() - started,
      error: String(error.message || error).slice(0, 300),
    };
  }
}

async function probeYouTubeEmbed(embedUrl) {
  const started = Date.now();
  try {
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Referer: 'https://90plus.pro',
      },
      signal: AbortSignal.timeout(20000),
    });
    const html = await res.text();
    const lower = html.toLowerCase();
    const geo =
      /not available in your country|not made this video available in your country|غير متاح في بلدك/.test(lower);
    const embedDisabled = /playback on other websites has been disabled|embedding disabled|watch on youtube/.test(
      lower,
    );
    const errorCodes = [];
    if (/\"errorcode\"\s*:\s*150/i.test(html) || /error code 150/i.test(lower)) errorCodes.push(150);
    if (/\"errorcode\"\s*:\s*100/i.test(html) || /error code 100/i.test(lower)) errorCodes.push(100);
    if (/\"errorcode\"\s*:\s*101/i.test(html) || /error code 101/i.test(lower)) errorCodes.push(101);
    const playerPresent = /ytp-|youtube\.com\/embed|player_api|videodata/i.test(html);
    const okLikely = res.status === 200 && !geo && !embedDisabled && errorCodes.length === 0 && playerPresent;
    return {
      kind: 'youtube_embed',
      httpStatus: res.status,
      geoBlockedHint: geo,
      embedDisabledHint: embedDisabled,
      errorCodes,
      playerPresent,
      okForWebViewEmbed: okLikely,
      durationMs: Date.now() - started,
      error: null,
      note: 'HTML probe approximates WebView embed; not identical to WKWebView/Android WebView runtime',
    };
  } catch (error) {
    return {
      kind: 'youtube_embed',
      httpStatus: null,
      okForWebViewEmbed: false,
      durationMs: Date.now() - started,
      error: String(error.message || error).slice(0, 300),
    };
  }
}

function mapProbeToPlaybackResult(pathInfo, probe) {
  if (pathInfo.playerPath === 'unsupported_error_ui') {
    return {
      initSuccess: false,
      playbackStarted: false,
      blackScreen: false,
      finalResult: 'fail_unsupported',
      failureClass: 'unsupported_source_no_player',
      nativeErrorCode: null,
      httpStatus: null,
      notes: ['Production never mounts AVPlayer/ExoPlayer/WebView for this URL'],
    };
  }
  if (pathInfo.playerPath === 'direct_expo_video') {
    if (!probe?.okForNativePlayer) {
      const status = probe?.httpStatus;
      return {
        initSuccess: false,
        playbackStarted: false,
        blackScreen: status === 404 ? false : null,
        finalResult: status === 404 ? 'fail_http_404' : 'fail_network',
        failureClass: status === 404 ? 'expired_or_missing_cdn' : 'direct_fetch_failed',
        nativeErrorCode: null,
        httpStatus: status,
        notes: ['Range/GET probe failed — AVPlayer/ExoPlayer would fail to open source'],
      };
    }
    return {
      initSuccess: true,
      playbackStarted: null,
      blackScreen: null,
      finalResult: 'network_ok_native_unverified',
      failureClass: null,
      nativeErrorCode: null,
      httpStatus: probe.httpStatus,
      notes: [
        'Source is reachable with video content-type/range — native first-frame still requires device confirmation',
      ],
    };
  }
  // youtube
  if (probe?.geoBlockedHint) {
    return {
      initSuccess: true,
      playbackStarted: false,
      blackScreen: true,
      finalResult: 'fail_geo',
      failureClass: 'youtube_geo_restricted',
      nativeErrorCode: null,
      httpStatus: probe.httpStatus,
      notes: ['Embed HTML indicates country restriction'],
    };
  }
  if (probe?.embedDisabledHint || (probe?.errorCodes || []).includes(150)) {
    return {
      initSuccess: true,
      playbackStarted: false,
      blackScreen: true,
      finalResult: 'fail_embed_disabled',
      failureClass: 'youtube_embed_disabled',
      nativeErrorCode: 150,
      httpStatus: probe.httpStatus,
      notes: ['Embed disabled / error 150 — watch page may still work in YouTube app'],
    };
  }
  if (!probe?.okForWebViewEmbed) {
    return {
      initSuccess: Boolean(probe?.httpStatus === 200),
      playbackStarted: false,
      blackScreen: null,
      finalResult: 'fail_embed_uncertain',
      failureClass: 'youtube_embed_probe_failed',
      nativeErrorCode: (probe?.errorCodes || [])[0] || null,
      httpStatus: probe?.httpStatus ?? null,
      notes: ['Could not confirm embed player in HTML probe'],
    };
  }
  return {
    initSuccess: true,
    playbackStarted: null,
    blackScreen: null,
    finalResult: 'embed_html_ok_webview_unverified',
    failureClass: null,
    nativeErrorCode: null,
    httpStatus: probe.httpStatus,
    notes: ['Embed HTML looks healthy — WKWebView/Android WebView still needs device confirmation'],
  };
}

async function main() {
  const dataset = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'dataset/phase3-dataset-30.json'), 'utf8'),
  );
  const results = [];
  for (const video of dataset.videos) {
    const pathInfo = classifyPlayerPath(video.url);
    let probe = null;
    if (pathInfo.playerPath === 'direct_expo_video') {
      probe = await probeDirectMp4(pathInfo.urlUsed);
    } else if (pathInfo.playerPath === 'youtube_webview') {
      probe = await probeYouTubeEmbed(pathInfo.urlUsed);
    } else {
      probe = { kind: 'none', ok: false };
    }
    const playback = mapProbeToPlaybackResult(pathInfo, probe);
    results.push({
      datasetId: video.datasetId,
      highlightlyId: video.highlightlyId,
      fixtureId: video.fixtureId,
      sourceClass: video.sourceClass,
      category: video.category,
      url: video.url,
      pathInfo,
      probe,
      playback,
      gemini: {
        status: video.phase2.geminiStatus,
        football: video.phase2.geminiFootball,
        ok: video.phase2.geminiOk,
      },
      phase2DecodingOk: video.phase2.decodingOk,
    });
    console.log(
      `${video.datasetId} path=${pathInfo.playerPath} result=${playback.finalResult} http=${playback.httpStatus}`,
    );
  }

  const outDir = path.join(__dirname, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'player-path-probe.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify({ createdAt: new Date().toISOString(), count: results.length, results }, null, 2),
  );
  console.log(JSON.stringify({ outPath, count: results.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
