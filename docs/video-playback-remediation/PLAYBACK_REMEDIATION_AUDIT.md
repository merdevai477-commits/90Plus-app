# 90Plus Match Highlights & Goal Clips — Playback Remediation Audit

**Status:** Audit + implementation plan only (no production code changes)  
**Date:** 2026-11-20  
**Evidence base:** Current production code + Phase 1–3 POC results  
**Prior commit (Phase 3):** `8434b891f15ea25bfaf578c417d0a00eb3b04693`  
**Prior report:** `poc/gemini-video-verification/phase3/PHASE3_DEVICE_REPORT.md`

---

## Executive verdict

The biggest user-facing bug is **not** missing AI. It is **incorrect error messaging and missing source health checks** in the existing `HighlightVideoSheet` path:

1. Unsupported hosts (`streama.in`, `x.com`) and exhausted URL lists are shown as **“الفيديو مش متاح في البلد دي”** even when no geographic evidence exists.
2. Expired Streamin CDN MP4s return **HTTP 404** but still appear as playable until open-time failure.
3. Summaries already support multi-URL fallback; **goal clips open a single URL** and have no sibling fallback.
4. Gemini is useful only as an **optional post-decode visual layer** — never as the primary playability gate.

**Business goal:** maximize successful watches; when primary fails, try another valid authorized source for the same highlight; never lie about geo.

---

## A. Current architecture

### Data flow

```text
Highlightly API (soccer.highlightly.net)
        │  cron sync (HIGHLIGHTLY_*)
        ▼
MatchHighlight / FixtureHighlightSync (Postgres)
        │  GET /api/football/fixtures/:id/highlights  (DB read only)
        ▼
ApiFootballService.getFixtureHighlights (mobile)
        │
        ├─ MatchSummaryVideo  → summaryUrls[]  → HighlightVideoSheet
        └─ MatchEventsTimeline → assignGoalClips → onPlayClip([url]) → HighlightVideoSheet
                │
                ├─ YouTube? → WebView (youtube-nocookie embed)
                ├─ .mp4/.m3u8 after Streamin rewrite? → DirectClipPlayer (expo-video → AVPlayer/ExoPlayer)
                └─ else / all failed → hardcoded Arabic geo message
```

### Key production files

| Layer | Path | Role |
|-------|------|------|
| Sync | `src/services/highlightly/match-highlights-sync.service.ts` | Pull/store clips |
| Policy | `src/services/highlightly/highlightly.policy.ts` | `pickSummaries` / `pickGoals` ranking |
| Read API | `src/controllers/football.controller.ts` → `getFixtureHighlights` | Serve stored clips |
| Schema | `prisma/schema.prisma` → `MatchHighlight` | One URL (+ optional embedUrl) per Highlightly clip |
| Client fetch | `front/services/apiFootball.ts` → `getFixtureHighlights` | Mobile consumer |
| Screen | `front/app/(tabs)/match-details.tsx` | Wires summary + goals → sheet |
| Timeline | `front/components/match-details/MatchEventsTimeline.tsx` | Goal play button (`clip.url \|\| clip.embedUrl`) |
| Summary card | `front/components/match-details/MatchSummaryVideo.tsx` | Opens summary URL list |
| Player | `front/components/match-details/HighlightVideoSheet.tsx` | Routing + WebView + DirectClipPlayer |
| URL helpers | `front/utils/highlightPlaybackUrl.ts` | Streamin→CDN, YouTube embed, direct-file detect |
| Goal assign | `front/utils/assignGoalClips.ts` | Match clips to goal events |

### Source selection today

- **Summaries:** `pickSummaries` prefers Streamin/MP4 over YouTube; returns **multiple** public clips; client passes `summaryUrls` array into the sheet (fallback by index exists for YouTube geo probe / failures).
- **Goals:** `pickGoals` returns many clips, but UI opens **`[singleUrl]`** only (`onPlayClip={(url) => setHighlightVideoUrls([url])}`).

### Player routing (verified in current code)

```84:157:front/components/match-details/HighlightVideoSheet.tsx
  const fileUrl = resolveHighlightPlaybackUrl(url);
  const embedUrl = url ? youtubeEmbedUrl(url) ?? youtubeEmbedUrl(fileUrl) : null;
  const direct = Boolean(url) && !embedUrl && isDirectHighlightFile(fileUrl);
  // ...
  // WebView if embedUrl
  // DirectClipPlayer if direct
  // else OR failed → "الفيديو مش متاح في البلد دي"
```

---

## B. Root cause analysis

### Issue 1 — False Geo Restriction (P0)

| Field | Detail |
|-------|--------|
| **File** | `front/components/match-details/HighlightVideoSheet.tsx` |
| **Location** | Lines **151–156** (error UI); also conflation via `GEO_BLOCK_PROBE` + `skipBlocked` → `failed` |
| **Current behavior** | Any URL that is neither YouTube nor direct file, **or** any path that exhausts `urls` after skips, shows hardcoded: `الفيديو مش متاح في البلد دي` |
| **Root cause** | Hardcoded geo copy reused as the **universal failure message**. No error taxonomy. Unsupported providers never mount a player, yet are labeled geo. |
| **Evidence** | Phase 3: 4/30 `unsupported_source_no_player` (streama.in / x.com) would hit this UI. Probe confirmed no player mount. |
| **Recommended fix** | Introduce typed failure reasons; map to honest localized strings; only show geo when YouTube/provider text or authoritative API confirms country block. |

### Issue 2 — YouTube probe conflates geo + embed-disabled

| Field | Detail |
|-------|--------|
| **File** | `HighlightVideoSheet.tsx` |
| **Function** | Injected `GEO_BLOCK_PROBE` (lines 25–49); `onMessage` → `skipBlocked` |
| **Current behavior** | Regex treats country unavailability **and** “playback on other websites has been disabled” **and** YouTube errors 100/101/150 as the same `unavailable:` signal. |
| **Root cause** | Single sink (`skipBlocked`) with no reason code. After last URL, user still sees geo text. |
| **Evidence** | Probe script + code review; YouTube watch may work while embed fails (error 150). |
| **Recommended fix** | Split messages: `GEO_RESTRICTED` vs `EMBED_UNAVAILABLE`; optional authorized “Open in YouTube”. |

### Issue 3 — Expired Streamin CDN (P0)

| Field | Detail |
|-------|--------|
| **Files** | `highlightPlaybackUrl.ts` (`resolveHighlightPlaybackUrl`); `DirectClipPlayer`; DB `MatchHighlight.url` |
| **Current behavior** | Watch page rewritten to `https://c-cdn.streamin.top/uploads/{id}.mp4`. No preflight. 404 surfaces as player error → skip → eventually geo UI. |
| **Root cause** | Stored URL presence ≠ live object. No health check at API or client open-time. |
| **Evidence** | Phase 2/3: **3/9** MP4 → HTTP 404; **6/9** → HTTP 206 + H.264. |
| **Recommended fix** | Client Range preflight before mount; hide/disable play CTA on 404/410; backend optional liveness cache later. |

### Issue 4 — Unsupported providers (P0)

| Field | Detail |
|-------|--------|
| **Files** | `highlightPlaybackUrl.ts` (only Streamin + YouTube + `.mp4/.m3u8`); sheet error branch |
| **Current behavior** | `streama.in`, `x.com`, etc. are not rewritten and not YouTube → error geo UI. |
| **Root cause** | Compatibility gap + wrong UX, not geo. |
| **Evidence** | Phase 3: 0/4 player mounts; classification `unsupported_source_no_player`. |
| **Recommended fix** | Classify `UNSUPPORTED_PROVIDER`; message “هذا المصدر غير مدعوم”; do not attempt native play; prefer alternate clip for same event if available. |

### Issue 5 — Goal clips lack multi-source fallback (P1)

| Field | Detail |
|-------|--------|
| **Files** | `match-details.tsx` (`onPlayClip` single URL); `pickGoals` returns list but UI doesn’t pass siblings |
| **Current behavior** | Summary can fall through URL list; goals cannot. |
| **Root cause** | Product wiring, not missing DB rows. Multiple `goal-clip` rows per fixture already exist. |
| **Evidence** | `setHighlightVideoUrls([url])` vs summary `summaryUrls`. |
| **Recommended fix** | When opening a goal, pass ordered candidate URLs for that event (assigned clip + same-minute alternates / same fixture goals matched carefully). No schema change required for v1. |

### Issue 6 — iOS black screen / WebView quirks (P1)

| Field | Detail |
|-------|--------|
| **File** | `HighlightVideoSheet.tsx` |
| **Current behavior** | Black `playerPlate` behind player; iOS WebView `opacity: 0.99`; spoofed **Android Chrome** UA; `allowsFullscreenVideo={false}` on iOS; DirectClipPlayer waits for `readyToPlay` with retries 150/400/900ms; no poster; no timeout UI for stuck `loading`. |
| **Root causes (distinct)** | (a) UI looks black while buffering; (b) WebView/embed fail → black until skip; (c) MP4 never reaches ready; (d) decoder/network error after mount. |
| **Evidence** | Code + Phase 3 note on UA/fullscreen/opacity; native first-frame rates **not yet measured** (auth wall on Expo simulators). |
| **Recommended fix** | Honest loading state; iOS-native UA for YouTube; typed errors; first-frame / ready timeout; keep expo-video (no player rewrite). |

### Issue 7 — No playback telemetry (P2)

| Field | Detail |
|-------|--------|
| **Current** | No structured events for init / first frame / error code / source class. |
| **Impact** | Cannot prove iOS vs Android rates in production. |
| **Fix** | Minimal Sentry/analytics events (no tokens/PII). |

### Issue 8 — Gemini scope (explicit non-goal)

Gemini must **not** gate playability or geo. Optional later for black/error-frame screenshots only.

---

## C. Geo restriction remediation

### How false geo happens today

1. **Hardcoded catch-all** when `!embedUrl && !direct` or `failed`  
   → always Arabic geo string (`HighlightVideoSheet.tsx` L151–156).
2. **YouTube probe** merges country text + embed-disabled + errors 100/101/150 into one `unavailable` channel → after list exhaustion, same geo UI.
3. **No use** of Highlightly `/highlights/geo-restrictions/{id}` in this codebase (confirmed absent).

### Safe rules

| Condition | Classification | User message (EN / AR intent) |
|-----------|----------------|-------------------------------|
| YouTube page text / official geo API confirms country block | `GEO_RESTRICTED` | Unavailable in your region |
| YouTube embed disabled / error 150 | `EMBED_UNAVAILABLE` | Can’t play inside the app — open in YouTube |
| HTTP 404/410 on CDN | `SOURCE_NOT_FOUND` / `SOURCE_EXPIRED` | Video currently unavailable |
| Host not YouTube and not direct media | `UNSUPPORTED_PROVIDER` | This video source is not supported |
| Timeout / offline | `NETWORK_ERROR` / `PLAYBACK_TIMEOUT` | Unable to load — try again |
| expo-video `status === 'error'` without HTTP evidence | `PLAYER_INITIALIZATION_FAILED` or `DECODER_ERROR` | Unable to play this video |
| Ambiguous | `UNKNOWN_ERROR` | Something went wrong — try again |
| Never | Invent geo | — |

### Implementation shape (plan only)

- Add `PlaybackFailureReason` union in a small helper (e.g. `front/utils/highlightPlaybackErrors.ts`) — **surgical change** to sheet message mapping, not a rewrite.
- Change `skipBlocked(reason)` to carry reason through list exhaustion.
- Localize via `front/locales` (reuse `videoUnavailable` patterns; add geo-specific keys only for confirmed geo).

---

## D. iOS playback remediation

### Keep current stack

- YouTube → WebView (existing)  
- MP4/HLS → `expo-video` / AVPlayer (existing `DirectClipPlayer`)  
- **Do not** replace the player.

### Prioritized iOS fixes

| Priority | Fix | Why |
|----------|-----|-----|
| P0 | Stop false geo; typed errors | UX honesty |
| P0 | MP4 Range preflight | Avoid opening dead CDN |
| P1 | Loading / timeout UI instead of bare black plate | Separates “buffering” from “broken” |
| P1 | YouTube: iOS Safari-like UA; separate embed vs geo | Reduces WebView black / wrong skips |
| P1 | `readyToPlay` watchdog (e.g. 12–15s) → typed failure + fallback | Stuck init |
| P1 | Authenticated device matrix (still open) | Prove first-frame rates |
| P2 | Optional poster from `imgUrl` | Perceived performance |
| P2 | HLS: pass `contentType: 'hls'` when `.m3u8` (if DirectClipPlayer gains source object) | AVPlayer HLS correctness |

### Black screen decision tree

```text
Open sheet
  → unsupported path? → UNSUPPORTED_PROVIDER (not black player)
  → YouTube WebView
       → geo text? GEO_RESTRICTED
       → embed disabled? EMBED_UNAVAILABLE
       → blank > N sec? PLAYBACK_TIMEOUT / EMBED_UNAVAILABLE
  → Direct MP4
       → preflight 404? SOURCE_NOT_FOUND
       → status error? PLAYER/DECODER
       → status loading > N sec with black plate? PLAYBACK_TIMEOUT
       → readyToPlay + playing + frames? success
```

---

## E. Source fallback architecture

### What already exists

- Multiple `MatchHighlight` rows per `fixtureId`.
- Summary UI already passes **URL arrays**.
- Sheet already advances `index` on failure (`skipBlocked`).

### Gap

- Goals pass one URL.
- No health-ordered candidates.
- Exhaustion → fake geo.

### Recommended design (backward compatible)

**v1 — no schema migration**

1. Client builds `candidates: string[]` per open action:
   - Summary: keep `summaries[].url` ordered (already ranked server-side; prefer MP4 then YouTube).
   - Goal: `[assignedClip.url, ...otherSameFixtureGoalUrlsMatchedToSameEvent]` with dedupe; only clips that `assignGoalClips` could associate or share minute/player.
2. Filter candidates client-side:
   - Drop `UNSUPPORTED_PROVIDER`.
   - Optionally HEAD/Range MP4; drop 404.
3. Sheet receives `{ url, reason? }[]` or keeps `urls: string[]` + parallel `reasons` map.
4. On failure, advance with **reason**; never retry same URL in one session.
5. Timeouts: e.g. 12s per candidate; max 3 attempts.

**v2 — optional schema (later)**

- Add nullable `healthStatus`, `lastCheckedAt` on `MatchHighlight` **or** side table `MatchHighlightHealth` — smallest additive change.
- Do **not** rewrite sync; cron can stamp health opportunistically.

### Identity rule

Fallback only among clips already linked to the **same fixture** and, for goals, the **same assigned event / player-minute match**. Never swap an unrelated match video.

---

## F. Implementation roadmap

### P0 — Critical UX (est. S–M)

| Task | Files | Complexity | Dependencies | Regression risk | Acceptance |
|------|-------|------------|--------------|-----------------|------------|
| Typed playback errors + honest messages | `HighlightVideoSheet.tsx`, locales | S | None | Low if messages only | Unsupported/404 never show geo |
| Separate YouTube geo vs embed-disabled | `HighlightVideoSheet.tsx` GEO probe | S | Above | Medium (skip logic) | Error 150 ≠ geo copy |
| MP4 Range preflight before DirectClipPlayer | New tiny util + sheet | S | None | Low | 404 never mounts player |
| Goal multi-URL candidates | `match-details.tsx`, maybe timeline | M | Error typing | Medium | Dead goal URL tries sibling |

### P1 — iOS reliability + fallback polish (est. M)

| Task | Files | Complexity | Dependencies | Regression risk | Acceptance |
|------|-------|------------|--------------|-----------------|------------|
| Loading + ready timeout | `HighlightVideoSheet.tsx` DirectClipPlayer | S | P0 errors | Low | No infinite black without message |
| iOS WebView UA / fullscreen review | sheet | S | Device test | Medium | YouTube first-frame measured |
| Authenticated iOS+Android matrix | POC harness / TestFlight | M | Test account | None to prod code | Rates recorded for 6 MP4 + sample YT |
| Summary/goal candidate ordering + max attempts | match-details + sheet | M | P0 | Medium | Deterministic fallback logs |

### P2 — Diagnostics + optional Gemini (est. S–M)

| Task | Files | Complexity | Dependencies | Regression risk | Acceptance |
|------|-------|------------|--------------|-----------------|------------|
| Playback analytics events | sheet + sentry/analytics | S | P0 reasons | Low | Events without secrets |
| Optional Gemini frame check (server or gated) | POC → later worker | M | Local gates first | Must not block play | Only ambiguous cases |

**Do not** rewrite Highlightly sync, Mux, or Reels in this track.

---

## G. Test strategy

### Unit / logic

- URL classification: YouTube / Streamin MP4 / unsupported.
- Error mapping: each reason → correct locale string.
- Fallback: skips failed URL; does not loop; max N.

### Network fixtures

- MP4 206 OK (Range).
- MP4 404/410.
- YouTube embed OK HTML.
- YouTube geo text / error 150 HTML.
- Unsupported host.

### Device (authenticated)

| Case | iOS | Android |
|------|-----|---------|
| Known-good Streamin MP4 | first frame < 5s | first frame < 5s |
| 404 MP4 | typed unavailable, no geo | same |
| YouTube embed OK | video visible in WebView | same |
| YouTube embed disabled | EMBED_UNAVAILABLE + optional open | same |
| Unsupported URL | UNSUPPORTED message | same |
| Background/foreground mid-play | resumes or clean pause | same |
| Offline | NETWORK_ERROR | same |
| Multi-URL summary fallback | second URL plays | same |
| Goal sibling fallback | second candidate plays | same |

### Regression

- Reels / Mux / `UnifiedVideoPlayer` untouched.
- Match details non-video tabs unchanged.
- Highlightly sync cron unchanged.

### HLS

- If any `.m3u8` appears in DB: dedicated case for content-type + AVPlayer; currently Phase 2/3 found **none** in sample.

---

## H. Production acceptance criteria

1. Unsupported providers are **never** labeled geo.  
2. HTTP 404/410 are **never** labeled geo.  
3. Unknown geo remains **UNKNOWN** / generic unavailable — not invented restriction.  
4. iOS MP4 playback tested on **authenticated** devices for the 6 known-good CDN samples.  
5. Android MP4 playback tested similarly.  
6. YouTube WebView tested independently (success + embed-disabled + geo).  
7. Failures emit actionable typed states (UI + telemetry).  
8. Fallback only uses same-fixture / same-event authorized clips.  
9. Reels / Mux remain unaffected.  
10. Play CTA not shown (or disabled with reason) when preflight proves dead MP4.

**Ready for production** only when P0 items ship **and** authenticated device matrix for MP4 + YouTube is recorded (closes Phase 3 gap).

---

## Gemini’s role (reminder)

| Allowed (later, optional) | Forbidden |
|---------------------------|-----------|
| Black / error / loading frame classification after decode | Deciding geo |
| Confirming football content on frames | Declaring HTTP health |
| | Declaring native playability alone |

**Do not** add Gemini to production playback in the first remediation PR.

---

## Appendix — Phase evidence snapshot

| Metric | Value |
|--------|-------|
| Sample size | 30 real `MatchHighlight` URLs |
| Direct MP4 | 9 (6× HTTP 206, 3× 404) |
| YouTube | 17 (17× embed HTML OK in probe) |
| Other | 4 (0 player mounts) |
| Failures without AI | 7/30 |
| Gemini comparable accuracy | 23/23 (visual only) |
| Native first-frame rates | Incomplete (auth wall) |

---

## Next step (authorization required)

When approved, implement **P0 only** in a focused PR:

1. Error taxonomy + honest messages in `HighlightVideoSheet`.  
2. MP4 Range preflight.  
3. Goal multi-candidate URL list from existing fixture clips.

No sync rewrite. No player replacement. No deploy from this audit task.
