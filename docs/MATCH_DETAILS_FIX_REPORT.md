# Match Details Fix Report — WS Events, Lineups Retry, H2H Cache

**Date:** 2026-09-04  
**Scope:** Match Details only (Fixes 1–3 + Sentry stopgap). Standings untouched. Matches-list Phases 0–5 / P1-7 untouched.

---

## Summary

| Fix | Approach | Verified in this pass |
|-----|----------|----------------------|
| **MD-C1** Events delay | **Full WS fix** — `match_update.newEvents` pushed from server on score/status change + 8s live tick | Unit tests + backend build ✅; live goal latency **NOT manually observed** (no live fixture during pass) |
| **MD-L1/L2** Lineups retry storm | Removed redundant `/details` re-fetch; provisional lineups render immediately; capped retries documented | Code + unit logic ✅; device stopwatch **NOT run** |
| **MD-C2** H2H slow | Redis TTL **12h** when no live games; in-flight coalescing; client duplicate `/form` fallback removed | Unit tests ✅; production warm latency **NOT re-measured post-deploy** |

---

## Fix 1 — Live events (WS primary path)

### What changed

**Approach: full WebSocket fix** (not poll-interval fallback).

1. **`src/services/live-fixture-event-push.service.ts`** (new) — on live sync, fetches events via `getMatchEvents`, diffs against last-pushed keys, emits `match_update` with optional **`newEvents[]`**.
2. **`src/services/websocket.service.ts`** — extended `MatchUpdatePayload` with `newEvents?: WsFixtureEvent[]`.
3. **`src/services/live-fixture-sync.service.ts`** — on any live snapshot change, pushes score WS as before; additionally calls event push on score/status change (**forceRefresh**) or every **8s** live tick (cards/subs without score change).
4. **`src/services/live-match-ingestor.service.ts`** — favorited-match ingest pushes event delta when `freshEvents.length > 0`.
5. **Client** — `patchFromWebSocket` merges `newEvents` via `front/utils/mergeFixtureEvents.ts`; WS-trusted reconciliation poll widened to **60s** (`LIVE_FIXTURE_EVENTS_RECONCILE_MS`); fallback poll remains **15s** when WS untrusted.

### Before / after (behavior)

| Signal | Before | After (expected) |
|--------|--------|------------------|
| Goal delivery path | WS score only; events up to **15s** poll | Goal in `newEvents` on score-change push (server 129–228ms path) + 60s reconcile |
| WS-trusted events poll | Every **15s** | Every **60s** (safety net) |
| Score/status WS | Unchanged | Unchanged ✅ (regression covered by existing sync tests + manual code review) |

### Tests

- `src/services/__tests__/live-fixture-event-push.service.test.ts` — 2/2 pass (delta push + dedupe).
- `front/utils/__tests__/mergeFixtureEvents.test.ts` — 2/2 pass (client merge without poll).

### NOT verified

- No currently-live match opened on device during this pass → **goal appears faster than 15s** is code-complete but **not stopwatch-confirmed**.

---

## Fix 2 — Lineups sequential double-fetch + retry storm

### What changed

**`front/app/(tabs)/match-details.tsx`**

1. **Removed** `fetchAndIngestFull(fixtureId)` after non-authoritative `/lineups` (was redundant `/details` round-trip at `:706-707`).
2. **Provisional lineups** — any `hasLineupData(fresh)` merged immediately via `pickBetterLineups`; tab marked loaded even when not authoritative.
3. **`MAX_LINEUP_AUTO_RETRIES = 4`** documented in code; retries continue in background without blocking rendered provisional data.
4. **Pre-kickoff copy** — `lineupsNotAnnounced` when status NS/TBD and kickoff in future (`en.ts` / `ar.ts`).
5. Sentry `captureMessage` when retry cap exhausted without authoritative data.

**Backend:** breadcrumb when 365 merged lineups served as incomplete (`get365LineupsMerged`).

### Before / after (behavior)

| Signal | Before | After (expected) |
|--------|--------|------------------|
| Non-authoritative lineups | `/lineups` → **`/details`** sequential | `/lineups` only; snapshot merge |
| UI while retrying | Spinner up to **4×8s** with empty data | Provisional pitch visible; silent background upgrade |
| Pre-kickoff | Generic “unavailable” | **“Lineups not yet announced”** |

### NOT verified

- No manual stopwatch on lineups tab open → **time-to-first-lineup** not measured on device.

---

## Fix 3 — H2H / competitor-matches cache + duplicate calls

### What changed

1. **`ThreeSixFiveScoresService.COMPETITOR_MATCHES_LIVE_TTL_MS = 60_000`** (unchanged intent).
2. **`ThreeSixFiveScoresService.COMPETITOR_MATCHES_FINISHED_TTL_MS = 43_200_000`** (12h) when response has no live fixtures.
3. **`pendingCompetitorMatches`** in-flight coalescing (same competitor + lang → one upstream pagination).
4. **`football-data-cache.service.ts`** — Sentry breadcrumbs + slow/empty warnings on `getCached365CompetitorMatches`.
5. **`football.controller.ts`** — `_meta.cacheHit` on competitor-matches response.
6. **Client** — when `/cached/365/fixture/:id/form` returns a payload (even empty), **skip** duplicate client-side `getCompetitor365Matches` pair (backend already ran fallback).

**Cache key:** per-competitor `365:competitor:{id}:matches:{langId}` — order-independent for H2H (meetings filtered from home competitor’s finished list; team A vs B does not require a pair key because upstream is per-club).

### Before / after (latency)

| Endpoint | Pre-fix (fixture 4665946) | Post-fix expected |
|----------|----------------------------|-------------------|
| Cold `/cached/365/competitor/69463/matches` | **1,729 ms** | ~same on first miss (upstream-bound) |
| Warm (same TTL window) | **211 ms** (60–300s TTL) | **~200 ms** consistently for **12h** on finished-heavy responses |

### Tests

- `src/services/__tests__/competitor-matches-cache.test.ts` — 3/3 pass (cache hit, coalesce, 12h TTL).

### NOT verified

- Changes **not deployed** to `90plus.pro` during this pass → no new cold/warm Postman numbers recorded post-deploy.
- Railway cache-hit logs **not checked** (no deploy).

---

## Sentry instrumentation

### Org / project resolution

| Surface | Org (MCP) | Project | DSN source |
|---------|-----------|---------|------------|
| **Mobile** | `mrdev-pk` | `90plus-app` | `EXPO_PUBLIC_SENTRY_DSN` / `eas.json` |
| **Backend** | **`90plus`** (not visible in current MCP token — only `mrdev-pk` listed) | **`90plus-backend`** per `src/config/sentry.config.ts` + prior forensic pass (`90PLUS-BACKEND-B`) | `SENTRY_DSN` env on Railway |

MCP `find_organizations` in this session returned **only `mrdev-pk`**. Backend events route to **`90plus/90plus-backend`** per deployed DSN; mobile to **`mrdev-pk/90plus-app`**.

### Added breadcrumbs / messages

| Path | Backend | Frontend |
|------|---------|----------|
| WS event push | `match-details.ws` on push | `match-details.events` on WS receive + poll |
| Lineups | `match-details.lineups` incomplete marker | fetch start / cap exhausted warning |
| H2H | `match-details.h2h` cache hit/miss + slow/empty warnings | form fetch start |

### NOT verified

- Instrumentation **not triggered in staging/production** during this pass → **no new events confirmed in Sentry UI/MCP** (code-only until deploy).

---

## Build & test commands run

```
npm run build                    # backend tsc ✅
npm test -- live-fixture-event-push|competitor-matches-cache  # 5/5 ✅
cd front && npm test -- mergeFixtureEvents                    # 2/2 ✅
```

---

## Explicitly NOT fixed / deferred

- **Standings tab** — still NOT MEASURED (per scope).
- **P3-12 empty performance spans** — not touched (separate investigation).
- **Live goal WS latency** — not manually validated (no live match at test time).
- **Sentry live verification** — pending deploy + staging trigger.
- **Production H2H warm latency after 12h TTL** — pending deploy + Postman re-run.

---

## Files touched (primary)

- `src/services/live-fixture-event-push.service.ts` (new)
- `src/services/live-fixture-sync.service.ts`
- `src/services/websocket.service.ts`
- `src/services/threeSixFiveScores.service.ts`
- `src/services/football-data-cache.service.ts`
- `src/controllers/football.controller.ts`
- `front/hooks/useLiveFixtureSync.ts`
- `front/src/store/liveFixtureStore.ts`
- `front/utils/mergeFixtureEvents.ts` (new)
- `front/app/(tabs)/match-details.tsx`
- Tests under `src/services/__tests__/` and `front/utils/__tests__/`
