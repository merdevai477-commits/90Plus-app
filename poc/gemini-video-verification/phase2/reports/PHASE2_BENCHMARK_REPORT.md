# Phase 2 — Real-World Highlightly Video Verification Benchmark

Generated: 2026-11-19T23:30:09.197Z

> Isolated under `poc/gemini-video-verification/phase2`. Production playback and Highlightly sync were **not** modified.

## Dataset

- Source: live `MatchHighlight` table (**206** rows in DB)
- Selected: **30** real URLs (no invented links)
- Distribution: {"goal-clip|direct_mp4":8,"match-highlights|direct_mp4":1,"goal-clip|youtube":1,"match-highlights|youtube":16,"goal-clip|other":2,"match-highlights|other":2}
- HLS: **none available** in this linked sample pool

## Headline metrics

| Metric | Value |
|--------|-------|
| Videos tested | 30 |
| HTTP OK (primary/playback) | see distribution below |
| Successfully decoded (FFprobe) | **6** / 9 direct_mp4 |
| Gemini visual analyses | **23** |
| Gemini avg latency | **4126 ms** |
| Tokens (this run) | **48650** |
| Est. paid cost / 1000 analyses | **$0.24** |

### HTTP status distribution

```
{
  "200": 27,
  "404": 3
}
```

Notable: **3 Streamin CDN MP4s returned 404** (URL present in DB ≠ playable file).

### Decode

- Codec: **h264 High** on all 6 successful decodes
- Resolutions: 1536x864, 1536x864, 1536x864, 1536x864, 1536x864, 1280x720

## Gemini accuracy vs manual ground truth

- Comparable analyses: **23**
- Matches: **23**
- Accuracy: **100.0%**

Manual GT method: human inspection of extracted `mid.jpg` (direct MP4) and Highlightly thumbnails (YouTube).  
Classes `unavailable` / `unsupported_direct` were excluded from Gemini accuracy (no fair visual label).

### Black screen

- Real-world positives in this set: **0**
- False positives (Gemini black on non-black GT): **0**
- Phase 1 synthetic black detection remains the controlled accuracy reference.

### Frozen frames

- Real-world positives in this set: **0**
- False positives: **0**
- Phase 1 synthetic frozen detection remains the controlled accuracy reference.

## Device playback (iOS / Android)

**Not executed in this automated session.** Plan: `phase2/device-tests/PLAYBACK_TEST_PLAN.md`. Rates below are intentionally null.

| Platform | Success rate |
|----------|--------------|
| iOS AVPlayer | not measured |
| Android ExoPlayer | not measured |

Do **not** treat FFmpeg H.264 success as native playback proof.

## Local vs Gemini responsibilities

**Local (FFmpeg / OpenCV / HTTP):** HTTP status + redirect chain; Content-Type inspection; FFprobe codec/duration/resolution; Frame extraction; OpenCV black/frozen heuristics; URL expiry / 404 detection

**Gemini:** Semantic football-content confirmation; Error-message / geo overlay recognition in frames; Loading UI recognition; Ambiguous corruption / meaningfulness judgment

**Never Gemini-alone:** YouTube embeddability / geo playback; Native iOS AVPlayer / Android ExoPlayer success; Declaring a URL playable solely because frames look valid

## Integration decision

**CONDITIONAL** — Ready to integrate as a SERVER-SIDE enrichment behind a feature flag for direct MP4 clips AFTER local HTTP/ffprobe/OpenCV gates. Not ready as a standalone playback authority, and not ready to certify YouTube/iOS/Android success without device/embed tests.

### Blockers
- iOS/Android playback rates not measured in this run
- YouTube analyzed via thumbnails only (not embed playback)
- 3/9 Streamin MP4 URLs already 404 — availability decays; Gemini cannot fix expired URLs
- streama.in / X.com hosts are not direct files — need different authorized strategy

### Recommended next step
Wire local gates first in a non-prod worker; run device test plan on the 6 decoded MP4s + sample YouTube embeds; only then call Gemini on ambiguous frames.

## Artifacts

- Dataset: `phase2/dataset/dataset-30.json`
- Raw results: `phase2/reports/phase2-raw-results.json`
- Ground truth: `phase2/ground-truth/ground-truth-30.json`
- This report JSON: `phase2/reports/PHASE2_BENCHMARK_REPORT.json`
