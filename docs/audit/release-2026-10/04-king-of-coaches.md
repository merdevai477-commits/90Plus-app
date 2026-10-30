# Phase 1 pre-release audit — ملك المدربين (King of Coaches)

**Date:** 2026-10-30  
**Scope:** King of Coaches only (King of Predictions excluded except shared-code notes)  
**Mode:** READ-ONLY (no source edits, no commits, no prod writes)  
**Prod API base:** `https://90plus.pro/api` (`front/app.json` extra.apiUrl; `front/.env.production` `EXPO_PUBLIC_API_URL`)  
**Prod deploy git (health):** `277f632aed21` — matches Rank CTA polish commits  
**Live backend path:** repo-root `src/` + `prisma/` (Railway service `90Plus-app`)  
**`Backend/` folder:** STALE — only `public/`, `terms.html` (last write ~2026-05-17); not the live API

---

## 1. File map

### Frontend (`front/`)

| Path | Role |
|------|------|
| `front/app/(tabs)/rank.tsx` | Rank tab; mounts `CoachKingSection`, `onStart` → `/coach-king` |
| `front/components/rank/CoachKingSection.tsx` | Landing: Coach of the Week + jersey promo + start CTA |
| `front/components/rank/CoachKingIcons.tsx` | CTA arrow icon |
| `front/app/coach-king/index.tsx` | Route → `CoachKingScreen` |
| `front/app/coach-king/opponent/[userId].tsx` | Opponent squad route (wired in `_layout.tsx`) |
| `front/app/_layout.tsx:392-393` | Stack screens for coach-king |
| `front/components/coach-king/CoachKingScreen.tsx` | Main flow: home load, pick, tabs (pitch/ranking/matches) |
| `front/components/coach-king/CoachKingPitch.tsx` | Formation pitch + coach bar; null photo → placeholder |
| `front/components/coach-king/CoachKingCardGrid.tsx` | Pool picker + confirm sheet |
| `front/components/coach-king/CoachKingBoard.tsx` | Leaderboard UI + empty state |
| `front/components/coach-king/CoachKingMatches.tsx` | Fixture cards |
| `front/components/coach-king/CoachKingNav.tsx` | Bottom tabs |
| `front/components/coach-king/CoachKingLockedSheet.tsx` | Locked-pick sheet |
| `front/components/coach-king/CoachKingOpponentScreen.tsx` | Read-only opponent view |
| `front/components/coach-king/CoachKingLeagueChips.tsx` / `CoachKingCoin.tsx` | Filters / money display |
| `front/services/coachKing.service.ts` | API client, types, pool cache, slot-accept rules (duplicated vs server) |
| `front/locales/ar.ts` / `en.ts` | `rank.coachKing`, `coachKingGame` copy |

### Backend (repo root)

| Path | Role |
|------|------|
| `src/routes/coach-king.routes.ts` | Express routes under `/api/coach-king` |
| `src/services/coach-king.service.ts` | Wallet, gameweek, picks, home DTO, leaderboard, schema bootstrap, settle/reset |
| `src/services/coach-king-scoring.ts` | Pure rules: slots, budget, points, 365 stat extract |
| `src/services/coach-king-pricing.ts` | Player/coach price ladder |
| `src/services/coach-king-pool.service.ts` | Pool sync from 365 / big-five clubs |
| `src/services/coach-king-processing.service.ts` | 10‑min processor: fixtures, score, settle |
| `src/services/top-scorers-five-scoring.ts` | **SHARED** `tsfGameweekWindow`, fixture status helpers |
| `src/main.ts:483` | Mount routes; `:992-995` start processor |
| `src/middleware/clerk.middleware.ts` | `requireAuth` on all CK routes |
| `prisma/schema.prisma:3226-3418` | CK models/enums |
| `prisma/migrations/20261026030000_coach_king/` | Base tables |
| `prisma/migrations/20261026160000_coach_king_slot_lock/` | `lockedAt` / price lock columns |
| `src/services/__tests__/coach-king-scoring.test.ts` | Unit tests (PASS) |
| `src/services/__tests__/coach-king-pricing.test.ts` | Unit tests (PASS) |
| `scripts/ck-health-check.ts` | Offline health script (not run against prod in this audit) |

### Prisma models (authoritative)

`CoachKingPlayer`, `CoachKingCoach`, `CoachKingWallet`, `CoachKingGameweek`, `CoachKingFixture`, `CoachKingSquad` (`@@unique([userId, gameweekId])`), `CoachKingSquadSlot` (`@@unique([squadId, slotKey])`), `CoachKingPerformance` (`@@unique([gameweekId, playerId, fixtureId])`), `CoachKingCoachScore` (`@@unique([gameweekId, coachId, fixtureId])`).

Enums: `CoachKingLine` (GK/DEF/MID/FWD), `CoachKingGameweekStatus` (OPEN/LOCKED/LIVE/CALCULATING/COMPLETED).

---

## 2. Flow trace (UI → DB → UI)

### 2.1 Start / home

1. **UI** `rank.tsx` → `CoachKingSection` CTA → `router.push('/coach-king')`  
2. **Screen** `CoachKingScreen` `useFocusEffect` → `loadHome` (`CoachKingScreen.tsx:154-156`, `132-152`)  
3. **Auth** Clerk `getToken()`; if missing, loading stops with no home (`134-136`) → may show `EMPTY_HOME` (`174`)  
4. **Client** `coachKingService.getHome` → `GET {API}/coach-king/me?lang=` (`coachKing.service.ts:212`, `166-184`)  
5. **Route** `router.get('/me', requireAuth, …)` (`coach-king.routes.ts:88-92`)  
6. **Service** `getCoachKingHome` (`coach-king.service.ts:489-533`):  
   - `ensureCoachKingSchema()` (`490`)  
   - `warmCoachKingPool()` fire-and-forget (`491`)  
   - `requireUser(clerkId)` (`492`)  
   - `ensureWallet` upsert + `ensureCoachKingGameweek` (`493-496`)  
   - `loadSquad` / carry-over (`497`)  
   - `pointsByPlayer` + in-memory `cachedBoard` (`498-504`)  
7. **Response** `{ success: true, data: { user, wallet, gameweek, squad } }`  
8. **UI** sets `home`; pitch / budget / locks render from DTO

### 2.2 Pick player slot

1. Pitch slot tap → picker (`onSlot` `204-228`)  
2. Card select → confirm sheet (`CoachKingCardGrid` pending)  
3. Confirm → optimistic `withPick` then `POST /me/slot` (`CoachKingScreen.tsx:257-286`, `coachKing.service.ts:249-250`)  
4. Route validates `slotKey`/`playerId` strings (`routes:94-104`)  
5. `pickCoachKingSlot` (`service:560-612`): auth user, wallet, open week, line/position check, `SLOT_LOCKED` if `lockedAt`, `MATCH_STARTED` via `startedTeamIds`, `inspectCoachKingSquad` (budget/club/dupe), then Prisma `$transaction` upsert slot **with `lockedAt: now`** + set `confirmedAt` if null  
6. Returns fresh `getCoachKingHome` → UI replaces optimistic state

### 2.3 Pick coach

Same pattern → `POST /me/coach` → `pickCoachKingCoach` (`616-651`) sets `coachLockedAt`.

### 2.4 Leaderboard

Tab ranking → `GET /leaderboard?period=week|all&limit=50` (`routes:129-150`) → `coachKingLeaderboard` → `buildBoard` (`768-832`): sum performances + coach scores per confirmed squad; sort by points desc then **earlier `confirmedAt` wins ties**; dense `rank = index + 1` (no shared rank for equal points).

### 2.5 Scoring / week settle (background)

`startCoachKingProcessor` every 10 min (`processing:294-301`): `processCoachKing` → discover/store fixtures for selected clubs → `scoreFixture` (365 fetch → selected slots query → `createMany skipDuplicates` → mark `processedAt`) → status machine → `settleCoachKingGameweek` resets wallets to 100M.

### 2.6 Auth / middleware

- Every CK route uses `requireAuth` (`routes.ts`).  
- Global `generalLimiter` applies (`main.ts:325`); no CK-specific limiter.  
- Admin: `/admin/sync|reset|process` also `requireAdmin`.

---

## 3. Real endpoint tests (production)

Base: `https://90plus.pro/api`

| Request | Result | Excerpt / notes |
|---------|--------|-----------------|
| `GET /health` | **200** | `"database":"Connected","environment":"production","git":"277f632aed21"`, schema ok, redisAvailable true |
| `GET /coach-king/me` (no token) | **401** | `{"status":"ERROR","message":"Unauthorized - Invalid token"}`; headers `x-clerk-auth-status: signed-out` |
| `GET /coach-king/leaderboard` (no token) | **401** | same |
| `GET /coach-king/players?line=FWD` (no token) | **401** | same |
| `POST /coach-king/me/slot` body `{"slotKey":"st","playerId":"x"}` (no token, `--data-binary` file) | **401** | Unauthorized (auth before handler) |
| `POST /coach-king/me/coach` / slot with mangled PowerShell JSON | **500** | `Expected property name or '}' in JSON` — express.json parse failure (client malformed body), not CK logic |
| Authenticated `GET/POST` mutating flows | **UNVERIFIED** | No test Clerk JWT available. Exact requests needed: `Authorization: Bearer <session_jwt>` on `/me`, `/me/slot`, `/me/coach`, `/leaderboard`, `/me/fixtures`, `/users/:id/squad` |

**Note:** All user CK endpoints are auth-gated; there is no public read surface to curl for DTO shapes. Contract verified from code + DB instead.

---

## 4. DB / Redis checks

### 4.1 Neon MCP (`user-Neon` project `Football-app` / `bitter-butterfly-92483988`)

- `coach_king_*` tables: **do not exist** (only unrelated `ranking_badges`).  
- Neon is **not** the production CK database.

### 4.2 Railway Postgres (local `.env` `DATABASE_URL` → `trolley.proxy.rlwy.net:51741/railway`)

Read-only Prisma/`$queryRaw` results (2026-10-30):

| Metric | Value |
|--------|-------|
| active players | 2587 |
| active coaches | 94 |
| wallets | 3 (all `balanceMilli=1000`, non-100M=0) |
| squads / confirmed | 1 / 1 |
| incomplete confirmed (`slots<11` OR no coach) | **1** |
| gameweeks | 1 — `weekKey=2026-10-27`, `status=OPEN`, `startAt=2026-10-27T00:00:00.000Z`, `endAt=2026-11-03T00:00:00.000Z`, `lockAt=2026-11-03T00:00:00.000Z` |
| performances / coach_scores | **0 / 0** |
| fixtures | 2 (both `NS`, unprocessed; kickoffs 2026-10-31 15:00Z / 20:00Z) |
| locked slots | 3 |
| coaches/players null photo or position | **0** |
| lock columns present | `lockedAt`, `priceMilli`, `coachLockedAt`, `coachPriceMilli` |
| integrity | DUP_PLAYERS=[], DUP_SLOTS=[], CLUB_OVER=[], OVERSPEND=[] |
| pool by line | FWD 695, MID 725, DEF 877, GK 290 |

Recent squad sample: `spentMilli=240`, **3 slots**, **no coach**, `confirmed=true`, `coachLocked=false`.

### 4.3 Redis

- Connected via `REDIS_URL` (host `viaduct.proxy.rlwy.net`).  
- `KEYS ck:list:*` → **0 keys** (list cache cold or expired; TTL in code 10 min).  
- Leaderboard cache is **process memory only** (`boardCache` in `coach-king.service.ts:746-760`), not Redis.

---

## 5. Railway + Sentry findings

### Railway (`superb-passion` / `90Plus-app`)

- **2026-10-26 ~12:20–13:00Z:** repeated `[CoachKing] processor failed` / `home failed` / `pool sync failed` — Prisma errors on missing `coach_king_*` tables (pre-bootstrap).  
- **2026-10-26 13:07:49Z:** `[CoachKing] created missing fantasy tables` — runtime `ensureCoachKingSchema` fired in prod.  
- **2026-10-26 13:08–14:19:** pool sync progressed `players=2586 coaches=0` → `coaches=94`.  
- **2026-10-26 13:13:** `CoachKingWallet.upsert` unique/`userId` error during home (race during bootstrap).  
- **2026-10-27 → 10-29:** periodic pool sync OK (`players=2587 coaches=94`).  
- **2026-10-29 → audit time:** filter `CoachKing` shows only pool sync info; **no new processor ERROR lines** in returned sample.  
- HTTP logs filtered `@path:/api/coach-king*` → **0** entries (proxy log retention/filter limitation; treat coverage as incomplete).

### Sentry

| Org / project | Result |
|---------------|--------|
| `mrdev-pk` / `90plus-app` (mobile, `de.sentry.io`) | Issues/errors search for CoachKing/coach-king/coachKing last **14d**: **no matches** |
| Backend org `90plus` / `90plus-backend` | **UNVERIFIED** — `find_organizations` only returns `mrdev-pk`; no access to `90plus` org (auth/scoping). Cross-check: Railway deploy logs above. |

---

## 6. Edge-case checklist

| Item | Result | Evidence |
|------|--------|----------|
| Auth required on all user endpoints | **PASS** | `routes.ts` every handler `requireAuth`; prod 401 without token |
| Client cannot forge points/choices into scores | **PASS** | Body only `slotKey`/`playerId`/`coachId`; points from `computeCoachKingPoints` / processor only |
| Server validates line/position/budget/club/dupe | **PASS** | `pickCoachKingSlot` + `inspectCoachKingSquad` (`scoring.ts:101-144`, `service.ts:573-598`) |
| Double-tap confirm guarded in UI | **FAIL** | `CoachKingScreen.tsx:453` hardcodes `confirming={false}`; button never disables (`CardGrid:404`) |
| Idempotent re-submit same locked pick | **FAIL / partial** | Second call after lock → `SLOT_LOCKED` 409 (`581-582`), not success-idempotent |
| Concurrent picks same slot (race) | **FAIL** | No `FOR UPDATE` on squad; two requests can both pass `lockedAt` null check before upsert (`600-610`) |
| Concurrent different slots same player | **FAIL (latent)** | Dupe only in memory inspect; no DB unique on `(squadId, playerId)` |
| Wallet upsert on every GET /me | **FAIL (write amp)** | `ensureWallet` `update: { balanceMilli: 1000 }` (`151-156`) called from every home/pick |
| `ensureCoachKingSchema` ALTER on first call | **FAIL (ops risk)** | Always runs slot-lock migration statements (`105-107`); `ADD COLUMN IF NOT EXISTS` → ACCESS EXCLUSIVE |
| Week window timezone | **FAIL vs product Cairo weeks** | `tsfGameweekWindow` Tuesday **00:00 UTC** (`top-scorers-five-scoring.ts:288-298`), not Cairo |
| Tie-break / king determination | **PASS (defined)** | Points desc, then earlier `confirmedAt` (`826-828`); no co-king |
| Empty leaderboard | **PASS (code)** | `buildBoard` returns `[]`; UI `KingEmptyState` (`CoachKingScreen:405-407`) — prod currently sparse |
| Null coach/player photo | **PASS (UI+DB)** | Pitch/board placeholders; DB null photos = 0 |
| Incomplete “confirmed” squad allowed | **PASS (by design) / product risk** | `confirmedAt` set on first pick (`608`); DB has incomplete confirmed n=1 |
| Empty fixtures / matches tab | **PASS (code)** | `KingEmptyState` when no fixtures |
| Auth expiry mid-flow | **PARTIAL** | Failed pick restores previous home (`284`); no explicit re-login UX; token null → silent return on confirm (`271`) |
| scoreFixture vs late squad | **RISK** | Selected players queried at score time (`processing:138-144`); insert-only; late confirm after `processedAt` misses fixture points |
| Contract: front types vs backend extra fields | **PARTIAL** | Home `gameweek` returns `weekKey/startAt/endAt` (`523-530`) but `CkHome.gameweek` omits most (`coachKing.service.ts:110`); fixtures return `homeTeamId/awayTeamId` not on `CkFixture` — harmless extras |
| Pagination | **N/A / fixed limit** | Leaderboard `limit` clamp 1–100; pool `take: 1000` |
| Error shape | **PASS** | `sendError` → `{ error, message, details, timestamp, path }`; client reads `error` + `details.reason` |
| Rate limit | **PASS (global)** | `generalLimiter` on `/api`; CK inherits |
| Unit tests scoring/pricing | **PASS** | Jest 2 suites / 10 tests, exit 0 |
| Root `tsc --noEmit` | **PASS** | exit 0 |
| Front `tsc --noEmit` | **FAIL (unrelated)** | Existing WebView/push/i18n errors; none in `coach-king/*` in truncated output |
| Production scoring end-to-end | **UNVERIFIED** | `performances=0`, fixtures still `NS` |
| Redis list cache warm | **UNVERIFIED / empty** | 0 `ck:list:*` keys at audit time |

---

## 7. Findings table

| ID | Sev | Evidence | Root cause | Proposed minimal fix | Needs | Schema/auth? |
|----|-----|----------|------------|----------------------|-------|--------------|
| **KC-1** | **P1** | `CoachKingScreen.tsx:453` `confirming={false}`; confirm CTA not disabled (`CardGrid:404`) | Confirm busy state never wired | Local `confirming` state around `onConfirm`; pass true while request in flight | Device double-tap test | N |
| **KC-2** | **P1** | `pickCoachKingSlot` reads squad then upserts without row lock (`579-610`); unique only `(squadId,slotKey)` | TOCTOU race on concurrent slot writes | Interactive transaction: `SELECT … FOR UPDATE` squad/slot, then upsert; treat same-player+locked as success | Auth concurrency test | N |
| **KC-3** | **P1** | `ensureCoachKingSchema` always executes slot-lock `ALTER … ADD COLUMN IF NOT EXISTS` (`105-107`); Railway 2026-10-26 created tables live | Runtime DDL / ACCESS EXCLUSIVE on request path | Run migrations in deploy only; gate ALTER behind column existence check once, never on hot path | Confirm no pending cols in CI | Y (process) |
| **KC-4** | **P2** | `ensureWallet` upsert **updates** `balanceMilli: 1000` every call (`151-156`); every `/me` | Write amplification; future non-flat balances broken | `update: {}` or update only when create; settle remains sole renew writer | — | N |
| **KC-5** | **P2** | `tsfGameweekWindow` UTC Tuesday (`top-scorers-five-scoring.ts:288-298`); shared with TSF | Week boundaries not Cairo; differs from King-of-Predictions Cairo week | Align product decision; if Cairo required, shared helper change (TSF impact) | Product sign-off | Possibly Y |
| **KC-6** | **P2** | Second pick after lock → `SLOT_LOCKED` (`581-582`); not idempotent success | Lock-on-first-pick design without idempotent ACK | If same `playerId` already locked, return home 200 | — | N |
| **KC-7** | **P2** | No `@@unique([squadId, playerId])`; dupe only in `inspectCoachKingSquad` | Concurrent two-slot same player can persist | Unique index + catch P2002 | Migration | Y |
| **KC-8** | **P2** | `scoreFixture` selects confirmed slots at process time (`138-144`); `createMany skipDuplicates`; `processedAt` final | Picks after process miss points | Re-score unprocessed only is OK; optional reconcile job for new slots on finished fixtures | Wait for first FT fixtures | N |
| **KC-9** | **P2** | `confirmedAt` on first pick (`608`); incomplete confirmed counted on board (`771-772`); DB n=1 incomplete | Partial lineups compete on leaderboard | Product: require full XI+coach before `confirmedAt` / board eligibility | Product | N |
| **KC-10** | **P3** | Front `CkHome.gameweek` / `CkFixture` missing fields server returns | Type drift | Extend TS interfaces to match DTO | — | N |
| **KC-11** | **P3** | Ties get distinct ranks via `confirmedAt` (`826-828`) | No equal ranks / no “co-king” | Document or show tied rank if product wants | — | N |
| **KC-12** | **P3** | Backend Sentry org inaccessible; HTTP coach-king logs empty | Tooling scope | Grant MCP access to `90plus` / `90plus-backend` | Auth | N |
| **KC-13** | **P3** | Historical Railway wallet upsert race during bootstrap (2026-10-26) | Cold start schema | Already mitigated by tables existing; keep migrations offline | — | N |

**Shared-code risk (TSF):** Coach King imports `tsfGameweekWindow`, `isTsfFixtureNotStarted`, league IDs, portrait URL, status helpers from `top-scorers-five-scoring.ts`. Changing week window or status sets affects **both** features.

---

## 8. Manual device test steps (anything UNVERIFIED)

Use a real signed-in account on **iOS and Android** build pointing at `https://90plus.pro/api`. Do not use admin reset in prod.

1. **Auth gate:** Signed out → open Rank → Start ملك المدربين → expect no crash; signed-in required for data.  
2. **Home load:** Open `/coach-king` → budget 100M, pitch empties or partial squad, loading spinner then content.  
3. **Pick + lock:** Select ST → confirm → slot shows lock; reopen picker for that slot → locked sheet, not replace.  
4. **Double-tap confirm (KC-1):** Mash confirm → expect single network success or clear SLOT_LOCKED error; no duplicate spend.  
5. **Budget / club limit:** Try 4th player same club → client + server error (`CLUB_LIMIT`); overspend → `BUDGET`.  
6. **Wrong line:** Attempt LW player into ST via any client bug → server `WRONG_LINE`.  
7. **Auth expiry mid-pick:** Force expire session (sign out other device / revoke) → confirm → error / restore previous lineup; no crash.  
8. **Ranking empty/sparse:** Ranking tab week/all → empty state or rows; open opponent → pitch or empty box.  
9. **Matches:** With partial squad → fixtures for those clubs only; empty → empty state.  
10. **Null media:** Coach/player without photo (if any) → placeholder (`plear 90Plus.jpg`); no redbox.  
11. **Post-match scoring (after 2026-10-31 fixtures FT):** Wait for processor (~10 min) → slot points update; leaderboard non-zero; no duplicate performance rows.  
12. **Week boundary:** Near `endAt` Tuesday 00:00 UTC → picking closed (`SQUAD_LOCKED`); new week carry-over unlocked until clubs start.

**Auth mutating curl template (needs token):**

```http
GET https://90plus.pro/api/coach-king/me?lang=ar
Authorization: Bearer <CLERK_SESSION_JWT>

POST https://90plus.pro/api/coach-king/me/slot?lang=ar
Authorization: Bearer <CLERK_SESSION_JWT>
Content-Type: application/json
{"slotKey":"st","playerId":"<uuid>"}
```

---

## 9. Tooling / compile summary

| Check | Result |
|-------|--------|
| Jest `coach-king-scoring` + `coach-king-pricing` | **PASS** 10/10 |
| Root `npx tsc --noEmit` | **PASS** |
| Front `npx tsc --noEmit` | **FAIL** (pre-existing non-CK errors) |
| Prod health | **OK**, git `277f632aed21` |
| Neon for CK data | Wrong DB |
| Railway Postgres | Live CK data as above |
| Redis | Reachable; CK list keys empty |
| Sentry mobile | No CK issues 14d |
| Sentry backend | UNVERIFIED (no org access) |

---

## 10. Release recommendation (adversarial)

**Do not treat as green.** Ship blockers for a production feature launch:

1. Fix UI confirm busy flag (**KC-1**).  
2. Harden pick transactions / consider unique player-per-squad (**KC-2**, **KC-7**).  
3. Remove hot-path DDL (**KC-3**) before traffic spikes.  

Acceptable to ship only with explicit product acceptance of: partial lineups on the board (**KC-9**), UTC Tuesday weeks (**KC-5**), and scoring unproven until first fixtures finish (**UNVERIFIED E2E**).

---

*Audit artifact only — not committed per Phase 1 ground rules.*
