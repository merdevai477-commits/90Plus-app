import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function rate(ok, total) {
  if (!total) return null;
  return { ok, total, rate: ok / total };
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  const probe = loadJson(path.join(__dirname, 'reports/player-path-probe.json'));
  const dataset = loadJson(path.join(__dirname, 'dataset/phase3-dataset-30.json'));
  const deviceIosPath = path.join(__dirname, 'reports/device-results-ios.json');
  const deviceAndroidPath = path.join(__dirname, 'reports/device-results-android.json');
  const deviceIos = fs.existsSync(deviceIosPath) ? loadJson(deviceIosPath) : null;
  const deviceAndroid = fs.existsSync(deviceAndroidPath) ? loadJson(deviceAndroidPath) : null;

  const rows = probe.results;

  const byPath = {
    direct_expo_video: rows.filter((r) => r.pathInfo.playerPath === 'direct_expo_video'),
    youtube_webview: rows.filter((r) => r.pathInfo.playerPath === 'youtube_webview'),
    unsupported_error_ui: rows.filter((r) => r.pathInfo.playerPath === 'unsupported_error_ui'),
  };

  const mp4NetworkOk = byPath.direct_expo_video.filter((r) => r.playback.finalResult === 'network_ok_native_unverified');
  const mp4Fail404 = byPath.direct_expo_video.filter((r) => r.playback.finalResult === 'fail_http_404');
  const ytEmbedOk = byPath.youtube_webview.filter((r) => r.playback.finalResult === 'embed_html_ok_webview_unverified');
  const ytFail = byPath.youtube_webview.filter((r) => r.playback.finalResult.startsWith('fail_'));

  // Gemini correlation
  const geminiValid = rows.filter((r) => r.gemini?.status === 'valid');
  const validButWouldFailPlayer = geminiValid.filter((r) =>
    ['fail_http_404', 'fail_network', 'fail_unsupported', 'fail_geo', 'fail_embed_disabled', 'fail_embed_uncertain'].includes(
      r.playback.finalResult,
    ),
  );
  // In this set Gemini was only run when frames/thumbs existed — correlate carefully
  const geminiNotRunButPlayablePath = rows.filter(
    (r) => !r.gemini?.ok && ['network_ok_native_unverified', 'embed_html_ok_webview_unverified'].includes(r.playback.finalResult),
  );
  const failuresDetectableWithoutAi = rows.filter((r) =>
    ['fail_http_404', 'fail_unsupported', 'fail_network'].includes(r.playback.finalResult),
  );

  const failureClasses = {};
  for (const r of rows) {
    const cls = r.playback.failureClass || r.playback.finalResult;
    failureClasses[cls] = (failureClasses[cls] || 0) + 1;
  }

  const deviceSummary = {
    ios: deviceIos
      ? {
          status: deviceIos.status || 'partial',
          successRate: deviceIos.successRate ?? null,
          samples: (deviceIos.results || []).length,
        }
      : { status: 'not_completed', successRate: null, samples: 0 },
    android: deviceAndroid
      ? {
          status: deviceAndroid.status || 'partial',
          successRate: deviceAndroid.successRate ?? null,
          samples: (deviceAndroid.results || []).length,
        }
      : { status: 'not_completed', successRate: null, samples: 0 },
  };

  const report = {
    title: 'Phase 3 — Cross-Platform Playback Compatibility',
    createdAt: new Date().toISOString(),
    method: {
      productionPlayersInspected: [
        'front/components/match-details/HighlightVideoSheet.tsx',
        'DirectClipPlayer (expo-video → AVPlayer/ExoPlayer)',
        'WebView YouTube embed path',
      ],
      productionCodeModified: false,
      highlightlySyncModified: false,
      probe: 'Exact HighlightVideoSheet URL routing + HTTP Range / YouTube embed HTML probes',
      deviceSessions: 'Expo cloud simulator attempts recorded separately when available',
    },
    totals: {
      videosTested: rows.length,
      directMp4: byPath.direct_expo_video.length,
      youtube: byPath.youtube_webview.length,
      otherUnsupported: byPath.unsupported_error_ui.length,
    },
    rates: {
      mp4NetworkSuccess: rate(mp4NetworkOk.length, byPath.direct_expo_video.length),
      mp4Http404: rate(mp4Fail404.length, byPath.direct_expo_video.length),
      youtubeEmbedHtmlOk: rate(ytEmbedOk.length, byPath.youtube_webview.length),
      youtubeEmbedFail: rate(ytFail.length, byPath.youtube_webview.length),
      otherSourcePlayerMounted: rate(0, byPath.unsupported_error_ui.length),
      iosNativeFirstFrame: deviceSummary.ios,
      androidNativeFirstFrame: deviceSummary.android,
    },
    failureClassification: failureClasses,
    rootCauses: [
      {
        id: 'CDN_404',
        evidence: `${mp4Fail404.length}/9 direct MP4 URLs return HTTP 404 on Range GET`,
        platforms: ['ios', 'android'],
        geminiPredicts: false,
        localDetectable: true,
      },
      {
        id: 'UNSUPPORTED_HOST',
        evidence: `${byPath.unsupported_error_ui.length} URLs (streama.in / x.com) never mount a player; production shows geo error UI`,
        platforms: ['ios', 'android'],
        geminiPredicts: false,
        localDetectable: true,
      },
      {
        id: 'YOUTUBE_WEBVIEW_NOT_AVPLAYER',
        evidence: 'YouTube uses WKWebView/Android WebView embed, not AVPlayer/ExoPlayer file playback',
        platforms: ['ios', 'android'],
        geminiPredicts: false,
        localDetectable: true,
      },
      {
        id: 'GEMINI_VALID_NOT_PLAYABLE',
        evidence: `${validButWouldFailPlayer.length} Gemini-valid cases still fail at player/network layer in this set (typically none if Gemini only ran on reachable media; check correlation table)`,
        platforms: ['ios', 'android'],
        geminiPredicts: 'partial',
        localDetectable: true,
      },
    ],
    geminiCorrelation: {
      geminiValidCount: geminiValid.length,
      validButPlayerPathFails: validButWouldFailPlayer.map((r) => ({
        datasetId: r.datasetId,
        finalResult: r.playback.finalResult,
        path: r.pathInfo.playerPath,
      })),
      geminiNotRunButNetworkOk: geminiNotRunButPlayablePath.map((r) => r.datasetId),
      failuresDetectableWithoutAi: failuresDetectableWithoutAi.length,
      predictiveValue:
        'Gemini adds semantic confirmation for frames/thumbnails that already downloaded. It does not predict CDN 404, unsupported hosts, or YouTube embed/geo failures. Those are local/network checks.',
    },
    platformComparison: {
      note: 'Player routing is identical across platforms; differences arise in WebView embed behavior and AVPlayer vs ExoPlayer edge cases. Network probe results are platform-agnostic. Native first-frame rates require device sessions.',
      ios: deviceSummary.ios,
      android: deviceSummary.android,
      sharedFailures: ['CDN_404', 'UNSUPPORTED_HOST'],
      likelyIosSpecificRisks: [
        'WKWebView YouTube embed + spoofed Android UA in HighlightVideoSheet',
        'allowsFullscreenVideo disabled on iOS',
        'opacity 0.99 WebView hack suggests prior black-screen issues',
      ],
      likelyAndroidSpecificRisks: ['ExoPlayer progressive MP4 generally robust when HTTP 206 works'],
    },
    recommendedArchitecture: {
      gatesInOrder: [
        '1. Classify source (youtube | direct_mp4 | unsupported) using existing helpers',
        '2. Local HTTP/Range (MP4) or embeddable/geo probe (YouTube) — reject before UI play',
        '3. Mount only the matching production player path',
        '4. Optional Gemini on extracted frames AFTER decode for black/error overlays',
        '5. Device error telemetry (status/error codes) back to diagnostics',
      ],
      doNot: [
        'Do not treat Gemini valid as playable',
        'Do not show geo message for unsupported hosts',
        'Do not skip HTTP liveness for Streamin CDN URLs',
      ],
    },
    remediationPlan: [
      {
        priority: 'P0',
        item: 'Preflight HTTP Range for direct MP4; hide play CTA on 404/410',
        impact: 'Eliminates black/error opens for expired Streamin links',
      },
      {
        priority: 'P0',
        item: 'Fix unsupported-source UX (streama/x.com) — distinct message, no fake geo',
        impact: 'Stops misdiagnosis of availability',
      },
      {
        priority: 'P1',
        item: 'YouTube: surface embed-disabled/geo distinctly; offer authorized Open in YouTube',
        impact: 'Matches user expectation when watch page works',
      },
      {
        priority: 'P1',
        item: 'Complete on-device matrix for 6 network-OK MP4 + sample YouTube embeds on iOS+Android',
        impact: 'Converts network_ok_native_unverified into true success rates',
      },
      {
        priority: 'P2',
        item: 'Optional Gemini only for ambiguous decoded frames',
        impact: 'Cost control; AI where it adds unique value',
      },
    ],
    rows,
  };

  const reportsDir = path.join(__dirname, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'PHASE3_DEVICE_REPORT.json'), JSON.stringify(report, null, 2));

  const md = `# Phase 3 — Cross-Platform Playback Compatibility Report

Generated: ${report.createdAt}

> Production playback and Highlightly sync were **not** modified.

## Method

- Inspected \`HighlightVideoSheet\` / \`DirectClipPlayer\` routing (unchanged).
- Replayed the **exact Phase 2 30-video set**.
- Applied the **same URL decision tree** as production, then probed:
  - Direct MP4: HTTP Range \`bytes=0-1\` (AVPlayer/ExoPlayer source open)
  - YouTube: nocookie embed HTML (WebView path)
  - Other: confirmed production mounts **no player**
- Expo cloud simulator sessions used for native confirmation when available (see device result files).

## Headline rates (player-path / network layer)

| Cohort | Result |
|--------|--------|
| Direct MP4 network OK | **${mp4NetworkOk.length}/${byPath.direct_expo_video.length}** (${((mp4NetworkOk.length / Math.max(1, byPath.direct_expo_video.length)) * 100).toFixed(0)}%) |
| Direct MP4 HTTP 404 | **${mp4Fail404.length}/${byPath.direct_expo_video.length}** |
| YouTube embed HTML OK | **${ytEmbedOk.length}/${byPath.youtube_webview.length}** |
| Other sources mount player | **0/${byPath.unsupported_error_ui.length}** |
| iOS native first-frame rate | ${deviceSummary.ios.successRate ?? 'not completed'} (${deviceSummary.ios.samples} samples) |
| Android native first-frame rate | ${deviceSummary.android.successRate ?? 'not completed'} (${deviceSummary.android.samples} samples) |

## Failure classification

\`\`\`
${JSON.stringify(failureClasses, null, 2)}
\`\`\`

## Root causes

${report.rootCauses.map((c) => `- **${c.id}**: ${c.evidence} (localDetectable=${c.localDetectable})`).join('\n')}

## Gemini vs actual playback path

- Gemini-valid analyses in set: **${geminiValid.length}**
- Gemini-valid but player/network fails: **${validButWouldFailPlayer.length}** ${validButWouldFailPlayer.length ? '(' + validButWouldFailPlayer.map((r) => r.datasetId).join(', ') + ')' : ''}
- Failures detectable **without AI**: **${failuresDetectableWithoutAi.length}/30**

**Conclusion:** Gemini remains useful for *visual semantics after frames exist*. It does **not** replace HTTP liveness, unsupported-host detection, or YouTube embed policy checks.

## iOS vs Android

- Routing is shared; MP4 network failures affect both.
- iOS-specific risks in current production player: Android UA spoof in WebView, fullscreen disabled, opacity hack (historical black-screen mitigation).
- Android ExoPlayer is expected to play the 6 HTTP-206 MP4s when the app mounts \`DirectClipPlayer\` — confirm with device results file.

## Recommended production architecture

${report.recommendedArchitecture.gatesInOrder.map((g) => `- ${g}`).join('\n')}

## Prioritized remediation

${report.remediationPlan.map((r) => `- **${r.priority}**: ${r.item} — ${r.impact}`).join('\n')}

## Artifacts

- Dataset: \`phase3/dataset/phase3-dataset-30.json\`
- Probe: \`phase3/reports/player-path-probe.json\`
- This JSON: \`phase3/reports/PHASE3_DEVICE_REPORT.json\`
- Device harness notes: \`phase3/DEVICE_HARNESS.md\`
`;

  fs.writeFileSync(path.join(__dirname, 'PHASE3_DEVICE_REPORT.md'), md);
  fs.writeFileSync(path.join(reportsDir, 'PHASE3_DEVICE_REPORT.md'), md);
  console.log(JSON.stringify({
    mp4Ok: `${mp4NetworkOk.length}/9`,
    ytOk: `${ytEmbedOk.length}/17`,
    unsupported: byPath.unsupported_error_ui.length,
    geminiValidButFail: validButWouldFailPlayer.length,
  }, null, 2));
}

main();
