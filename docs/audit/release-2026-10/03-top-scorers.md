# Phase 1 — Top Scorers (صفحة هدافين) — Pre-release audit

**Date:** 2026-10-30  
**Scope:** Competition-profile “Scorers” tab (365Scores league leaderboards) for Egyptian Premier + Big-5 Europe. Legacy API-Football `/players/top/scorers` traced as secondary/dead UI path.  
**Mode:** READ-ONLY (no source edits, no commit/push).  
**Prod API base:** `https://90plus.pro/api` (`front/app.json` extra.apiUrl L306; `front/config/api.config.ts`).

---

## 0. Feature identity (no assumptions)

| Claim | Evidence |
|---|---|
| Primary in-app “هدافين / scorers” UI for a league is **Competition Profile → Scorers tab** | `front/app/competition-profile.tsx` L38–95, L260–324; default tab `'scorers'` L74 |
| There is **no single screen** with Egypt + all European leagues as peer tabs for season scorers | League open comes from Matches/Search/Favorites → `/competition-profile?id=<365CompetitionId>` (`front/app/(tabs)/matches.tsx` ~L1988; match-details push ~L1691) |
| In-Scorers “tabs” are **stat boards** (Goals / Assists / …), not leagues | `competition-profile.tsx` L268–291 (`boards.map`) |
| Separate product “خماسي الهدافين” (Top Scorers Five) is a **fantasy pick game**, not this feature | `front/app/top-scorers-five/*`; Railway logs flood `/api/top-scorers-five/...` |
| Live backend is repo-root `src/` + `prisma/`, **not** `Backend/` | `Backend/` LastWrite **2026-05-17**, contents only `public/terms.html` (stale stub). `src/` LastWrite **2026-10-30** |

**365 competition IDs under audit (Big-5 + Egypt):** from `src/utils/fixture-importance.ts` L44 (`BIG_5_SCORES365_COMPETITION_IDS = [7,11,17,25,35]`) and `src/services/top-scorers-five-scoring.ts` L50–66 / L61–66:

| Tab / league | 365 competitionId | Synthetic `leagueId` (id+7e6) |
|---|---|---|
| Premier League | 7 | 7000007 |
| La Liga | 11 | 7000011 |
| Serie A | 17 | 7000017 |
| Bundesliga | 25 | 7000025 |
| Ligue 1 | 35 | 7000035 |
| Egyptian Premier | 552 | 7000552 |

---

## 1. File map

### Frontend
| Path | Role |
|---|---|
| `front/app/competition-profile.tsx` | Scorers UI, board chips, rank/photo/name/value |
| `front/services/apiFootball.ts` L907–930, L2995–3005 | `Stat365LeaderRow` / `Competitor365Stats`; `getCompetition365Stats` |
| `front/components/common/CachedAthletePhoto.tsx` L17–54 | Photo + person-icon fallback on error |
| `front/utils/scores365AthletePhoto.ts` | Front URL helpers / `with365ImageSize` |
| `front/components/TeamProfile/OverviewTab.tsx` L217–284 | Club Overview “Top Scorers” (same 365 boards, filtered to club) |
| `front/app/_layout.tsx` L135, L680–688 | `QueryClient` **no persist**; **RTL forced off** |
| `front/services/apiFootball.ts` L3184–3195 | Legacy `getTopScorers` → API-Football (**no UI caller**) |

### Backend (live)
| Path | Role |
|---|---|
| `src/routes/football.routes.ts` L280–283 | `GET /cached/365/competition/:id/stats` + `SHARED_CACHE_5MIN` |
| `src/controllers/football.controller.ts` L3627–3651 | Controller; empty → SUCCESS + `unavailable: true` |
| `src/services/football-data-cache.service.ts` L5050–5054 | Thin wrap → 365 service |
| `src/services/threeSixFiveScores.service.ts` L2450–2479, L2581–2610 | Fetch `/web/stats/`, Redis cache, **`parseAthletesStatsBoards`** |
| `src/utils/scores365-athlete-photo.ts` L8–20 | `Athletes/{athleteId}` photo URL |
| `src/controllers/football.controller.ts` L1227–1253 | Legacy API-Football top scorers (**default season 2024**) |
| `src/services/football-data-cache.service.ts` L311, L4130–4159 | Redis `top_scorers:{top_scorers_{league}_{season}}`, TTL 1h |
| `src/services/chat-agent-tools.service.ts` L1937–1957 | Chat `get_top_scorers` uses API-Football + `resolveFootballSeason()` |

### Models / storage
| Store | Used by competition scorers? |
|---|---|
| Redis key `365:competition:{id}:stats:v2:{langId}` TTL **600_000 ms (10 min)** | Yes (`threeSixFiveScores.service.ts` L2463–2478) |
| HTTP shared cache 5 min (`SHARED_CACHE_5MIN`) | Yes (`football.routes.ts` L25, L281–282) |
| Postgres / Prisma tables for competition stats | **No** — no `cached_365*` tables found on Neon project `Football-app` |
| Front react-query | In-memory only (`QueryClient` in `_layout.tsx` L135); scorers `staleTime` 10 min (`competition-profile.tsx` L92) |

---

## 2. Per-league table

**Prod endpoint (all):** `GET https://90plus.pro/api/football/cached/365/competition/{id}/stats`  
**Cache key:** `365:competition:{id}:stats:v2:{langId}`  
**TTL:** Redis 10 min + CDN/shared HTTP ~5 min  
**Season:** 365 `/web/stats/?competitions=` has **no season query** — upstream current season only (implicit). Europe Oct 2026 ⇒ **2026/27**. Egypt: same implicit “current” campaign (365); no `seasonNum` in Goals board JSON sample (**UNVERIFIED** exact Egyptian label without UI season badge).

| Tab | Comp ID | Season | Endpoint | Cache key | TTL | Live prod sample (top 3) | 365 public SoT top 3 (direct `webws.365scores.com`) | Match? |
|---|---|---|---|---|---|---|---|---|
| Premier League | 7 | current (365) | `.../competition/7/stats` | `365:competition:7:stats:v2:*` | 10m+5m | **empty** `leaderboards:[]`, `unavailable:true`, `source:null` | Haaland 9, Isak 6, João Pedro 5 | **NO** |
| La Liga | 11 | current | `.../11/stats` | `...:11:...` | same | empty / unavailable | Raphinha 13, Mbappé 11, Yassir Zabiri 8 | **NO** |
| Serie A | 17 | current | `.../17/stats` | `...:17:...` | same | empty / unavailable | Raimondo 8, Varela 8, Malen 7 | **NO** |
| Bundesliga | 25 | current | `.../25/stats` | `...:25:...` | same | empty / unavailable | Füllkrug 8, Olise 6, Schick 6 | **NO** |
| Ligue 1 | 35 | current | `.../35/stats` | `...:35:...` | same | empty / unavailable | Lepaul 7, Sinayoko 6, Archer 5 | **NO** |
| Egypt | 552 | current | `.../552/stats` | `...:552:...` | same | empty / unavailable | Mahmoud Mamdouh 8, Hossam Hassan 4, Idrissa Thiam 4 | **NO** |

**Prod raw (PL, 2026-10-30):**  
`{"status":"SUCCESS","source":null,"response":{"competitionId":7,"leaderboards":[]},"_meta":{"competitionId":7,"unavailable":true}}`  
Headers included `x-cache: HIT`, `Cache-Control: public, max-age=…` — empty SUCCESS is CDN-cacheable.

**Profile endpoint still works** (proves IDs + 365 reachability for other paths):  
`GET .../competition/7` → Premier League / England; `.../552` → Premier League / Egypt (`source:365scores`).

**365 SoT shape (critical):** `stats.athletesStats` is now an **object** `{ tables: [...], filters: [...] }`, not an array. Verified via Node parse of live `webws.365scores.com/web/stats/?appTypeId=5&langId=1&timezoneName=UTC&userCountryId=1&competitions={id}` for all six IDs.

---

## 3. Flow trace (UI → render)

1. **UI** `CompetitionProfileScreen` — `front/app/competition-profile.tsx` L59–95  
   - `useQuery` key `['365-competition-stats', competitionId, language]`  
   - `queryFn` → `ApiFootballService.getCompetition365Stats`
2. **API client** `front/services/apiFootball.ts` L2995–3005  
   - `fetchFromProxy('/cached/365/competition/${id}/stats')` → expects `leaderboards` array
3. **Route** `src/routes/football.routes.ts` L280–283  
   - `SHARED_CACHE_5MIN` → `FootballController.getCached365CompetitionStats`
4. **Controller** `src/controllers/football.controller.ts` L3630–3648  
   - On null data: still **200 SUCCESS** with empty boards + `_meta.unavailable`
5. **Cache façade** `football-data-cache.service.ts` L5050–5054
6. **Service** `threeSixFiveScores.service.ts` L2454–2479  
   - Redis get `365:competition:{id}:stats:v2:{langId}`  
   - Else `GET https://webws.365scores.com/web/stats/?{commonParams}&competitions={id}`  
   - `commonParams`: `appTypeId=5&langId=&timezoneName=Africa/Cairo&userCountryId=` (`L4348–4351`)
7. **Parse** `parseAthletesStatsBoards` L2581–2610  
   - **BUG:** treats `athletesStats` as array; object `{tables}` → `!boards.length` true → **returns null**
8. **Photo** L2600: `buildScores365AthletePhotoUrl(r.entity.id, 68)` → `Athletes/{athleteId}` (**correct ID class**; does **not** pass `imageVersion`)
9. **UI state** L263–266: loading spinner **or** empty `cp.noScorers` — **no distinct error branch** (`statsQ.isError` unused)
10. **Render** L294–319: rank=`idx+1`, `CachedAthletePhoto`, name `numberOfLines={1}`, value; **no team name** (shows `positionName`)

---

## 4. DB / Redis checks

| Check | Result | Evidence |
|---|---|---|
| Neon project | `Football-app` (`bitter-butterfly-92483988`) | Neon MCP `list_projects` |
| Tables matching `%365%` | **none** | `information_schema` SELECT |
| `cached_fixtures` row count | **0** | SELECT — Neon DB is empty / not the live match cache (Railway has separate Postgres service `758bb169-…`) |
| Competition stats in Postgres | **N/A** — Redis-only | Code L2463–2478 |
| Redis TTL of live keys | **UNVERIFIED** (no Redis CLI from this session; TTL asserted from code only = 600_000 ms) | — |
| Railway Redis service | Present: `Redis` (`d9cfab4d-…`) in project `superb-passion` | Railway `list-services` |

**Production Postgres on Railway was not queried** (no SQL tunnel in MCP). Marked UNVERIFIED for any DB-backed scorers (none expected).

---

## 5. Railway + Sentry

### Railway (`plugin-railway-railway`)
- Project: **superb-passion** / service **90Plus-app** / env **production**
- Filter `getCompetitionStats|competition-stats`: **0 lines** (16 Oct–30 Oct window)
- Filter `365Scores` (7d): fixtures sync healthy; intermittent **timeouts / fetch failed** on fixtures-page, allscores, search — **no explicit competition-stats errors** (failures likely silent via `return { data: null }` L2480–2485)
- Heavy traffic is **Top Scorers Five** (`/api/top-scorers-five/...`), not competition stats

### Sentry
| Org | Result |
|---|---|
| `mrdev-pk` / `90plus-app` (mobile) | Auth OK. Issue search `competition OR scorers OR leaderboard OR athlete OR 365` → **no hits**. Unresolved 14d issues are generic ANR/auth/native — **not scorers-specific** |
| `90plus` / `90plus-backend` | **UNVERIFIED** — `find_organizations` only returned `mrdev-pk`; backend org not in MCP token scope |

---

## 6. Edge-case checklist

| Item | Result | Evidence |
|---|---|---|
| Correct competition IDs (Big-5 + Egypt) | **PASS** (IDs) | Profile prod + TSF config; stats empty for other reasons |
| Current Europe season 2026/27 via 365 | **PASS** (SoT goals plausible mid-autumn) | Direct 365 PL Haaland=9 etc.; no season param |
| Egyptian season convention labeled in UI | **FAIL / missing** | No season badge in `competition-profile.tsx`; 365 implicit only |
| Photos use athleteId not lineup/roster slot | **PASS** (when parsed) | Parser L2598–2600 `entity.id`; URL `Athletes/{id}`; HEAD Haaland/Egypt photos HTTP 200 |
| Team shown on scorer row | **FAIL** | UI shows `positionName`, not club (`L312–316`); entity has `competitorId` only |
| Ordering by goals | **PASS** (SoT tables ordered) | 365 Goals table order |
| Tie / shared rank | **FAIL** | UI `idx+1` L302; 365 `position` often **0** for all rows; João Pedro & Tavernier both 5 goals would display 3 & 4 |
| Pagination / limit | **PASS (by design)** | Backend maxRows 15 L2473–2474; UI `.slice(0, 15)` L132 |
| Empty state | **PASS** (copy) | L265–266 `cp.noScorers` — but currently **false empty** for all leagues (parser) |
| Loading state | **PASS** | L263–264 `ActivityIndicator` |
| Distinct error state | **FAIL** | No `statsQ.isError` UI; null/fail ≡ empty |
| Offline / persisted stale cache | **FAIL** | No PersistQueryClient; RQ memory-only (`_layout.tsx` L135) |
| RTL layout | **PARTIAL / FAIL vs Arabic UX** | App **disables RTL** `_layout.tsx` L680–688; scorer row hard `flexDirection:'row'` L552–559; back chevron always `chevron-back` L182 |
| Long name truncation | **PASS** | `numberOfLines={1}` L309 |
| Missing image fallback | **PASS** | `CachedAthletePhoto.tsx` L24–54 Ionicons `person` |
| Front↔back contract field names | **PASS** | `Stat365LeaderRow` ↔ mapped fields athleteId/name/photo/value/competitorId/leftClub/positionName |
| Nullability when unavailable | **PASS (typed empty)** | Controller returns empty arrays; front treats missing as [] |
| Legacy API-Football default season | **FAIL** | Controller L1237 default **2024**; front client L3185 default **2024**; Oct 2026 needs **2026**. Prod `?league=39` and `?season=2026` both returned `results:0` (quota/empty — do not burn more) |
| `Backend/` live? | **FAIL (stale)** | See §0 |

---

## 7. Findings

| ID | Severity | Evidence | Root cause | Proposed minimal fix | Needs | Schema/auth? |
|---|---|---|---|---|---|---|
| **TS-1** | **P0** | Prod all 6 leagues `leaderboards:[]` + `unavailable:true`; 365 SoT has 16 tables each; `athletesStats` shape=`{tables,filters}` | `parseAthletesStatsBoards` assumes array (`L2586–2587`); object has no `.length` → null | Normalize: `const raw=…athletesStats; const boards=Array.isArray(raw)?raw:(raw?.tables??[])` | Unit test both shapes; redeploy; purge Redis `365:competition:*:stats:v2:*` + CDN | N |
| **TS-2** | **P1** | Empty SUCCESS + `SHARED_CACHE_5MIN` + observed `x-cache: HIT` | Empty miss cached as success at Redis (10m) and HTTP (5m) | Do not Redis-set null/empty soft-fail; or short TTL / `Cache-Control: no-store` on unavailable; after TS-1 flush caches | Ops flush | N |
| **TS-3** | **P1** | `competition-profile` L263–266 | Error and empty identical | Branch `statsQ.isError` / `_meta.unavailable` with retry CTA | Copy keys | N |
| **TS-4** | **P2** | L302 `idx+1`; 365 `position===0`; tied goals | No dense/shared rank | Compute rank from sorted goals (share rank on ties) using `row.value` | — | N |
| **TS-5** | **P2** | Scorer row has no club; `competitorId` unused in UI | Product omission | Resolve competitor name/logo (catalog map or extend parser) | Optional 365 competitor lookup | N |
| **TS-6** | **P2** | Photo builder omits `entity.imageVersion` L2600 | May serve stale/default CDN variant | Pass `r.entity?.imageVersion` into `buildScores365AthletePhotoUrl` | — | N |
| **TS-7** | **P2** | Controller L1237 / front L3185 default season **2024**; chat uses `resolveFootballSeason()` correctly | Dead UI path still public; wrong default | Default to `resolveFootballSeason()`; align front | Avoid quota burn in QA | N |
| **TS-8** | **P3** | `_layout` force LTR; scorer styles LTR | Arabic scorers stay LTR | Align with product RTL policy (textAlign end for ar) | Design | N |
| **TS-9** | **P3** | Neon `cached_fixtures` count 0 | Neon MCP DB ≠ Railway prod Postgres (or wiped) | Confirm which DB prod uses; don’t rely on Neon for match cache audits | Railway Postgres read-only | N |
| **TS-10** | **P3** | Sentry org `90plus` missing from MCP | Auth scope | Re-auth Sentry with backend org | — | N |

---

## 8. Contract summary (front types vs backend)

| Field | Backend map | Front `Stat365LeaderRow` | Notes |
|---|---|---|---|
| `athleteId` | `entity.id` | required number | Filtered `> 0` |
| `name` | `entity.name` | string | |
| `photo` | `Athletes/{id}` | `string \| null` | athleteId-based ✅ |
| `value` | `stats[0].value` string | string | Goals as `"9"` |
| `rank` | `position` | number | Often **0** upstream |
| `competitorId` | entity | `number \| null` | Not rendered |
| `leftClub` | `isLeftClub` | boolean | Competition list rarely uses |
| `positionName` | entity | optional | Shown instead of team |

---

## 9. Manual device test steps (UNVERIFIED / post-fix)

1. After TS-1 deploy: open Competition Profile for PL (id=7), La Liga (11), Serie A (17), Bundesliga (25), Ligue 1 (35), Egypt (552). Confirm Goals board top 3 match 365 app / web.
2. Airplane mode after warm cache: confirm behavior (expect empty after process death — no MMKV persist).
3. Force bad photo URL / offline image: confirm person fallback (`CachedAthletePhoto`).
4. Arabic locale: confirm truncation + readable row (LTR policy).
5. Two players same goals: confirm shared rank if TS-4 shipped.
6. Chat “هداف الدوري الإنجليزي”: confirm season=2026 after TS-7 (1 API-Football call only).

---

## 10. Tooling notes

- `curl.exe` prod GETs only; 365 public GETs for SoT; photo HEAD checks 200.
- API-Football scorers: 2 GETs (default + season=2026) both empty — **stop** further quota use.
- `npx tsc` / jest: **not run** this phase (parser bug proven by live shape + code path; recommend targeted unit test in Phase 2).
- Temp SoT JSON files deleted after analysis; claims reproduced via commands above.

---

## 11. Verdict

**Ship-blocker:** **TS-1** — competition Top Scorers page is **empty in production for every audited league** while 365Scores still returns full Goals tables. Root cause is **response-shape drift** in `parseAthletesStatsBoards`. Fix + cache purge required before release.
