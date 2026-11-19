# Gemini Video Verification POC (isolated)

Proof-of-concept for using Google Gemini to visually classify football highlight frames (black screen, frozen, error UI, loading, football content).

**This does not modify 90Plus production playback.** Keys stay server-side only.

## Setup

```bash
cd poc/gemini-video-verification
npm install
```

Ensure `GEMINI_API_KEY` is set in the repo-root `.env` or copy `.env.example` → `.env` here.

Requires:

- Node.js 20+
- Python 3 + OpenCV (`pip install opencv-python numpy`)
- FFmpeg recommended (OpenCV fallback works if missing)

## Commands

```bash
npm run samples      # synthetic MP4 + stills
npm run extract      # FFmpeg/OpenCV frame extraction + local black/frozen hints
npm run discover     # list models, pick cost-efficient vision candidate
npm run connect      # auth + text + tiny image ping
npm run analyze      # GeminiVideoAnalyzer on extracted frames
npm run benchmark    # 5 text + 5 image + 10 video-frame analyses
npm run report       # TECHNICAL_REPORT.md
npm run poc          # full pipeline
```

## Deliverables

| Item | Path |
|------|------|
| Isolated module | `src/` |
| Frame extraction | `scripts/extract_frames.py` |
| Analyzer | `src/GeminiVideoAnalyzer.js` |
| Usage tracker | `src/usageTracker.js` |
| Env example | `.env.example` |
| Report | `output/reports/TECHNICAL_REPORT.md` |

## Phase 2 — Real-World Highlightly benchmark

```bash
npm run phase2:dataset   # 30 real MatchHighlight URLs from DB
npm run phase2:run       # HTTP + FFmpeg/ffprobe + OpenCV + Gemini
npm run phase2:report    # ground truth + PHASE2_BENCHMARK_REPORT.md
```

Report: `phase2/PHASE2_BENCHMARK_REPORT.md`  
Device plan: `phase2/device-tests/PLAYBACK_TEST_PLAN.md`

## Phase 3 — Cross-platform playback compatibility

```bash
npm run phase3:prepare
npm run phase3:probe    # mirrors HighlightVideoSheet routing + network probes
npm run phase3:report
```

Report: `phase3/PHASE3_DEVICE_REPORT.md`  
Harness notes: `phase3/DEVICE_HARNESS.md`

## Safety

- Never hardcode API keys
- Never import this into React Native
- Never log the raw API key (fingerprint only)
- Do not claim remaining quota unless AI Studio / billing exposes it
- Do not modify production playback or Highlightly sync from this POC
