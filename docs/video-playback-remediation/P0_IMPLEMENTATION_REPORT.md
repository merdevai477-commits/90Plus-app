# P0 Video Playback Remediation — Implementation Report

**Date:** 2026-11-20  
**Audit source:** `docs/video-playback-remediation/PLAYBACK_REMEDIATION_AUDIT.md`  
**Scope:** Typed errors, YouTube geo vs embed, MP4 Range preflight, goal multi-source fallback  
**Deploy:** Not performed

---

## 1. Summary of implemented changes

1. **Typed playback failure reasons** (`GEO_RESTRICTED`, `SOURCE_NOT_FOUND`, `SOURCE_EXPIRED`, `UNSUPPORTED_PROVIDER`, `NETWORK_ERROR`, `PLAYER_INITIALIZATION_FAILED`, `DECODER_ERROR`, `EMBED_UNAVAILABLE`, `PLAYBACK_TIMEOUT`, `UNKNOWN_ERROR`).
2. **Removed hardcoded geo catch-all** in `HighlightVideoSheet`. Failures now map to honest localized messages.
3. **YouTube probe** reports distinct reasons (geo text vs embed-disabled vs errors 100/101/150).
4. **MP4 Range preflight** runs before mounting `DirectClipPlayer`; 404/410 never mount the player.
5. **Goal clips** open an ordered same-fixture / same-event candidate list instead of a single URL.
6. **Optional “Open in YouTube”** when the final reason is `EMBED_UNAVAILABLE`.

---

## 2. Exact modified / added files

### Added
- `front/utils/highlightPlaybackErrors.ts`
- `front/utils/highlightMp4Preflight.ts`
- `front/utils/goalClipPlaybackCandidates.ts`
- `front/utils/__tests__/highlightPlaybackErrors.test.ts`
- `front/utils/__tests__/highlightMp4Preflight.test.ts`
- `front/utils/__tests__/goalClipPlaybackCandidates.test.ts`
- `docs/video-playback-remediation/P0_IMPLEMENTATION_REPORT.md`

### Modified
- `front/components/match-details/HighlightVideoSheet.tsx`
- `front/components/match-details/MatchEventsTimeline.tsx`
- `front/app/(tabs)/match-details.tsx`
- `front/utils/assignGoalClips.ts` (exported matching helpers only)
- `front/locales/en.ts`
- `front/locales/ar.ts`

### Explicitly unchanged
- Highlightly sync (`src/services/highlightly/match-highlights-sync.service.ts`)
- Highlightly ranking (`highlightly.policy.ts`)
- Prisma / database schema
- Mux / Reels / `UnifiedVideoPlayer`
- Player stack (`expo-video`, YouTube WebView architecture, User-Agent, fullscreen)

---

## 3. Error classification — before vs after

| Situation | Before | After |
|-----------|--------|-------|
| Unsupported host (`streama.in`, `x.com`) | Geo Arabic message | `UNSUPPORTED_PROVIDER` |
| Exhausted URL list after mixed failures | Always geo | `pickFinalPlaybackReason(...)` — never invents geo |
| HTTP 404 MP4 | Player error → eventually geo | `SOURCE_NOT_FOUND` (preflight) |
| HTTP 410 MP4 | Same | `SOURCE_EXPIRED` |
| HTTP 403 MP4 | Could end as geo | `UNKNOWN_ERROR` (not geo) |
| YouTube country text | Merged `unavailable` → geo UI | `GEO_RESTRICTED` |
| YouTube embed disabled / 101 / 150 | Merged → geo UI | `EMBED_UNAVAILABLE` (+ Open in YouTube) |
| YouTube error 100 | Merged → geo UI | `SOURCE_NOT_FOUND` |
| Native player `status === 'error'` | Skip → eventual geo | `PLAYER_INITIALIZATION_FAILED` then fallback |

---

## 4. MP4 preflight behavior

- `GET` with `Range: bytes=0-1`, `redirect: follow`, default **8s** timeout.
- **206 / 200** → mount `DirectClipPlayer`.
- **404** → `SOURCE_NOT_FOUND`; **410** → `SOURCE_EXPIRED`.
- **403/401** → `UNKNOWN_ERROR` (not geo).
- Abort/timeout → `PLAYBACK_TIMEOUT`; network throw → `NETWORK_ERROR`.
- Concurrent duplicate URL requests share one in-flight promise.
- YouTube WebView path is **not** preflighted.
- Successful preflight does **not** claim decode/playback success.

---

## 5. Goal fallback behavior

- `buildGoalClipPlaybackCandidates(events, eventIndex, fixtureClips)`:
  - Primary = clip assigned by existing `assignGoalClips`.
  - Alternates = other clips in the **same fixture list** matching same player/minute.
  - Skips URLs already assigned to a **different** goal event.
  - Deduplicates; deterministic order (primary → supported alternates → unsupported).
- `MatchEventsTimeline` passes `string[]` to `onPlayClip`.
- Summary path still passes `summaryUrls` unchanged.
- Sheet advances candidates with typed reasons; never retries the same URL in one session.

---

## 6. Test results

```text
PASS utils/__tests__/highlightPlaybackErrors.test.ts
PASS utils/__tests__/highlightMp4Preflight.test.ts
PASS utils/__tests__/goalClipPlaybackCandidates.test.ts
PASS utils/__tests__/highlightPlaybackUrl.test.ts
PASS utils/__tests__/assignGoalClips.test.ts

Test Suites: 5 passed, 5 total
Tests:       31 passed, 31 total
```

Covered: unsupported/404/410/403≠geo, YouTube 150/geo/embed, preflight 206/200/404/410/403/redirect/timeout/offline/dedupe, goal primary/alternates/dedupe/unrelated rejection/empty/fixture scope.

---

## 7. Typecheck / lint results

- **eslint** on changed utils + sheet + timeline: **0 errors** (pre-existing `Array<T>` warnings in `assignGoalClips.ts` only).
- **tsc --noEmit**: project still has **pre-existing** errors in unrelated files (`reels.tsx`, `profile.tsx`, `useReelCommentThread.tsx`, etc.). After fixes, **no remaining errors** in P0 playback files.
- Device / Expo simulator authenticated playback matrix: **not run** (P1; requires test account on physical/authenticated devices).

---

## 8. Remaining known limitations

- No ready/first-frame timeout UI (black plate during preflight/buffer still possible) — **P1**.
- iOS WebView still uses Android Chrome UA / `opacity: 0.99` / no iOS fullscreen — **unchanged for P0**.
- Preflight proves reachability only, not codec compatibility.
- Goal alternates depend on title/description player+minute signals; weak metadata → fewer fallbacks.
- No backend health cache / Highlightly geo API integration.
- No production telemetry events yet — **P2**.

---

## 9. Regression risks

| Risk | Mitigation |
|------|------------|
| Extra Range request latency before MP4 play | 8s cap; small Range; dedupe |
| Over-skipping YouTube on probe false positives | Narrower geo regex; embed/errors separated |
| Goal fallback picking wrong clip | Same-event match + exclude other assigned goals |
| Locale missing keys | Fallback English strings in sheet |
| Summary regressions | Summary wiring untouched |

---

## 10. P1 recommendations (iOS / device)

1. Loading + ready-to-play watchdog with typed `PLAYBACK_TIMEOUT`.
2. Evaluate iOS-native UA / fullscreen for YouTube WebView with reproducible A/B.
3. Authenticated iOS + Android matrix for the 6 known-good Streamin MP4s + YouTube samples.
4. Optional poster from `imgUrl` to reduce perceived black screen.
5. Minimal Sentry/analytics playback events using the new reason codes.

---

## Confirmations

- Highlightly synchronization: **not changed**
- Mux / Reels: **not changed**
- Database schema / migrations: **not introduced**
- Deploy: **not performed**

---

## Git

- **Commit:** `fe27f82c360418b9bf73f3351e3f7e4a2558ad93`
- **Message:** Fix false geo labels and add highlight playback fallbacks.
- **Pushed:** `origin/main`
- Diff focuses on the files listed in section 2.
