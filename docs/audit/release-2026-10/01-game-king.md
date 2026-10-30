# Release audit Phase 1 — ملك اللعبة (Game King)

**Date:** 2026-10-30 (~16:00–16:15 UTC)  
**Mode:** READ-ONLY (no app source edits, no commits, no production writes).  
**Deploy under test:** Railway service `90Plus-app` (`af575ddb-…`), env `production`, latest deploy SUCCESS; `/api/health` → `git: 277f632aed21`, `schema.ok: true`, `database: Connected`.  
**API base:** `https://90plus.pro/api` (`front/app.json` extra.apiUrl).  
**Prior docs (re-verified, not trusted):** `docs/audit/king-of-predictions-audit.md`, `king-closure-round2.md`, `king-of-predictions-closure-report.md`.  
**Scope note:** ملك المدربين (Coach King) is out of scope except shared UI atoms (`KingEmptyState`, `KingPeriodTabs`, `KING_ICON`).

---

## 1. Feature identification

**ملك اللعبة** is **King of Predictions — Game mode** (winner pick: home / draw / away).

| Layer | Mapping | Evidence |
|-------|---------|----------|
| Arabic copy | `hubGameTitle` / `gameTitle` = `'ملك اللعبة'` | `front/locales/ar.ts:1215–1220` |
| English | Hub card → Game; rank tab still labels competition `kingOfPredictions` as “King of Predictions” / “ملك التوقعات” | `front/locales/en.ts` (~2088); `ar.ts:2043–2044` |
| Route mode | UI `KingRouteMode = 'game' \| 'results'` | `front/components/KingOfPredictions/shared.ts:15–18` |
| API mode | `toApiMode('game') → 'winner'`; `'results' → 'exact'` | `shared.ts:17–18` |
| Screens | Hub → Week → Play / Leaderboard under `/king-of-predictions/*` | `front/app/king-of-predictions/*`, `front/app/_layout.tsx:384–387` |
| Sibling | **ملك النتائج** = exact scoreline mode (`results` / `exact`) — same backend tables/routes, different mode filter | Hub second card `HubScreen.tsx:46–54` |

**Not:** daily quiz, XP-ranked quiz, or ملك المدربين.

**`Backend/` folder:** present but **stale** — only `public/terms.html`. Live API is repo-root `src/` on Railway.

---

## 2. File map

### Frontend (`front/`)

| Path | Role |
|------|------|
| `app/king-of-predictions/index.tsx` | Hub route → `KingHubScreen` |
| `app/king-of-predictions/week.tsx` | Week strip + board preview |
| `app/king-of-predictions/play.tsx` | Match list + submit sheet |
| `app/king-of-predictions/leaderboard.tsx` | Full board |
| `components/KingOfPredictions/HubScreen.tsx` | Mode picker (game/results) |
| `components/KingOfPredictions/WeekScreen.tsx` | Calendar, CTA, preview board |
| `components/KingOfPredictions/PlayScreen.tsx` | Optimistic submit |
| `components/KingOfPredictions/LeaderboardScreen.tsx` | Period tabs + list |
| `components/KingOfPredictions/HistoryList.tsx` | Weekly history |
| `components/KingOfPredictions/kingPicksStore.ts` | Persist + optimistic picks |
| `components/KingOfPredictions/shared.ts` | Mode/calendar/fetch helpers |
| `services/predictions.service.ts` | HTTP client |

### Backend (repo root `src/`)

| Path | Role |
|------|------|
| `routes/predictions.routes.ts` | `POST /`, `POST /submit`, `GET /king/matches`, `GET /king/history`, `GET /leaderboard?mode=winner\|exact` |
| `services/king-prediction.service.ts` | Upsert, daily slot, leaderboard, history |
| `services/king-prediction-rules.ts` | Cairo day/week, server fixture lock |
| `services/prediction-resolver.service.ts` | Settle + XP/coins |
| `services/prediction-settlement-gate.ts` | `judgePrediction` (server score) |
| `services/prediction-void.service.ts` | PST/ABD/CANC void (flag-gated) |
| `services/prediction-watcher.service.ts` | Poll finished matches |
| `middleware/rateLimit.middleware.ts` | `predictionWriteLimiter` (30/min) |
| `services/xp.service.ts` | `PREDICTION_WINNER = 1` XP |

### Prisma

| Model / table | Notes |
|---------------|-------|
| `Prediction` → `predictions` | `@@unique([userId, apiMatchId])`, `@@unique([userId, canonicalFixtureKey])`, settle + void columns |
| `PredictionDailyCounter` → `prediction_daily_counters` | Atomic daily quota |
| `SettleLease` → `settle_leases` | Per-match settle lock |
| `PredictionResettleRun/Item` | Admin re-settle audit (0 runs in prod) |

---

## 3. Flow traces (file:line per hop)

### A — Start game (open ملك اللعبة → today’s matches)

1. **UI:** Hub CTA `open('game')` → `/king-of-predictions/week?mode=game` — `HubScreen.tsx:26–44`  
2. **Week load:** `fetchKingMatches(selectedKey)` — `WeekScreen.tsx:105–106` → `shared.ts:67–74`  
3. **API client:** `GET ${API_URL}/predictions/king/matches?date=` — `predictions.service.ts:420–439`  
4. **Route:** `GET /king/matches` (no auth) — `predictions.routes.ts:896–910`  
5. **Service:** `getKingDailyMatches` — top 10, secondary leagues filtered, kickoff-stable list — `king-prediction.service.ts:82–105`  
6. **Calendar:** response adds `serverDayCairo` + `weekBounds.days` (Cairo Sun–Sat) — routes `:901–905`; client binds calendar — `WeekScreen.tsx:111–116`  
7. **Play:** CTA → `/play?mode=game&date=` — `WeekScreen.tsx:172–176`  
8. **Hydrate picks:** `getToken` → `GET /predictions/user?matchIds=` — `PlayScreen.tsx:138–143` → service `:245–264` → `requireAuth` + cache middleware routes `:289+`

### B — Answer / submit (winner pick)

1. **UI sheet:** pick home/draw/away → `confirmSheet` — `PlayScreen.tsx:202–264`  
2. **Optimistic store:** `begin` local pick — `kingPicksStore.ts:147–151`  
3. **Auth:** `getToken()` once; null → `E002` — `PlayScreen.tsx:244–245`  
4. **Client:** `POST /predictions` body `{ apiMatchId, predictionType, … }` **no client score** — `predictions.service.ts:215–222`; `PlayScreen.tsx:246–252`  
5. **Middleware:** `requireAuth` + `predictionWriteLimiter` — routes `:168`  
6. **Validation:** `predictionType ∈ {home,draw,away}` — routes `:216–228`  
7. **Service:** `upsertKingPrediction` — user from Clerk id; **kickoff from server fixture, client `matchDate` ignored** — `king-prediction.service.ts:146–147`, comment `:146`  
8. **Lock:** `lockVerdict(fixture)` — `king-prediction-rules.ts:122–133`  
9. **Daily quota:** `claimDailySlot` atomic SQL — service `:238–258`  
10. **DB:** create/update `predictions`; unique constraints — schema `:1599–1600`  
11. **Response DTO:** `toPredictionDto` (no `settled*`) — routes `:62–79`, `:267–276`  
12. **UI settle:** `confirm` or `revert` / `settleUncertainSave` on non-4xx — `PlayScreen.tsx:253–262`, store `:199–229`

### C — Server-side score (client cannot forge correctness)

1. Watcher/resolver loads authoritative snapshot under settle lease — `prediction-resolver.service.ts:147–171`  
2. Gate rejects non-settleable statuses — metrics/logs `SETTLE_GATE_REJECTED`  
3. Correctness: `judgePrediction` → winner compare **or** exact scoreline — `prediction-settlement-gate.ts:179–188`  
4. Persist: `updateMany … where isCorrect: null` + `settledHomeScore/Away/Status/Winner` — resolver `:265–276`  
5. XP: inline `xpTransaction` key `prediction:{id}` then `awardXp` same key — resolver `:302–364`; `XP_VALUES.PREDICTION_WINNER = 1` — `xp.service.ts:22–53`  
6. Coins: key `prediction:{id}:coins` — resolver `:281–299`  
7. **Client never sends `isCorrect` or XP.** Forging a high score is not possible via submit body.

### D — Leaderboard / winner

1. **UI:** `getKingLeaderboard(token, 'winner', period)` — `LeaderboardScreen.tsx:33–40`; Week preview `:127–129`  
2. **Route:** `GET /leaderboard?mode=winner&period=week|all` requires auth — routes `:941–961`  
3. **Agg:** correct rows with `predictedHomeScore: null` (winner mode), week via `kingWeekWhere` — `king-prediction.service.ts:291–388`, `modeWhere` `:418–421`  
4. **Points:** `+ WINNER_XP` (1) per correct row — `:334–351`  
5. **Sort / ties:** `b.xp - a.xp || a.userId.localeCompare(b.userId)` then `rank: index + 1` — `:354–372` → equal XP get **distinct ranks** (userId order), not shared place  
6. **Empty:** `entries.length === 0` → `KingEmptyState` “لا يوجد فائزين بعد” — `LeaderboardScreen.tsx:80–89`  
7. **User with no data:** `me.rank = null`, `me.xp = 0` when no correct rows — service `:358–359`; Week shows `—` — `WeekScreen.tsx:189–191`

### E — History

1. `GET /king/history?mode=winner&status=&page=` + auth — routes `:917–930`  
2. Week-scoped same predicate as board — service `:448–455`  
3. Settled display prefers `settled*` over cache — `:492–510`  
4. Token gap: keep rows + retry 3s (D2 fix) — `HistoryList.tsx:112–123`

---

## 4. Real endpoint tests

Base: `https://90plus.pro/api`. Tool: `curl.exe`.

### 4.1 `GET /health` → **200**

Excerpt (verified 2026-10-30T16:07Z):

```json
{
  "status": "OK",
  "schema": { "checked": true, "ok": true, "pendingMigrations": [], "missingColumns": [] },
  "settlement": {
    "pendingCount": 242,
    "oldestSettleablePendingAgeMin": null,
    "settleablePendingMatches": 0,
    "lastSettleAt": "2026-10-30T14:18:12.911Z",
    "today": {
      "VOID_CANDIDATE": 290,
      "GATE_STATUS_NOT_SETTLEABLE": 1200,
      "SETTLE_GATE_REJECTED": 1200,
      "SETTLE_SOURCE_CONFLICT": 141,
      "SETTLE_COMPLETE": 7,
      "ROWS_SETTLED": 2
    }
  },
  "git": "277f632aed21"
}
```

**Re-verify vs prior U1:** column-missing outage is **closed** (`schema.ok`, migrations finished — see DB §5).

### 4.2 `GET /predictions/king/matches?date=2026-10-30` → **200**

- `success: true`, `data.length = 10`, includes live (`2H`/`HT`) and `NS` fixtures.  
- `serverDayCairo: "2026-10-30"`.  
- `weekBounds.days`: `2026-10-25` … `2026-10-31`.  
- Sample ids: `4675434`, `4804725`, `4735221` (Nice–Rennes), …

### 4.3 `GET /predictions/king/matches?date=2099-01-01` → **200**

`data: []` + same calendar metadata (empty-day OK).

### 4.4 `GET /predictions/leaderboard?mode=winner&period=week&limit=5` (no/invalid token) → **401**

`{"status":"ERROR","message":"Unauthorized - Invalid token"}`  
**UNVERIFIED (auth body):** need Clerk test token for success shape / ranking numbers.

### 4.5 `GET /predictions/king/history?mode=winner&status=all&page=0` (no token) → **401**

Same unauthorized shape.

### 4.6 Mutating `POST /predictions` / double-submit

**Not executed** against production (no junk data). Expected from code:

- Auth required; limiter 30/min.  
- Idempotent **update** path if row exists and unlocked.  
- Concurrent **create** on same `(userId, apiMatchId)`: Prisma `P2002` only remapped for `canonicalFixtureKey` → other unique violations bubble to **500** — `king-prediction.service.ts:224–228`.

Railway HTTP (read): many `POST /api/predictions → 200`; at least one `→ 429` (2026-10-30T13:00:20Z); sporadic `→ 401`.

---

## 5. DB / Redis checks

### 5.1 Neon MCP (`user-Neon` project `bitter-butterfly-92483988`)

**Not production.** `predictions` lacks `settledHomeScore` / `voidedAt` / `canonicalFixtureKey`; no `prediction_daily_counters`. Do **not** use for release sign-off.

### 5.2 Production Postgres (local `.env` `DATABASE_URL` → same host as Railway; session `SET default_transaction_read_only = on`)

| Check | Result |
|-------|--------|
| Columns `settledHomeScore`, `settledStatus`, `voidedAt`, `canonicalFixtureKey` | **present** |
| Tables `prediction_daily_counters`, `settle_leases`, `prediction_resettle_runs` | **present** |
| Migrations `20261030120000_prediction_settle_audit` … `20261031120000_prediction_resettle_audit` | **finished** (latest resettle `2026-10-30T09:01:22Z`) |
| Totals | total **3361**; winner_mode **2123**; exact **1238**; pending **242**; voided **0** |
| Correct winner / exact | **958** / **110** |
| `settledHomeScore IS NOT NULL` | **3** |
| `resolvedAt` set but no `settledHomeScore` | **3116** (legacy pre-audit) |
| `max(settledAt)` | **2026-10-30T14:18:12.911Z** (= health `lastSettleAt`) |
| `resettledAt` / `prediction_resettle_runs` | **0** / **0** |
| Week winner correct (Cairo week bounds from API) | **418** rows, **63** users |
| Tie buckets (same win count) | e.g. xp=14→2 users, 12→2, 10→3, … |
| Top week winner (wins) | `user_qSaxiCIS` 25, `user_UMgI4Fsj` 19, `egyptianking` 17, … |
| `matchDate` null | **0** |
| Daily counters Cairo `2026-10-30` | **22** users, **167** slots claimed |
| Stuck PST/ABD pending (join cache) | 4817278 PST×2, 4856787 PST×2, 4856792 PST×2, **4870902 ABD×2**, 4750833 ABD×1, … |
| Stale NS pending (>2d) | **14** (matches prior round-2) |
| `xp_transactions` keys `prediction:%` | **1064** |
| `coin_transactions` keys `prediction:%` | **0** |

### 5.3 Redis

Railway Redis service present; health `providers.apiFootball.redisAvailable: true`. Settle lease / rate-limit stores used in code. **No direct Redis SCAN** this pass → lease key contents **UNVERIFIED**.

### 5.4 Void flag

`PREDICTION_VOID_ENABLED` **absent** from Railway variable **names** for `90Plus-app` (120 vars listed). Code defaults off → dry-run `VOID_CANDIDATE` only — `prediction-void.service.ts:17–18,48–65`. Matches `voided=0` + health `VOID_CANDIDATE:290`.

---

## 6. Railway + Sentry

### Railway (`plugin-railway-railway`)

- Project `superb-passion` / service `90Plus-app`.  
- Deploy logs (filter `SETTLE_`): continuous `SETTLE_GATE_REJECTED` for **PST** / **ABD**; repeated `SETTLE_SOURCE_CONFLICT` apiMatchId **4870902** (`cachedStatus=ABD`, `providerStatus=FT`).  
- HTTP: king/leaderboard mostly 200/304; **401** on leaderboard at 15:47 / 16:07–16:08Z; POST predictions 429 observed.  
- No `settledHomeScore does not exist` in the sampled window (U1 cleared).

### Sentry

| Org | Access | Finding |
|-----|--------|---------|
| `mrdev-pk` / `90plus-app` (mobile) | OK (`regionUrl` de) | No issues matching king/prediction/kingPicks (14d). Unrelated top issues: SecureStore, Clerk session, ANRs. Auth noise: `Unable to authenticate the request…` (90PLUS-APP-25 / 2G) — **not proven** King-specific. |
| Backend org `90plus` / `90plus-backend` | **UNVERIFIED** — MCP `find_organizations` returned **only** `mrdev-pk`. Cross-check: Railway settle logs above. |

---

## 7. Tests / typecheck (read-only)

| Check | Result |
|-------|--------|
| Root `npx tsc --noEmit` | **exit 0** |
| Front `npx tsc --noEmit` | **exit 1** — errors in push channels, i18n, unrelated utils/tests (none clearly in `KingOfPredictions/`) |
| Jest backend: `king-prediction.lock`, `king-prediction-rules`, `prediction-void`, `cairo-week`, `daily-limit.concurrency` | **4 suites passed / 1 skipped; 35 passed / 2 skipped** |
| Jest front: `kingCalendar`, `kingPicksStore` | **17 passed** |
| `historyList.render.test.tsx` | **Not run** — excluded by `testPathIgnorePatterns: .render.test.tsx$` |

---

## 8. Edge-case checklist

| Item | Verdict | Evidence |
|------|---------|----------|
| Start game (hub→week→matches) | **PASS** | Live GET matches 200 + 10 fixtures; UI flow cited |
| Answer/submit winner pick | **UNVERIFIED** (live POST) | Code path complete; HTTP 200s in Railway; need signed-in device |
| Server-side score (no client forge) | **PASS** | Gate + resolver; client sends pick only |
| Leaderboard correctness (mode=winner) | **PASS** (code+SQL) / **UNVERIFIED** (HTTP body) | Agg + week SQL top users; GET needs token |
| Ties | **PASS with product caveat** | Stable `userId` tie-break; ranks not shared — service `:356–372`; SQL shows many tie buckets |
| Empty board | **PASS** | EmptyState when `entries.length===0` |
| User with no data | **PASS** | `me.rank=null`, `xp=0`; Week `—` |
| Double-submit / idempotent update | **PASS** (update path) | Existing row update in txn |
| Concurrent create race | **FAIL** | `P2002` only handled for `canonicalFixtureKey` → likely 500 |
| XP idempotency | **PASS** (code + DB) | 1064 `prediction:%` XP keys |
| Coin idempotency keys in prod | **FAIL / latent** | Code writes `prediction:{id}:coins`; DB count **0** |
| Auth expiry mid-game | **FAIL (degraded)** | No 401→refresh→retry in `PredictionsService`; one-shot `getToken`; 401s in Railway |
| Token gap on history | **PASS** | Retry keep rows `HistoryList.tsx:112–123` |
| King/winner determination | **PASS** (algorithm) | XP sum + sort; prize UI is rank 1 |
| UI reflects server state | **PASS** (intended) | Optimistic + hydrate + uncertain settle; persist store |
| Daily limit race | **PASS** (code+test) | `claimDailySlot` + concurrency test suite |
| Kickoff lock server-authoritative | **PASS** | `resolveServerFixture` / ignore client date |
| PST/ABD pending forever | **FAIL** | Void flag off; DB stuck rows; logs |
| Source conflict 4870902 | **FAIL** | Railway loop; 2 pending ABD |
| Legacy wrong settlements (A7) | **FAIL (open)** | `resettle_runs=0`; prior reconcile counts not re-run this pass → treat as still open |
| Contract field names | **PASS** with notes | Leaderboard/history types align; `Prediction.apiMatchId` typed `string` in client vs Int in DTO |
| Pagination history | **PASS** | `page` + `hasMore` limit 20 |
| Error shapes | **PASS** | `sendError` → `{ error, message, details? }`; client `_parseError` |
| Rate limit | **PASS (observed)** | 429 in HTTP logs; limiter 30/min |
| Redis settle lock live | **UNVERIFIED** | No SCAN |

---

## 9. Findings table

| ID | Sev | Evidence | Root cause | Minimal fix | Needs | DB/auth? |
|----|-----|----------|------------|-------------|-------|----------|
| GK-1 | **P1** | Void service `:17–65`; Railway vars lack `PREDICTION_VOID_ENABLED`; DB `voided=0`; stuck PST/ABD SQL; health `VOID_CANDIDATE:290` | Void dry-run only → cancelled/postponed picks stay “pending” forever | Product decision: enable flag **or** surface void UI without writing; then enable after 48h rule | Railway env (± OTA if copy) | Y (env); write if enable |
| GK-2 | **P1** | Logs `SETTLE_SOURCE_CONFLICT` 4870902 ABD vs FT; 2 pending | Cache/provider disagree; gate keeps ABD | Refresh/reconcile cache status for that fixture; settle or void under lock | Backend deploy | N (data fix) |
| GK-3 | **P1** | Prior closure: 53 wrongToCorrect; this pass `resettle_runs=0`, `resettled=0` | First settle stuck; no applied re-settle | Admin dry-run then `dryRun=0` for wrongToCorrect-only per policy | Backend + ops | Y (writes) |
| GK-4 | **P1** | `coin_transactions` `prediction:%` = **0** while XP keys = 1064; resolver `:281–299` | Coin idempotency never observed in prod (reward path unused, failing, or predated) | Confirm `CORRECT_PREDICTION_REWARD` path on next correct settle; alert if create skips | Backend observe | N |
| GK-5 | **P1** | `PredictionsService` raw `fetch` + token arg; no 401 retry; Railway leaderboard/POST 401 | Expired/missing bearer mid-session | On 401: `getToken({ skipCache: true })` once and retry; map to soft error | OTA | N |
| GK-6 | **P2** | `upsert` catch only canonical `P2002` `:224–228` | Concurrent first-create → uncaught unique → 500 | Catch `userId_apiMatchId` P2002 → treat as update or return CONFLICT | Backend deploy | N |
| GK-7 | **P2** | Leaderboard `:356–372`; SQL tie buckets | Equal XP → arbitrary better rank via `userId` | Document rule **or** shared ranks / earliest correct tie-break for prize | Backend (± OTA copy) | N |
| GK-8 | **P2** | Health `SETTLE_GATE_REJECTED:1200` mostly PST; stale NS=14 | Watcher spins non-settleable; stale NS outside sweep window (prior) | Backoff PST/ABD; expand stale-NS sweep or void | Backend | N |
| GK-9 | **P2** | `settledHomeScore` only **3** vs 3116 resolved without audit | Legacy rows; history falls back to cache (E10 mitigated for new) | Accept for old; ensure new settles always write audit (monitor `ROWS_SETTLED` vs column fill) | Observe | N |
| GK-10 | **P3** | Front `Prediction.apiMatchId: string` vs DTO number | Type drift | Align to `number` | OTA | N |
| GK-11 | **P3** | Neon MCP ≠ prod | Wrong project linked | Point audit tooling at Railway Postgres | Ops | N |
| GK-12 | **Info** | Prior U1 | Missing columns | **CLOSED** — schema.ok + migrations + health | — | — |

**Prior B1 (client matchDate forge kickoff):** code now ignores client date (`king-prediction.service.ts:146–147`). Treat as **CLOSED in code**; live exploit **UNVERIFIED** (would need authenticated POST after kickoff with forged date).

---

## 10. Manual device test steps (anything UNVERIFIED)

### iOS + Android (signed-in test account)

1. **Start:** Rank/Hub → ملك اللعبة → confirm today’s 10 matches match `GET /king/matches?date=<cairoToday>`.  
2. **Submit:** Pick winner on an NS match → toast → kill app → reopen → pick still present (store persist + GET user).  
3. **Edit before kickoff:** Change pick → 200 `updated:true`.  
4. **After kickoff:** Try edit → expect CONFLICT / “started” toast (server).  
5. **Daily limit:** 10 new creates → 11th → limit error (`E006` / `DAILY_LIMIT_REACHED`).  
6. **Double-tap confirm:** One row in DB; UI stable.  
7. **Airplane mode submit:** Optimistic then revert or uncertain reconcile.  
8. **Auth:** Background until session stale → submit + open board; confirm refresh or clear error (GK-5).  
9. **Board:** Week / all-time; your XP = count of correct winner picks × 1; empty week → empty art.  
10. **History filters:** all / correct / wrong / pending; void label if any voided (currently none).  
11. **Cross-mode:** Pick on ملك النتائج must not wipe ملك اللعبة history cards.  
12. **Live match on list:** Confirm locked CTA; cannot submit.

### Ops / backend (not on device)

1. Inspect fixture **4870902** cache vs 365; resolve conflict.  
2. Decide `PREDICTION_VOID_ENABLED`.  
3. Dry-run `POST /predictions/admin/resettle/:matchId` for known wrongToCorrect sample.  
4. After next correct settle: SQL check `coin_transactions.idempotencyKey = 'prediction:{id}:coins'`.

---

## 11. Release verdict (Game King only)

**Ship-critical for ملك اللعبة play loop (start → pick → lock):** largely **code-ready**; live GET matches + schema OK; kickoff/XP server-side OK.

**Not clean for competitive integrity / pending UX:** void disabled (GK-1), source-conflict loop (GK-2), unrepaired legacy settlements (GK-3), auth 401 UX (GK-5), coin idempotency never observed (GK-4).

**Recommended before calling the feature “release-clean”:** fix or explicitly accept GK-1–GK-3; ship OTA for GK-5 if session 401s reproduce on device; monitor next `SETTLE_COMPLETE` with correct rows for GK-4/GK-9.
