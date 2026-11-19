# Phase 2 — Device Playback Test Plan (iOS AVPlayer / Android ExoPlayer)

## Scope

This plan validates **native playback compatibility** for Highlightly-sourced clips.

Successful FFmpeg decode does **not** imply AVPlayer/ExoPlayer success.

Do **not** change production playback code for this test. Use a scratch screen or a one-off Expo Dev Client build if needed.

## Prerequisites

- Dataset: `phase2/dataset/dataset-30.json`
- Technical results: `phase2/reports/phase2-raw-results.json`
- Devices:
  - Physical iPhone (preferred) or iOS Simulator with AVPlayer/`expo-video`
  - Physical Android (preferred) or Emulator with ExoPlayer/`expo-video`
- Network: same region you care about for geo (document country/IP region)

## Test matrix

For each of the 30 clips, record one row in `device-results.csv` / `device-results.json`:

| Field | Meaning |
|-------|---------|
| datasetId | e.g. hl-1 |
| platform | ios / android |
| player | expo-video (AVPlayer/ExoPlayer) |
| sourceClass | youtube / direct_mp4 / hls / other |
| urlUsed | exact URL passed to player |
| initMs | time to first frame or readyToPlay |
| readyToPlay | yes/no |
| firstFrameVisible | yes/no |
| audioHeard | yes/no/na |
| blackScreen | yes/no |
| errorCode | player/native error if any |
| geoOrEmbedMessage | visible text if any |
| result | success / fail_black / fail_error / fail_timeout / fail_unsupported |

## Procedure

### A. Direct MP4 / HLS

1. Open isolated test harness (do not ship).
2. Pass `playbackUrl` into `useVideoPlayer` / `VideoView` (same stack as production highlights direct path).
3. Wait up to 15s for `readyToPlay`.
4. Capture screenshot at t=2s.
5. Mark black screen if no visible non-black frame by t=5s while status is ready/playing.

### B. YouTube

1. Use WebView embed path identical to `HighlightVideoSheet` (nocookie embed + Referer `https://90plus.pro`).
2. Separately open the watch URL in Safari/Chrome as control.
3. Record whether embed works while watch page works (embed-disabled / geo cases).

### C. Controls

- Airplane mode → expect fail (sanity).
- Invalid URL → expect fail (sanity).
- Known-good sample MP4 from Phase 1 POC → expect success.

## Acceptance signals (for integration decision)

- Direct MP4 iOS success ≥ 80% of HTTP-OK+codec-OK samples
- Direct MP4 Android success ≥ 85% of same set
- YouTube embed success measured separately; do not blend into MP4 rate
- Any systematic iOS-only black screen with HTTP 200 + H.264 must be escalated

## Status of automated capture in this Phase 2 run

Physical device automation may be unavailable in CI. Fill `device-results.json` manually from TestFlight/dev client runs and attach screenshots under `phase2/device-tests/screenshots/`.
