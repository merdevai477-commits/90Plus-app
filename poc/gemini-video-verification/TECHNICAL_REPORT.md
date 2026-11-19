# Gemini Video Verification POC — Technical Report

Generated: 2026-11-19T23:12:01.987Z

> Isolated POC under `poc/gemini-video-verification`. Production playback components were **not** modified.

## Executive verdict

Gemini **can** provide reliable visual verification for synthetic black / error / loading / frozen / football frames at low paid-tier cost (~**$0.41 / 1000** frame-bundle analyses on `gemini-3.5-flash-lite` rates). Free tier is usable but capped (~**15 RPM** observed). Remaining quota is **not** API-visible. Do not treat visual-valid as playable.

## 1. Gemini API connection status

- API key present: **authenticated**
- Key fingerprint: `AQ.A…p7mQ (len=53)`
- Text ping success: **true** (HTTP 200, 595 ms, reply `PONG`)
- Image ping success: **true**
- Methods exercised: `models.list`, `models.generateContent`
- SDK: `@google/genai` (official)

## 2. Available models

- Listed via `ai.models.list()`: **29**
- Supporting `generateContent`: **27**
- Vision candidates ranked: **11**

Top candidates after ranking:

- `gemini-3.5-flash-lite` (score 145)
- `gemini-3.1-flash-lite` (score 135)
- `gemini-2.5-flash-lite` (score 115) — **listed but rejected for this key** (`404` “no longer available to new users”)
- `gemini-2.5-flash` / `gemini-3.5-flash` / newer Flash variants

## 3. Selected model and justification

- **Selected:** `gemini-3.5-flash-lite`
- Justification: Live `models.list()` + cost-efficient Flash-Lite ranking + **live `generateContent` probe**. Listing alone is insufficient (`gemini-2.5-flash-lite` still appeared in the catalog but failed for this account).

## 4. Image analysis accuracy (synthetic stills)

| Sample | Expected | Gemini `visual_status` | Football |
|--------|----------|------------------------|----------|
| football | valid | `valid` | true |
| black | black_screen | `black_screen` | false |
| error | error_screen | `error_screen` | false |
| loading | loading | `loading` | false |
| football (repeat) | valid | `valid` | true |

**Accuracy on these controlled stills: 5/5.**

## 5. Black-screen / video-frame detection

Analyzer pass on extracted MP4 frames:

| Video | Gemini status | Notes |
|-------|---------------|-------|
| `sample_black` | `black_screen` | OpenCV `likelyFullyBlack=true`, conf 1.0 |
| `sample_error` | `error_screen` | Detected “Video unavailable in your country” |
| `sample_football` | `valid` | Football content true |
| `sample_frozen` | `frozen` | Identical frames |
| `sample_loading` | `loading` | Spinner + Loading text |
| `sample_mixed` | (429 on one re-run) | Content has black edges + pitch mid; paced benchmark later classified related sets correctly |

OpenCV is an independent pre-check (luma / similarity). Gemini adds semantic labels. Neither claims device playability.

Frame extraction used **OpenCV** (FFmpeg was not on PATH during this run; installer was attempted but not completed). Code prefers FFmpeg when present.

## 6. Average response latency

- Final paced benchmark average: **~1355 ms**
- Model discovery list latency: hundreds of ms (plus probe)

## 7. Token consumption

Final paced benchmark (5 text + 5 image + 10 video-frame):

- Total tokens: **44,926** (prompt 43,287 / candidates 1,639)
- Success: **20/20**
- Image token accounting present in `usageMetadata.promptTokensDetails` (`modality: IMAGE`)

Per successful video-frame analysis ≈ **3,749 tokens** average.

## 8. Free-tier quota information

### Observed usage
- Benchmark: 20 requests / 44,926 tokens
- Analyzer run: ~24k tokens (prior pass)

### Documented
- Free tier exists for Flash / Flash-Lite families (input/output free where eligible).
- RPM / TPM / RPD vary by model and usage tier.
- RPD resets midnight Pacific Time.
- Full dials: Google AI Studio Rate Limits (sign-in required).

### Observed from live 429 (not guessed)
- Metric: `generate_content_free_tier_requests`
- **limit: 15 requests per minute** for `gemini-3.5-flash-lite` on this free-tier key

### Remaining capacity
- **Unknown / not exposed by API success payloads**
- AI Studio dashboard could not be read automatically (Google login wall)

## 9. Rate-limit behavior

- Unpaced burst: **3× HTTP 429**
- Paced (`GEMINI_POC_PACE_MS=5000`): **0** rate limits, **20/20** success
- Retries: exponential backoff on 429/5xx (`GEMINI_POC_MAX_RETRIES`)

## 10. Estimated cost per 1000 video analyses

Using documented paid rates for Flash-Lite-class models (~$0.10 / 1M input, ~$0.40 / 1M output):

- ≈ **$0.00041** per video-frame analysis (3-frame bundle)
- ≈ **$0.41 per 1000** analyses

On free tier, monetary cost may be **$0** until quotas are exceeded — then requests fail with 429 rather than silently billing (for this free-tier key).

## 11. Production integration recommendations

1. Server-side only — never ship `GEMINI_API_KEY` to React Native.
2. Extract 3–4 frames (start/mid/end); OpenCV gate first; Gemini only when needed.
3. Always **probe** model IDs; do not trust catalog aliases alone.
4. Persist structured JSON + `usageMetadata` with fixture/highlight IDs.
5. Visual-valid ≠ playable — combine with HTTP probe + player errors.
6. Enforce local RPM/RPD budgets (e.g. ≤12/min on free tier) independent of Google.
7. Prefer frame bundles over full-video upload unless A/B shows clear lift.
8. Keep this module isolated until Video Intelligence architecture adopts it behind a feature flag.

## Deliverables map

| Deliverable | Path |
|-------------|------|
| Isolated module | `poc/gemini-video-verification/src/` |
| Frame extraction | `scripts/extract_frames.py` |
| Sample generator | `scripts/generate_sample_assets.py` |
| GeminiVideoAnalyzer | `src/GeminiVideoAnalyzer.js` |
| Usage tracker | `src/usageTracker.js` |
| Env example | `.env.example` |
| This report | `TECHNICAL_REPORT.md` |
| Runtime artifacts | `output/reports/` (gitignored) |
