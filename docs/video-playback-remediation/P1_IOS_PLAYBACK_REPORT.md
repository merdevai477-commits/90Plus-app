# P1 iOS Video Playback Stabilization — Report

**Date:** 2026-11-20  
**Prior P0 commits:** `fe27f82c3`, `f7a02d065`  
**Audit:** `docs/video-playback-remediation/PLAYBACK_REMEDIATION_AUDIT.md`  
**Phase 3:** `poc/gemini-video-verification/phase3/PHASE3_DEVICE_REPORT.md`  
**Deploy / production release:** Not performed

---

## Executive Summary

P1 adds **explicit loading UI**, **initialization / playback-start / YouTube-load watchdogs**, **safe retry**, **AppState pause-on-background**, **HLS `contentType` for expo-video**, **platform-specific YouTube WebView UA**, and **Sentry breadcrumb diagnostics** for Match Highlights / Goal Clips.

P0 typed errors, preflight, geo vs embed separation, and goal multi-URL fallback are **preserved**.

**Not yet proven on authenticated devices:** native first-frame / time-to-play rates remain unverified (same blocker as Phase 3). Code is ready for a dedicated iOS testing build.

---

## Root Causes

| Issue | Evidence | Fix |
|-------|----------|-----|
| Indefinite black plate with no feedback | `HighlightVideoSheet` mounted black `playerPlate` with no loading chrome; DirectClipPlayer had no ready/play timeouts | Loading overlay + UI phases; 12s init / 15s playback-start / 15s YouTube-load watchdogs |
| Stuck player after error | Failures only advanced URL index; no Retry; no session reset | Recoverable Retry resets refs, remounts via `sessionNonce`, disposes previous player via key change |
| HLS may mis-detect on iOS | expo-video docs require `.m3u8` or `contentType: 'hls'`; DirectClipPlayer passed bare string URL | `buildHighlightVideoSource()` sets `contentType: 'hls'`, disables caching for HLS |
| iOS YouTube UA spoof | WebView used Android Chrome UA on all platforms (Phase 3 / audit) | `youtubeWebViewUserAgent()` — Safari Mobile on iOS, Chrome Mobile on Android |
| No playback observability | No session-scoped events for highlights | `emitHighlightPlaybackDiagnostic` → Sentry breadcrumbs (`highlight-playback`) |
| Background leak risk | No AppState handling in DirectClipPlayer | Pause on background; **no** auto-resume / no background audio |

---

## Files Changed

| File | Purpose |
|------|---------|
| `front/utils/highlightPlaybackLifecycle.ts` | Timeouts, UI phases, HLS source builder, UA helpers, diagnostics |
| `front/utils/__tests__/highlightPlaybackLifecycle.test.ts` | Unit tests for lifecycle helpers |
| `front/components/match-details/HighlightVideoSheet.tsx` | Loading UI, watchdogs, retry, AppState, diagnostics, HLS source, iOS UA |
| `front/locales/en.ts` / `ar.ts` | Loading / initializing / retry strings |
| `docs/video-playback-remediation/P1_IOS_PLAYBACK_REPORT.md` | This report |

**Unchanged by design:** Highlightly sync, schema, Mux/Reels/`UnifiedVideoPlayer`, API contracts.

---

## Implementation Details

### Loading / timeouts
- UI phases: `idle → initializing → loading → ready → playing` or `timed_out` / `error_recoverable` / `error_unrecoverable`.
- Constants in `HIGHLIGHT_PLAYBACK_TIMEOUTS`: init **12s**, playback-start **15s**, YouTube load **15s**.
- Timers cleared on cleanup; `failOnce` / `attempted` refs prevent duplicate advances.

### AVPlayer / expo-video
- `DirectClipPlayer` uses `buildHighlightVideoSource(url)` (HLS-aware).
- Tracks `PLAYER_READY` via `readyToPlay`; `PLAYBACK_STARTED_OBSERVED` via `playingChange`.
- **Does not emit `FIRST_FRAME_RENDERED`** — expo-video has no reliable first-frame API; limitation documented.
- Remount key includes `sessionNonce` so retry disposes the previous player instance.

### YouTube WebView (iOS)
- `allowsInlineMediaPlayback={true}`, `mediaPlaybackRequiresUserAction={false}` retained.
- `allowsFullscreenVideo={false}` on iOS retained — modal 16:9 sheet conflicts with native fullscreen.
- iOS opacity `0.99` retained (historical black-screen mitigation).
- UA switched to Safari Mobile on iOS only.
- P0 probe classification preserved (`GEO_RESTRICTED` vs `EMBED_UNAVAILABLE` / 100/101/150).
- Open in YouTube retained for embed-disabled finals.
- Load watchdog skips to next candidate / timeout error if `onLoadEnd` never fires.

### MP4 / HLS
- P0 Range preflight retained before mount.
- HLS gets `contentType: 'hls'`; MP4 uses caching; 403 still not geo.

### Lifecycle
- Sheet close → surface teardown + `PLAYER_DISPOSED`.
- App background → pause; foreground → no forced resume (native controls remain).
- Retry resets attempted URLs and failure reasons; no infinite loop (user-gated).

### Diagnostics
- Breadcrumbs only; sanitized URLs (no query tokens); never throws into UI.
- Stages: `VIDEO_REQUESTED`, `PLAYER_INITIALIZING`, `PLAYER_READY`, `PLAYBACK_STARTED_OBSERVED`, `PLAYBACK_CONFIRMED`, `PLAYBACK_ERROR`, `PLAYER_TIMEOUT`, `PLAYER_RETRY`, `PLAYER_DISPOSED`.

---

## Test Results

| Suite | Result |
|-------|--------|
| `highlightPlaybackLifecycle` | Pass |
| `highlightPlaybackErrors` (P0) | Pass |
| `highlightMp4Preflight` (P0) | Pass |
| `goalClipPlaybackCandidates` (P0) | Pass |
| `highlightPlaybackUrl` / `assignGoalClips` | Pass |
| **Total related** | **6 suites / 37 tests Pass** |
| ESLint (changed files) | 0 errors |
| `tsc` on P1 files | No new errors (repo still has pre-existing unrelated TS errors in reels/profile) |
| Authenticated iPhone playback matrix | **Blocked** — not run in this session |
| Authenticated Android matrix | **Blocked** — not run in this session |
| Expo/iOS archive build | **Not run** — prepare separately for device QA |

### Device matrix (ready for QA)

| Test | Expected | Status |
|------|----------|--------|
| Known-good MP4 | Playback &lt; ~5s target | Unverified |
| Dead MP4 404 | Unavailable message, not geo | Code-covered (P0) |
| MP4 403 | Not geo | Code-covered (P0) |
| YouTube embeddable | Plays in WebView | Unverified on device |
| YouTube embed disabled | Open in YouTube | Code-covered |
| Valid HLS | Plays with contentType hls | Code path added; needs device |
| Slow network / timeout | Loading then timeout message + Retry | Code-covered |
| Background / foreground | Pauses; no surprise resume | Code-covered logic |
| Repeated open/close | No stale player | Code path via keys/nonce |
| Fullscreen iOS | Remains disabled in modal | Intentional |

---

## iOS Build Readiness

**Yes — ready for a dedicated authenticated iOS testing build** focused on Match Highlights / Goal Clips.

Not ready to declare production playback SLAs until the device matrix above is executed.

---

## Known Limitations

1. No native `FIRST_FRAME_RENDERED` signal from expo-video — using `PLAYBACK_STARTED_OBSERVED` (`playing === true`) instead.
2. YouTube success still inferred from WebView `onLoadEnd` + absence of probe errors (not pixel proof).
3. iOS fullscreen remains disabled in-sheet.
4. Authenticated device timings unfinished (Phase 3 gap persists).
5. Gemini not used (by design).

---

## Regression Assessment (P0)

| P0 behavior | Status |
|-------------|--------|
| Typed failure reasons | Preserved |
| Geo only with evidence | Preserved |
| Embed-disabled ≠ geo | Preserved |
| MP4 Range preflight | Preserved |
| 404/410/403 classification | Preserved |
| Goal multi-candidate fallback | Preserved |
| Summary multi-URL fallback | Preserved |
| Highlightly / Mux / Reels untouched | Confirmed |

---

## Remaining Risks

- iOS Safari UA change may alter YouTube embed behavior vs prior Android spoof — **must validate on device**.
- Watchdog values (12s/15s) may be tight on very slow networks — adjustable via constants.
- HLS sources were rare in Phase 2/3 samples — path untested on device.
- Diagnostics are breadcrumbs only (no dashboard until Sentry filters are used).

---

## Commit Information

- **Implementation:** `d9bcb70d7e78d09cef20c4d0a119d91672d7a9a4` — Stabilize highlight playback with timeouts, retry, and diagnostics.
- **Pushed:** `origin/main`
- **P0 preserved:** `fe27f82c3` / `f7a02d065`
