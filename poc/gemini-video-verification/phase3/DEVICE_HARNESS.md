# Phase 3 Device Harness (no production player changes)

## Goal

Measure AVPlayer / ExoPlayer / WebView outcomes for the exact Phase 2 30-video set using the **same routing** as `HighlightVideoSheet` + `DirectClipPlayer`.

## Constraint

- Do **not** edit `HighlightVideoSheet.tsx` or Highlightly sync.
- Do **not** deploy unless explicitly approved.
- Prefer physical devices; Expo cloud simulator is acceptable when no local device is attached.

## How production routes URLs

From `HighlightVideoSheet.tsx`:

1. `fileUrl = resolveHighlightPlaybackUrl(url)`
2. `embedUrl = youtubeEmbedUrl(url)`
3. If `embedUrl` → **WebView** (YouTube nocookie embed)
4. Else if `isDirectHighlightFile(fileUrl)` → **DirectClipPlayer** (`expo-video` → AVPlayer / ExoPlayer)
5. Else → hardcoded error UI (“الفيديو مش متاح في البلد دي”) **without mounting a player**

## Automated probes already in this folder

```bash
node phase3/prepare_dataset.js
node phase3/run_player_path_probe.js
node phase3/build_report.js
```

These reuse the exact routing helpers and probe:

- MP4: HTTP Range `bytes=0-1` (what native players need)
- YouTube: embed HTML geo/embed-disabled signals
- Other: classified as unsupported (no player)

## On-device confirmation checklist

For each `datasetId` in `dataset/phase3-dataset-30.json`:

1. Open match `fixtureId` → Events tab
2. Tap the clip / summary that maps to that URL
3. Record into `reports/device-results-<platform>.json`:

```json
{
  "datasetId": "hl-4",
  "platform": "ios",
  "initSuccess": true,
  "timeToFirstFrameMs": 1200,
  "playbackStarted": true,
  "playbackDurationSec": 8,
  "blackScreen": false,
  "interrupted": false,
  "httpStatus": 206,
  "nativeErrorCode": null,
  "finalResult": "success"
}
```

Deep link (if supported by the installed build):

`ninetyplus:///(tabs)/match-details?fixtureId=<id>`
