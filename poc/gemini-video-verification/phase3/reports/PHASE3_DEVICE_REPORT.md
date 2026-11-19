# Phase 3 — Cross-Platform Playback Compatibility Report

Generated: 2026-11-19T23:37:40.674Z

> Production playback and Highlightly sync were **not** modified.

## Method

- Inspected `HighlightVideoSheet` / `DirectClipPlayer` routing (unchanged).
- Replayed the **exact Phase 2 30-video set**.
- Applied the **same URL decision tree** as production, then probed:
  - Direct MP4: HTTP Range `bytes=0-1` (AVPlayer/ExoPlayer source open)
  - YouTube: nocookie embed HTML (WebView path)
  - Other: confirmed production mounts **no player**
- Expo cloud simulator sessions used for native confirmation when available (see device result files).

## Headline rates (player-path / network layer)

| Cohort | Result |
|--------|--------|
| Direct MP4 network OK | **6/9** (67%) |
| Direct MP4 HTTP 404 | **3/9** |
| YouTube embed HTML OK | **17/17** |
| Other sources mount player | **0/4** |
| iOS native first-frame rate | not completed (0 samples) |
| Android native first-frame rate | not completed (0 samples) |

## Failure classification

```
{
  "expired_or_missing_cdn": 3,
  "network_ok_native_unverified": 6,
  "embed_html_ok_webview_unverified": 17,
  "unsupported_source_no_player": 4
}
```

## Root causes

- **CDN_404**: 3/9 direct MP4 URLs return HTTP 404 on Range GET (localDetectable=true)
- **UNSUPPORTED_HOST**: 4 URLs (streama.in / x.com) never mount a player; production shows geo error UI (localDetectable=true)
- **YOUTUBE_WEBVIEW_NOT_AVPLAYER**: YouTube uses WKWebView/Android WebView embed, not AVPlayer/ExoPlayer file playback (localDetectable=true)
- **GEMINI_VALID_NOT_PLAYABLE**: 0 Gemini-valid cases still fail at player/network layer in this set (typically none if Gemini only ran on reachable media; check correlation table) (localDetectable=true)

## Gemini vs actual playback path

- Gemini-valid analyses in set: **23**
- Gemini-valid but player/network fails: **0** 
- Failures detectable **without AI**: **7/30**

**Conclusion:** Gemini remains useful for *visual semantics after frames exist*. It does **not** replace HTTP liveness, unsupported-host detection, or YouTube embed policy checks.

## iOS vs Android

- Routing is shared; MP4 network failures affect both.
- iOS-specific risks in current production player: Android UA spoof in WebView, fullscreen disabled, opacity hack (historical black-screen mitigation).
- Android ExoPlayer is expected to play the 6 HTTP-206 MP4s when the app mounts `DirectClipPlayer` — confirm with device results file.

## Recommended production architecture

- 1. Classify source (youtube | direct_mp4 | unsupported) using existing helpers
- 2. Local HTTP/Range (MP4) or embeddable/geo probe (YouTube) — reject before UI play
- 3. Mount only the matching production player path
- 4. Optional Gemini on extracted frames AFTER decode for black/error overlays
- 5. Device error telemetry (status/error codes) back to diagnostics

## Prioritized remediation

- **P0**: Preflight HTTP Range for direct MP4; hide play CTA on 404/410 — Eliminates black/error opens for expired Streamin links
- **P0**: Fix unsupported-source UX (streama/x.com) — distinct message, no fake geo — Stops misdiagnosis of availability
- **P1**: YouTube: surface embed-disabled/geo distinctly; offer authorized Open in YouTube — Matches user expectation when watch page works
- **P1**: Complete on-device matrix for 6 network-OK MP4 + sample YouTube embeds on iOS+Android — Converts network_ok_native_unverified into true success rates
- **P2**: Optional Gemini only for ambiguous decoded frames — Cost control; AI where it adds unique value

## Artifacts

- Dataset: `phase3/dataset/phase3-dataset-30.json`
- Probe: `phase3/reports/player-path-probe.json`
- This JSON: `phase3/reports/PHASE3_DEVICE_REPORT.json`
- Device harness notes: `phase3/DEVICE_HARNESS.md`
