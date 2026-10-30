# Phase 1 Pre-Release Audit — Matches (المباريات) + Match Details

**Date:** 2026-10-30 (UTC afternoon / Egypt evening)  
**Auditor role:** Principal QA/Release Engineer  
**Method:** READ-ONLY code trace + live production HTTP (`curl.exe` → `https://90plus.pro/api`) + Railway MCP + Sentry MCP + Neon MCP (SELECT) + local Jest + parallel explore audits ([Audit Matches frontend](2ba805d2-c439-4fb9-83f3-40f07e209eea), [Audit Matches backend](1ce5b4c1-7ead-4835-80d7-b5670be8961f))  
**Production git (health):** `277f632aed21` · Railway deploy `3d162e3c` SUCCESS · uptime ~25m at first probe  
**Scope constraint:** No source edits, no commits, no production chat POSTs. Only this report file written.

---

## 1. Executive verdict

Ship is **not blocked by a confirmed crash-loop or P0 auth/schema break**, but **Match Details event quality for a material slice of live fixtures is currently degraded** (empty `/events` while score/clock advance; EmptyBackoff streaks in Railway logs). Stale `liveFixtureStore` overlay regressions covered by unit tests **pass**; residual device races remain UNVERIFIED. Parallel audits also flag **unauthenticated main Socket.IO `subscribe`**, **date-range `findMany` without `take`**, and **PST phase inconsistency** across list/store/details. Backend Sentry org `90plus` and live Railway Postgres/Redis key inspection are **UNVERIFIED** via available MCP auth.

---

## 2. File map

### 2.1 Frontend (`front/`)

| Area | Path | Role |
|---|---|---|
| Matches screen | `front/app/(tabs)/matches.tsx` | Date chips, filters, FlashList pager, pull-to-refresh, open details |
| Match Details | `front/app/(tabs)/match-details.tsx` | Tabs (events/lineups/stats/form/standings/chat), loaders |
| Data hook | `front/hooks/useMatchesData.ts` | Calendar fetch, live merge, soft refresh |
| Network calendar | `front/components/Matches/leagueApiUtils.ts` | `fetchMatchesByDate` → `?view=list`, `fetchLiveMatches`, status/minute mapping |
| Live feed owner | `front/services/liveFeedOwner.ts` | Single owner for `/fixtures/live` |
| Calendar⊕live merge | `front/utils/mergeTodayCalendarWithLiveFeed.ts` | NS→live promote; SUSP cross-day inject block; FT gap grace |
| Snapshot overlay | `front/utils/overlaySnapshotsOnCalendar.ts` | Zustand snap vs calendar freshness (`decideLiveMerge`) |
| Freshness engine | `front/utils/liveFixtureFreshness.ts` | KEEP/REPLACE clock merge |
| Live store | `front/src/store/liveFixtureStore.ts` (+ `.types.ts`, `liveFixtureSync.ts`) | Snapshots, WS patch, HTTP ingest, interest |
| Global sync | `front/hooks/useLiveFixtureSync.ts` | WS + poll cadence |
| API client | `front/services/apiFootball.ts` | `/cached/fixture/:id/*`, gated by `detailsRequestGate` |
| Stampede gate | `front/services/detailsRequestGate.ts` | `maxConcurrent = 3` |
| Accordion UI | `front/components/Matches/CountryAccordion.tsx` | Country→league→cards (no nested FlashList) |
| Favorites list | `front/components/Matches/FavoritesTab.tsx` | FlashList |
| Chat tab | `front/components/match-details/MatchChatTab.tsx` | Socket client UX |
| Momentum | `front/components/match-details/MatchMomentumGraph.tsx` | **Shipped** (file present) |
| Lineup photos | `front/utils/lineupMatchState.ts`, `LineupBenchDrawer.tsx` | `id ?? athleteId` → photo URL |
| Contract types | `front/components/Matches/matchCardUtils.ts` | `TeamInfo` = `{name,logo}` only (no team id) |

### 2.2 Backend (repo root — **live**)

| Area | Path | Role |
|---|---|---|
| Routes | `src/routes/football.routes.ts` | `/cached/matches/:date`, `/fixtures/live`, `/cached/fixture/:id/*` |
| Controller | `src/controllers/football.controller.ts` | List projection `?view=list`, details bundle |
| List projection | `src/utils/matches-list-projection.util.ts` | Slim MatchRow fields |
| Cache orchestration | `src/services/football-data-cache.service.ts` | Redis/DB/upstream, details budget |
| 365 live | `src/services/scores365-experiment.service.ts` | Classifier, synthetic live, leases |
| Live sync | `src/services/live-fixture-sync.service.ts` | API-Football live poller + lease |
| Live cache / latch | `src/services/live-fixture-cache.service.ts` | Terminal tombstone + latch TTLs |
| Leader lease | `src/services/football-sync-leader.service.ts` | Redis NX token lease + heartbeat |
| Quota | `src/services/api-football-quota.service.ts` | Daily/job caps |
| Synthetic goals | `src/services/synthetic-goals.service.ts` | Score→goal event fill + dedupe keys |
| Match chat | `src/services/match-chat/*`, `src/routes/match-chat.routes.ts` | Socket.io NS, auth, RL, moderation |
| Startup guard | `src/config/startup-sync.config.ts` | `STARTUP_SYNC_DISABLED` |
| Prisma | `prisma/` + `cached_fixtures` model | Fixture rows |

### 2.3 `Backend/` folder — **stale / not live**

`c:\Football-app\Backend\` contains only `public/` + `terms.html` (static terms). **No Express/Prisma app.** Live API is repo-root `src/` deployed as Railway service `90Plus-app`.

### 2.4 Prior docs (leads only; re-verified)

- `docs/MATCH_DETAILS_FORENSIC_REPORT.md` (2026-09-04)
- `tmp-validation/MATCHES_PIPELINE_LIVE_VALIDATION.md` (2026-09-04)
- `scripts/validate-matches-pipeline.ps1`, `api-football-quota-hotfix.patch`

---

## 3. Flow traces (UI → network → backend → UI)

### 3.1 Matches list (date → render)

```
matches.tsx (useMatchesData)
  → fetchMatchesByDate / fetchTodayMatchesWithLiveFeed
    → leagueApiUtils.fetchMatchesByDateFromNetwork
      GET {api}/football/cached/matches/{YYYY-MM-DD}?view=list[+tz]
        : leagueApiUtils.ts:336-347
  → mapFixturesToMatches / mapFixtureToMatch
        : leagueApiUtils.ts:183-237
  → (today) mergeTodayCalendarWithLiveFeed(calendar, liveFeed)
        : mergeTodayCalendarWithLiveFeed.ts:92-163
        live via liveFeedOwner → GET /football/fixtures/live
  → overlaySnapshotsOnCalendar(rows, liveFixtureStore.snapshots)
        : overlaySnapshotsOnCalendar.ts:31-120
  → countryGroups → FlashList keyExtractor=country
        : matches.tsx:2621-2632
  → CountryAccordion → LeagueSection.map(renderMatchCard)
        : CountryAccordion.tsx (no nested FlashList)
```

**Backend hop:** `football.routes.ts:124-125` → `FootballController` (~`football.controller.ts:1996-2011`) → `projectMatchesForListView` (`matches-list-projection.util.ts:16-74`) → Redis/date cache + 365/API data.

### 3.2 Open Match Details

```
matches handleOpenMatchDetails
  → ingestPreviewIfEmpty(id, fixture)   // liveFixtureStore.ts:263-296
  → router.push match-details?fixtureId=
match-details.tsx
  → useLiveFixture(id, {focused:true})
  → fetchAndIngestFull → GET /cached/fixture/:id/details
        // liveFixtureStore.ts:344-369; apiFootball + detailsRequestGate
  → tabs lazy: /events /lineups /statistics /momentum /365 form|standings
  → MatchChatTab → Socket.io match-chat namespace (auth handshake)
  → MatchMomentumGraph → /cached/fixture/:id/momentum
```

### 3.3 Live minute sync (list ↔ details)

Shared helpers: `resolveLiveMinuteLabel` / `formatLiveMinuteDisplay` (`leagueApiUtils.ts:120-144`).  
Store merge: `decideLiveMerge` on ingest + overlay (`liveFixtureFreshness.ts`, `overlaySnapshotsOnCalendar.ts:69-90`).  
WS path updates score/status/minute only; events HTTP-polled (`useLiveFixtureSync` — prior forensic still matches architecture).

### 3.4 Backend live poller lease

```
live-fixture-sync.syncOnce
  → withSyncLeaderLease('live-fixture-sync', …, {ttlSec:30})
        : live-fixture-sync.service.ts:593-600
  → football-sync-leader: Redis SET NX EX + Lua renew/release
        : football-sync-leader.service.ts:80-146, 151-193
365 synthetic live: withSyncLeaderLease(`365-synthetic-live:${lang}`, ttlSec:60)
        : scores365-experiment.service.ts:3759-3790
```

---

## 4. Real endpoint tests (production)

Base: `https://90plus.pro/api` · Tool: `curl.exe` · Date under test: **2026-10-30**.

### 4.1 Health / providers

| Request | Code | Time | Size | Notes |
|---|---:|---:|---:|---|
| `GET /health` | 200 | 0.40s | 1396 B | `git=277f632aed21`, DB Connected, Redis via quota `redisAvailable:true` |
| providers.apiFootball | — | — | — | `status=active`, **dailyUsed=0/98**, job 0/20, scores365 `active` |
| memory | — | — | — | heapUsed ~103–109MB, **rss ~601MB** |

### 4.2 Matches list

| Request | Code | Time | Size | Notes |
|---|---:|---:|---:|---|
| `GET /football/cached/matches/2026-10-30?view=list` | 200 | **0.69s** | **206,668 B** | **278** fixtures |
| `GET /football/cached/matches/2026-10-30` (full) | 200 | **0.81s** | **331,362 B** | same 278; list/full ≈ **62.4%** |
| `…?view=list&timezone=Africa/Cairo` | 200 | 0.70s | 206,506 B | |
| `GET /football/cached/matches/2026-10-29?view=list` | 200 | 0.57s | 163,703 B | |
| Wrong path `/football/cached/fixtures?date=…` | **404** | — | — | Route is `/cached/matches/:date` |

**Status histogram (list today):** NS=135, FT=110, 2H=16, 1H=10, PST=5, HT=2. **No ABD/AWD in sample.**  
**NS with elapsed>0:** 0. **Live with null elapsed:** 0.

**Timezone bucketing evidence:** fixture `4850847` kickoff `2026-10-29T23:30:00.000Z` (= Egypt **2026-10-30 01:30 +02**) appears on **date=2026-10-30** list and **not** on 2026-10-29 list. PASS for Egypt UTC+2 evening→next local day.

### 4.3 Live feed

| Request | Code | Time | Size | Notes |
|---|---:|---:|---:|---|
| `GET /football/fixtures/live` | 200 | 0.55s | 34,178 B | **results=29** |

Breakdown: 1H=10, 2H=16, HT=2, **SUSP=1** (`4883530` ISCA vs ASEC, elapsed=1, date prior evening +03).

### 4.4 Fixture details / events / lineups / stats / momentum

| Fixture | Kind | details | events | lineups | statistics | momentum |
|---|---|---|---|---|---|---|
| **4800944** | live 2H (good) | 200 / 0.46s / **24,356 B** (events=6 in bundle) | 200 / 0.35s / **5,150 B** (13 ev) | 200 / 0.45s / **18,611 B**; `_meta.lineupPlayerIdField=athleteId` | — | — |
| **4860882** | live 2H | 200 / 0.38s / **3,008 B** | 200 / **0 results** `MISS-EMPTY` | `MISS-EMPTY` 116 B | 200 / 1145 B | `MISS-EMPTY` |
| **4779067** | live 2H | 200 / 0.78s / **82,367 B** | **0 events** | 200 / 75,102 B | — | — |
| **4883777** | FT | 200 / 0.36s / 2,684 B | empty | empty | 1094 B | empty |
| **4850847** | FT 23:30Z | 200 / 0.53s / 4,719 B | 200 / 7 goals | empty lineups | 667 B | 200 / 4,495 B |
| **4883530** | SUSP | 200 / 1.7KB | empty | empty | empty | empty |

Warm `/details` HIT confirmed: `4860882` warm 0.37s `x-cache: HIT` `Cache-Control: public, max-age=9`.

**Events emptiness sample (8 in-play from live feed):** **3 EMPTY / 5 HAS** → **~37.5%** empty timelines while still “live”.

**Lineup athleteId:** players expose `id === athleteId` (e.g. `57293`) and photo `…/Athletes/57293` — **not** roster-slot-only. PASS for sampled rich lineup (`4800944`).

**365Scores compare:** `webws.365scores.com/web/game/?games=4800944` returned empty `games:[]` without app credentials → **UNVERIFIED** vs 365 UI (need authenticated 365 client or internal upstream dump).

### 4.5 Contract: `?view=list` vs front

| Field | Full | List | Front `TeamInfo` / mapper |
|---|---|---|---|
| `teams.*.id` | present | **dropped** | `TeamInfo` has **no id** (`matchCardUtils.ts:16-19`); `mapFixtureToMatch` only name/logo (`leagueApiUtils.ts:184-192`) — **aligned** |
| `teams.*.winner` | present | dropped | unused on list |
| `fixture.venue/referee` | present | dropped | unused on list |
| `fixture.status.{short,elapsed,extra}` | present | present | required — PASS |
| `league.{id,name,logo,country,flag,round}` | present | present | PASS |
| `goals` | present | present | PASS |

Payload savings ~**38%** vs full (206KB/331KB) — consistent with Sep validation (~36%).

---

## 5. DB / Redis checks

### 5.1 Neon MCP (`Football-app` / `bitter-butterfly-92483988`)

- Tables include `cached_fixtures` (schema matches Prisma-style columns).
- `SELECT COUNT(*) FROM cached_fixtures` → **`total=0`**.
- Lookups for live fixture IDs → **empty**.

**Verdict:** Neon project is **not** the populated production match store (or is wiped). Production `DATABASE_URL` is a Railway variable (value not readable via OAuth MCP). **Live DB row assertions = UNVERIFIED** without Railway Postgres read access.

### 5.2 Redis (code + health; keys not dumped)

| Key / concept | Evidence | TTL (code) |
|---|---|---|
| Leader leases `football:sync:leader:{scope}` | `football-sync-leader.service.ts:13-39` | default **30s**, renew ~ttl/3 |
| Live list / per-fixture | `live-fixture-cache.service.ts:31-64` | live list TTL env-driven; terminal tombstone 600s / authoritative **24h**; latch **24h** |
| Synthetic goals `football:synthetic-goals:` | `synthetic-goals.service.ts:46` | (service-managed) |
| Health | `providers.apiFootball.redisAvailable=true`, `redisMemoryFallback=0` | Redis up |
| Direct `GET` lease key | — | **UNVERIFIED** (no Redis CLI/MCP) |

---

## 6. Railway + Sentry

### 6.1 Railway (`superb-passion` / `90Plus-app`)

| Check | Result |
|---|---|
| Latest deploy | `3d162e3c` SUCCESS, commit `277f632`, 2026-10-30T15:39Z |
| CRASHED deploys filter | **none** found |
| Redeploy churn | Many REMOVED same day (UI rank/community commits) — not crash loop |
| Memory 24h | current **0.63GB**, avg 0.61, **max 1.77GB**, limit **6GB** |
| CPU 24h | avg ~0.08, max ~0.31 |
| HTTP p95 (1h) | slowest bucket **6963ms** @ 15:42Z (deploy window) |
| Logs — 365Live | Steady `refreshed N synthetic fixtures (N live in Redis overlay)` ~every 5s / batch ~30/min |
| Logs — EmptyBackoff | **Active**; e.g. `fixture=4883530 streak=275+`, `4860882 streak=25`, many 60s→300s backoff |
| Logs — Lineups | `WARN [Lineups] … reason=upstream_empty source=365` |
| Logs — Quota plan | Every boot: `FOOTBALL_API_PLAN is free/undefined — heavy watchers disabled` while health still shows **98** daily cap active |
| Logs — noise | Recurring `SyntaxError: Expected property name… JSON`; `ENOENT … terms-of-service-v1.0.md` |
| `STARTUP_SYNC_DISABLED` | Variable **name present** on service; **value UNVERIFIED** (OAuth hides values) |

### 6.2 Sentry

| Org / project | Access | Findings (14d) |
|---|---|---|
| `mrdev-pk` / `90plus-app` | **OK** | Top issues: SecureStore, auth session, Android NPE/ANR, React view hierarchy — **no FlashList / match-details / liveFixture hits** in issue or error search |
| `90plus` / `90plus-backend` | **UNVERIFIED** | Org not returned by `find_organizations` (only `mrdev-pk`). Railway has `SENTRY_ORG`/`SENTRY_PROJECT` vars but MCP cannot query backend project |

---

## 7. Edge-case checklist

| Item | Result | Evidence |
|---|---|---|
| Date navigation (API by date) | **PASS** | `/cached/matches/:date` 200; front `formatLocalDateKey` local midnight |
| Egypt TZ: 23:30 UTC → correct local day | **PASS** | `4850847` on 2026-10-30 only (`§4.2`) |
| DST (+2/+3) general | **UNVERIFIED** | Need winter/summer fixture pair on device TZ change |
| Live not shown as NS | **PASS** | NS∩elapsed>0 = 0; live histogram clean |
| FT classification | **PASS** | FT=110 on today list |
| PST classification consistency | **FAIL** | List maps PST→`finished` (`leagueApiUtils.ts:64`); store `derivePhase` maps PST→`upcoming` (`liveFixtureSync.ts:124`); details finished set omits PST |
| ABD/AWD/CANC today | **UNVERIFIED** | None in today's payload |
| SUSP in live feed | **FAIL (product)** | `4883530` in `/fixtures/live`; EmptyBackoff streak 275+ |
| SUSP hidden from “Home”/today inject | **PASS (narrow)** | Front: `mergeTodayCalendarWithLiveFeed.ts:130-131` blocks cross-day SUSP inject; Backend: `IN_PLAY_STATUSES` excludes SUSP/INT (`football-data-cache.service.ts:221`); **no separate Home tab** in `(tabs)` |
| Live minute list↔details shared helpers | **PASS (code)** | `resolveLiveMinuteLabel`; device parity UNVERIFIED |
| Stale snapshot overlay (FT stuck live / freeze) | **PASS (unit)** | overlay tests: finished not revived; REPLACE marks changedIds; 61 related Jest tests green |
| Stale overlay on device under WS+HTTP race | **UNVERIFIED** | Needs low-end Android + live match |
| Pull-to-refresh | **PASS (code)** | `RefreshControl` + `onListPullRefresh` `matches.tsx:2570+` |
| `?view=list` slim vs needs | **PASS** | Projection matches `TeamInfo` (no team id) |
| FlashList `estimatedItemSize` | **PASS (intentional)** | Comment: FlashList v2 auto-measure (`matches.tsx:120-121`) |
| FlashList `getItemType` | **FAIL (missing)** | Matches pager FlashLists have no `getItemType` (`matches.tsx:2584–2633`) — recycle mismatch risk under accordion expand |
| `keyExtractor` uniqueness | **UNVERIFIED** | Country string keys; collision if two groups share display name |
| Nested FlashList | **PASS (structure)** | Accordion uses View/map; pager hosts sibling FlashLists (documented iOS height hacks) |
| Dedicated offline empty state | **FAIL** | Stale banner + load error only; NetInfo used for bell queue, not calendar empty UX |
| Details prefetch stampede | **PASS** | `detailsRequestGate.maxConcurrent=3` + Jest stampede guard |
| Empty/error list UI | **PASS (code)** | `emptyNodeFor` + error wrap `matches.tsx:2502-2523` |
| Offline calendar pull fallback | **PASS (code)** | stale disk on pull failure `leagueApiUtils.ts:313-316` |
| Match Details finished load | **PASS** | FT details 200 |
| Events on all live | **FAIL** | 3/8 sampled empty; EmptyBackoff |
| Lineups athleteId for photos | **PASS** | `lineupPlayerIdField=athleteId`; id=athleteId sample |
| No-lineup waiting | **UNVERIFIED** | Needs UX device; backend returns empty + EmptyBackoff |
| Synthetic goals dedupe | **PASS (code/tests)** | `synthetic-goals.service` + `src/__tests__/synthetic-goals.test.ts` (not re-run this pass) |
| Momentum shipped | **PASS** | Component + endpoint; often EMPTY on lower tiers |
| Live chat auth handshake | **PASS (code)** | Clerk token required `match-chat.auth.ts` + gateway middleware |
| Main Socket.IO `subscribe` auth | **FAIL** | Unauthenticated `socket.join(room)` (`websocket.service.ts:215–217`); chat NS is authed, live-score rooms are not |
| Chat rate limit / moderation | **PASS (code)** | `match-chat.rate-limit.ts`, `match-chat.moderation.ts` + unit tests exist |
| Chat reconnect / room join | **UNVERIFIED** | Device; no prod POST |
| Leader lease single poller | **PASS (code)** + Redis up | Live multi-replica failover UNVERIFIED |
| Terminal latch FT↛live | **PASS (code/tests)** | `live-fixture-cache.service` + tests |
| Empty-upstream backoff | **PASS (live logs)** | EmptyBackoff active (does not eliminate empty-event UX — see MT-1) |
| API-Football quota + 365 fallback | **PASS (health)** | 0/98 used; 365 active; plan warn on boot; live path is 365-primary (quota allowlist) |
| Startup sync flag | **UNVERIFIED (value)** | Flag mechanism exists; Railway var present |
| Unbounded `findMany` (kickoff probe) | **PASS** | `take: NS_KICKOFF_PROBE_LIMIT * 2` `live-fixture-sync.service.ts:290-300` |
| Unbounded `findMany` (day/season) | **FAIL** | `getMatchesFromDbByDateRange` no `take` (`match-cache.service.ts:449–485`); WC season loads similarly |
| OOM risk | **PASS (metrics) / watch** | Max 1.77/6GB; watch `cachedGameByKey` ~250; uncapped `fixtureToGameId` maps (code) |
| Backend/ folder live? | **PASS (stale)** | Static only |

---

## 8. Findings table

| ID | Sev | Evidence | Root cause | Proposed minimal fix | Needs | Schema/Auth? |
|---|---|---|---|---|---|---|
| **MT-1** | **P1** | Live `/events` empty for 4860882, 4779067, 4848788; Railway `[EmptyBackoff] fixture=4860882 streak=25`; details bundle ~3KB while score 2H | Upstream 365 events missing for some competitions; backoff suppresses refresh; client shows empty timeline | Prefer synthetic goals when score>0 & events empty; shorten backoff when score changes; surface “events unavailable” vs spinner forever | Device + 365 dump for empty IDs | N |
| **MT-2** | **P1** | `4883530` SUSP in `/fixtures/live`; EmptyBackoff streak **275+**; still counted in live results=29 | SUSP kept in LIVE_STATUSES for resume polling; no aging-out of long-suspended rows | Age-out SUSP from live list after N hours / when kickoff+window exceeded; keep calendar row as paused | Product rule confirm | N |
| **MT-3** | **P2** | Boot log `FOOTBALL_API_PLAN is free/undefined` every deploy while health `dailyLimit:98` | Env plan unset/mismatch with quota service defaults | Set `FOOTBALL_API_PLAN` explicitly on Railway to intended tier | Ops | N |
| **MT-4** | **P2** | Unit tests PASS for overlay KEEP/REPLACE/FT latch; prior freeze bugs fixed in `e8bf6c1` deploy message | Residual race if calendar & snap clocks tie with divergent status under WS | Keep; add integration test WS-then-HTTP ordering on device farm | Manual device | N |
| **MT-5** | **P2** | Railway JSON `SyntaxError` spam ~16:08Z | Malformed body parse somewhere in request pipeline | Log path + harden JSON parse; stop counting as generic Error | Log stack correlation | N |
| **MT-6** | **P2** | `ENOENT …/terms-of-service-v1.0.md` in deploy logs | Terms file not packaged into `dist` | Include markdown in build assets or serve `Backend/public` copy | Deploy packaging | N |
| **MT-7** | **P2** | Neon `cached_fixtures` count=0; cannot SELECT prod rows | Prod DB is Railway Postgres, not Neon MCP project | Point audit Neon to prod branch **or** read-only Railway TCP | Access | N |
| **MT-8** | **P2** | Sentry org `90plus` not in MCP `find_organizations` | Auth scope / separate Sentry account | Grant MCP access or export backend issues CSV | Auth | N |
| **MT-9** | **P2** | HTTP p95 bucket **6.9s** near deploy; cold 365 paths historically multi-second | Upstream + deploy cold start | Keep stub-first details budget; alert on p95>3s sustained | Metrics SLO | N |
| **MT-10** | **P3** | List still **~207KB**/day | Logos dominate slim DTO | Optional logo CDN size / omit flag URLs | Perf | N |
| **MT-11** | **P3** | Momentum often `MISS-EMPTY` | Feed not available for all comps | Hide chart when empty (if not already) | UX check | N |
| **MT-12** | **P3** | Memory max 1.77GB; `scores365.cachedGameByKey=250` | In-process 365 caches | Cap/evict lastGoodGame maps | Observe 7d | N |
| **MT-13** | **P1** | Main IO `subscribe` joins any room with no handshake auth (`websocket.service.ts:215–217`). Match-chat NS **is** Clerk-authed | Live-score WS path never required auth; rooms are public scores but join spam amplifies multi-replica load | Require token (or signed room) on `subscribe` / rate-limit joins; keep payloads public if desired | Security review + client change | **Y (auth)** |
| **MT-14** | **P1** | `prisma.cachedFixture.findMany` by date range with **no `take`** (`match-cache.service.ts:449–485`); season/WC loads similarly | Historical full-day materialization | Add `take` + pagination or hard day cap; monitor row counts on busy Saturdays | Prod DB row counts (Railway) | N |
| **MT-15** | **P2** | PST: list→`finished`, store phase→`upcoming`, details finished set omits PST | Divergent status sets across layers | Align PST in `FINISHED_STATUS_SHORTS` / `mapFixtureStatus` / details header | Unit tests for PST | N |
| **MT-16** | **P2** | Matches FlashLists lack `getItemType` | Accordion/header/empty variance under recycle | Add `getItemType` for country vs empty vs header rows | Low-end Android scroll test | N |
| **MT-17** | **P2** | No dedicated offline Matches empty UX | NetInfo only wired for bell/offlineQueue | Offline empty copy + retry when NetInfo offline && no disk cache | Device airplane mode | N |
| **MT-18** | **P2** | Front `Lineup` type omits `athleteId`; bench path forces `athleteId: player.id` | Fragile if stale cache serves roster-slot ids | Extend type; prefer `athleteId ?? id`; reject stale mapping when backend flags it | Device + stale-cache fixture | N |

**Stale overlay specifically:** Code at `overlaySnapshotsOnCalendar.ts:55-90` + `liveFixtureStore.ingestSnapshot` finished latch (`:250-252`) + Jest (`overlaySnapshotsOnCalendar.test.ts`) address the known freeze/FT-revive bugs. **No P0 residual proven in production HTTP.** Treat remaining risk as **P2/UNVERIFIED on device**.

### Addendum — parallel subagent merge (2026-10-30)

Merged without re-editing product code. New IDs **MT-13…MT-18** from [Audit Matches frontend](2ba805d2-c439-4fb9-83f3-40f07e209eea) and [Audit Matches backend](1ce5b4c1-7ead-4835-80d7-b5670be8961f), cross-checked against `websocket.service.ts:215–217`, `match-cache.service.ts:449–485`, `liveFixtureSync.ts:121–124`, `football-data-cache.service.ts:221`.

---

## 9. Jest / typecheck (read-only)

```
front: jest overlaySnapshotsOnCalendar | matchesStampede | liveFixtureStore |
       mergeTodayCalendarWithLiveFeed | liveFixtureFreshness
→ 5 suites, 61 tests PASSED (6.1s)
```

`npx tsc --noEmit` (root/front): **not completed in this pass** → **UNVERIFIED**.

---

## 10. Manual device test steps (anything UNVERIFIED)

### Android low-end + iOS

1. **TZ / DST:** Set device to Africa/Cairo. Open Matches for “today”. Confirm a known 23:30 UTC kickoff appears on local calendar day (repeat after forcing TZ to UTC+3 if testable).
2. **Live minute sync:** Open Matches Live filter on a 2H match; note minute. Open Match Details; confirm same minute within 5s; wait for WS tick; both update together.
3. **Stale overlay regression:** Stay on Matches while a match goes HT→2H and FT; force airplane→online; confirm no FT row stuck “live”, no minute freeze behind calendar.
4. **Empty events UX:** Open `4860882`-class live with empty events; confirm waiting/empty copy (not infinite skeleton); pull-to-refresh.
5. **Lineups photos:** Open `4800944` (or top-flight with lineups); confirm headshots load (athleteId URLs); open a fixture with empty lineups — waiting state.
6. **SUSP:** Find suspended match; confirm Live filter labeling “موقوفة/Suspended”; confirm it does **not** appear as a new inject on wrong day.
7. **FlashList stress:** Scroll All tab with many countries expanded on low-end Android; switch Live/Upcoming/Finished pager rapidly; watch for blank list / crash (Sentry).
8. **Stampede:** Favorites with many live matches; open Matches; confirm no UI jank; Charles/proxyman ≤3 concurrent `/details`.
9. **Chat:** Join live chat on a fixture (staging preferred); kill network; reconnect; confirm room rejoin; **do not** spam prod.
10. **Momentum:** Events tab on major league vs lower tier — chart vs hidden empty.

---

## 11. Severity-ranked summary (for release gate)

1. **P1 MT-1 — Empty live events** for a large minority of in-play fixtures (prod measured) → Match Details timeline unreliable.  
2. **P1 MT-2 — Long-lived SUSP in live feed** (streak 275+) → Live count/noise.  
3. **P1 MT-13 — Unauthenticated Socket.IO `subscribe`** on main WS (chat NS OK) → join-spam / replica load risk.  
4. **P1 MT-14 — Unbounded day/season `findMany`** → memory/query risk on heavy calendar days.  
5. **P2** — PST inconsistency (MT-15), FlashList `getItemType` (MT-16), offline empty UX (MT-17), lineup typing (MT-18), plan env warn, JSON/terms log noise, Sentry/DB observability gaps.  
6. **Mitigated / PASS** — Overlay freshness unit tests, list projection contract, athleteId lineups when present, details concurrency gate, leader-lease code, quota remaining 98, no CRASHED deploys, no mobile FlashList Sentry hits, Egypt 23:30 UTC bucketing.

**Release recommendation:** Soft-go for Matches list; **hold hard marketing of “live event timeline”** until MT-1 sampled empty-event rate drops or synthetic goals cover score≠0 gaps. Treat **MT-13** as a short security/ops follow-up before multi-replica load spikes. Re-check after next 365Live cycle with the same 8-fixture events probe.

### Manual tests added from parallel audits

11. **PST:** Open a postponed match — list Finished vs store/details phase must agree after fix (today: expect divergence).  
12. **Airplane mode:** Kill network with empty disk cache — confirm UX (today: generic error/stale only).  
13. **WS subscribe:** Attempt unauthenticated `subscribe` to a match room (staging) — confirm join allowed today (MT-13).
