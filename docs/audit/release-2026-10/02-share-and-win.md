# Phase 1 Pre-Release Audit — شارك واربح (Share & Win)

**Date:** 2026-10-30  
**Scope:** Invite / referral system only (READ-ONLY)  
**Production API / share host:** `https://90plus.pro` (git health: `277f632aed21`)  
**DB used for SELECTs:** Railway Postgres via local Prisma + `DATABASE_URL` (Neon project `Football-app` / `bitter-butterfly-92483988` has **no** `share_win_*` tables — not prod)  
**Live backend path:** repo-root `src/` + `prisma/` on Railway service `90Plus-app`  
**`Backend/` folder:** STALE — contains only `public/`, `terms.html` (no live Express app)

`front/app.json` local uncommitted change observed (not modified by this audit): `ios.buildNumber` 163 → 164 only.

---

## 1. File map

### Backend (live)
| Path | Role |
|------|------|
| `src/services/share-win.service.ts` | Codes, cycles, claim, share events, standings, overview, prizes |
| `src/routes/share-win.routes.ts` | `GET /me`, `POST /share`, `POST /referral/claim`, `GET /leaderboard`, `GET /cycles` |
| `src/routes/support.routes.ts:84-95` | Public HTML landings `GET /invite/:code`, `GET /ref/:code` |
| `src/utils/share-landing-pages.ts` | Landing HTML, Play referrer, iOS clipboard payload, intents |
| `src/config/shareLinks.ts` | `SHARE_BASE_URL` default `https://90plus.pro` |
| `src/config/androidAppLinks.ts` | Package + SHA-256 → `assetlinks.json` |
| `src/config/appleAppSite.ts` | Team ID + AASA paths incl. `/invite/*`, `/ref/*` |
| `src/main.ts:197` | Global `clerkMiddleware()` (optional auth) |
| `src/main.ts:494` | Mount `/api/share-win` |
| `src/main.ts:499` | Mount support/share landings at `/` |
| `src/main.ts:502-515` | `/.well-known/assetlinks.json` + AASA (before static + catch-all) |
| `src/main.ts:564-565` | `express.static(public)` (AASA also mirrored under `public/.well-known/`) |
| `src/main.ts:672-679` | Catch-all `301` → `https://90plus.pro` (excludes `/.well-known`) |
| `src/main.ts:970-983` | 15‑min cycle rollover `ensureCurrentCycle` + `closeDueCycles` |
| `src/services/xp.service.ts:74` | `REFERRAL_CONVERSION: 50` |
| `prisma/schema.prisma:22` | `User.referralCode` unique |
| `prisma/schema.prisma:1971-2058` | `ShareWinCycle` / `ShareEvent` / `Referral` / `Standing` |
| `public/.well-known/apple-app-site-association` | Static AASA twin (Express dynamic handler wins first) |

### Frontend
| Path | Role |
|------|------|
| `front/app/share-win/*` | Screens |
| `front/components/ShareWin/**` | UI (hero, share card, stats, prizes, wheel) |
| `front/hooks/useShareWin.ts` | Overview query, share sheet, `redeemPendingReferral` |
| `front/services/shareWin.service.ts` | API client + types (mirrors backend payload) |
| `front/constants/shareLinks.ts` | Link builders, share message, parse helpers |
| `front/utils/pendingReferral.ts` | AsyncStorage pending/claimed carrier |
| `front/utils/deferredReferral.ts` | Android Install Referrer + iOS clipboard |
| `front/utils/navigateShareDeepLink.ts` | Park code + route to `/auth` or matches |
| `front/components/DeepLinkHandler.tsx` | Linking initial/url → navigate |
| `front/app/_layout.tsx:510-606` | Boot deferred settle + redeem after `/clerk` sync |
| `front/app.json:19-24,90-180` | `associatedDomains` + Android `intentFilters` (`/invite`, `/ref`, autoVerify) |
| `front/eas.json` | `EXPO_PUBLIC_SHARE_BASE_URL`, `ascAppId` 6758296989, Team `337M3TRC5C` |
| `front/locales/ar.ts` / `en.ts` `shareWin` | Copy (monthly vs weekly inconsistency) |

### Well-known / landing / web
| Path | Notes |
|------|------|
| Prod `https://90plus.pro/.well-known/*` | Served by Express handlers (verified) |
| `public/.well-known/apple-app-site-association` | Present; no `assetlinks.json` under `public/` (dynamic only) |
| `web/` | Marketing/site assets; invite landings are **backend-rendered**, not Vite routes |

---

## 2. Flow trace (file:line)

### A. Invite link generation (authenticated sharer)
1. UI `ShareWinScreen` → `useShareWin` (`front/hooks/useShareWin.ts:56-70`)  
2. `GET ${API}/share-win/me` (`front/services/shareWin.service.ts:97-104`)  
3. Route `requireAuth` → `getShareWinOverview` (`src/routes/share-win.routes.ts:58-67`)  
4. `ensureReferralCode(userId)` (`src/services/share-win.service.ts:94-126`) — 6-char Crockford alphabet, unique on `users.referralCode`  
5. `buildReferralLink` → `${SHARE_BASE_URL}/invite/${code}` (`share-win.service.ts:85-86`, config default `https://90plus.pro`)  
6. Client share payload uses same domain (`front/constants/shareLinks.ts:205-247`)

**Verdict:** Generated **on backend**; front only displays/shares. Format `https://90plus.pro/invite/XXXXXX`. Unique via DB unique index + collision retry.

### B. Share sheet
1. `shareReferral` (`useShareWin.ts:112-148`) → `Share.share(buildReferralSharePayload)`  
2. AR message includes weekly prize wording + HTTPS invite link (`shareLinks.ts:242-245`)  
3. After confirmed share → `POST /share-win/share` + optional `claimAppShareReward` (1 XP / 24h, separate from referral)

### C. Link tap → not installed → store → first launch → register → count
1. HTTPS `GET /invite/:code` (`support.routes.ts:84-94`) → `buildReferralLandingPage` (`share-landing-pages.ts:354-371`)  
2. **If app installed:** OS Universal/App Link → `DeepLinkHandler` (`DeepLinkHandler.tsx:31-74`) → `navigateShareDeepLink` parks code (`navigateShareDeepLink.ts:53-61`) → `/auth` if signed out  
3. **If not installed (Android):** intent + `S.browser_fallback_url` = Play URL with `referrer=invite_CODE` (`share-landing-pages.ts:68-70,17-20`)  
4. **If not installed (iOS):** custom scheme try; no auto App Store if invite payload set; button copies `90plus-invite:CODE` then store (`share-landing-pages.ts:111-145,183-190`)  
5. Cold start: `ensureDeferredReferralSettled` (`_layout.tsx:512-517`, `deferredReferral.ts:49-101`)  
   - Android: `Application.getInstallReferrerAsync` → `invite_CODE` → `capturePendingReferral`  
   - iOS: exact clipboard regex `^90plus-invite:([A-Z0-9]{6})$` then alphabet validate  
6. After signed-in + `syncUserWithBackend`: `redeemPendingReferral` (`_layout.tsx:597-602`, `useShareWin.ts:184-210`)  
7. `POST /api/share-win/referral/claim` (`share-win.routes.ts:103-118`) → `claimReferral` (`share-win.service.ts:405-475`)  
8. On success: row in `share_win_referrals` + `syncStanding` + `awardXp(REFERRAL_CONVERSION, idempotencyKey=share-win-referral:{referredUserId})`

### D. Counting / anti-abuse (server)
Rejects before write (`claimReferral` 410-439): invalid / unknown / deleted-banned referrer / self / already attributed / account older than **48h**.  
Duplicate guard: `referredUserId @unique` + `P2002` → `already_attributed` (schema `2014-2030`, service `456-459`).  
Standings recomputed from row counts (`syncStanding` 267-311) — self-healing vs increment drift.

---

## 3. Real endpoint tests (production)

### `GET https://90plus.pro/.well-known/apple-app-site-association`
- Status chain: **200** (no redirect with `curl -I -L`)  
- `Content-Type: application/json; charset=utf-8`  
- Body (excerpt): `appIDs: ["337M3TRC5C.com.mhmdsh1892.ninetyplusapp"]`, components include `/invite/*`, `/ref/*`  
- Also: `x-clerk-auth-status: signed-out` (middleware ran; did **not** block)  
- Alias `GET /apple-app-site-association` → **200** same type

### `GET https://90plus.pro/.well-known/assetlinks.json`
- Status: **200**, no redirect  
- `Content-Type: application/json; charset=utf-8`  
- `package_name: com.mhmdsh1892.ninetyplusapp`  
- SHA-256: `B9:AF:90:A5:F8:31:6E:B3:67:D2:94:EA:ED:ED:58:99:F6:BE:9C:FE:6A:9B:29:70:72:32:C4:D4:D0:07:C6:E8`  
- Matches `src/config/androidAppLinks.ts:16-17` and `front/constants/shareLinks.ts:36-37`  
- **Play Console / EAS credentials fingerprint:** UNVERIFIED (no credentials file with alternate digests found; `eas.json` has no SHA)

### Middleware order (auth vs well-known)
| Step | Location | Notes |
|------|----------|-------|
| `clerkMiddleware()` | `src/main.ts:197` | Global; populates auth; does not require login |
| `checkAppVersion` | `src/main.ts:201` | Allows missing `x-app-version` (browsers) |
| API + support mounts | `494-499` | |
| **well-known handlers** | **`502-515`** | Explicit JSON routes **before** `express.static` and catch-all |
| static `public/` | `564` | |
| catch-all 301 | `672-679` | Excludes `/.well-known` |

**PASS:** well-known served before auth **requirement**; clerk is present but non-blocking.  
**Note:** If `APP_MAINTENANCE_MODE=true`, version middleware would 503 JSON for these paths too (`app-version.middleware.ts:24-31`) — currently not (200 observed).

### Invite landing
| Request | Result |
|---------|--------|
| `GET /invite/ABCDEF` | **200** `text/html`, CSP share-landing, title «دعوة صديق», `ninetyplus://invite/ABCDEF`, Play `referrer=invite_ABCDEF`, `iosInvitePayload="90plus-invite:ABCDEF"`, intent fallback = Play (not self) |
| `GET /ref/ABCDEF` | **200** same |
| `GET /invite/AB0O1D` / `BAD!!!` | **404** HTML «Invite not found» |

### Auth API (read-only)
`GET /api/share-win/me` without token → expected 401 — **not hammered**; Railway logs show live `200` on `/me`, `/share`, `/referral/claim` from real clients (2026-10-28…30). Creating junk claims in prod: **not done** (UNVERIFIED live claim body).

### Alt domain
`https://90plus.app/.well-known/assetlinks.json` — curl timed out / incomplete in this run → treat **90plus.pro** as canonical share host (matches `SHARE_BASE_URL`).

---

## 4. DB checks (read-only SELECT via Prisma → Railway)

```
CYCLES: 2026-W44 ACTIVE (Mon 2026-10-26 → 2026-11-02 UTC); W43–W40 COMPLETED
REFERRAL_TOTAL: 2
users_with_code: 126
DUP referredUserId: []
SELF referrals: 0
standing vs referral/share event counts: MISMATCH_COUNT 0
score != participantCount*3: bad_score_rows 0
xp_transactions REFERRAL_CONVERSION: n=2, xp_sum=100 (2×50), orphan vs referral rows: []
```

Referral rows:
| referrer | referred | code | hours after signup | cycle context |
|----------|----------|------|--------------------|---------------|
| ahmedelnagar | ahmed | 53JR43 | ~23.0h | within 48h window |
| hoba | user_uTrS6XWk | AK7P6C | ~0h | immediate |

**W43 closed leaderboard (product concern):** top ranks had `participantCount=0`, high `shareCount` (402 / 300 / 108…), `score=0`, `finalRank` 1..5 by share tie-break. Confirms empty-referral weeks are won by share volume despite copy saying ranking is by invited friends.

Redis: no Share & Win keys in design (DB source of truth). Redis availability noted in `/api/health` (`redisAvailable: true` for API-Football) — **no referral state there**.

Neon MCP: `Football-app` project reachable but empty of `share_win_*` — not production.

---

## 5. Railway + Sentry

### Railway (`superb-passion` / service `90Plus-app`)
- Share-win HTTP traffic healthy (200/304 on `/me`, `/share`, `/leaderboard`, `/referral/claim`).  
- Rollover logs: Opened/Closed W42→W43→W44 on schedule.  
- **WARN** `2026-10-24`: `[ShareWin] Reopening prematurely closed cycle 2026-W43` (`share-win.service.ts:165-170` path).  
- Slow `ShareWinCycle.findUnique` warnings (~560–816ms) — perf, not correctness.  
- No `[ShareWin] referral XP award failed` lines in filtered window.

### Sentry
| Org / project | Result |
|---------------|--------|
| `mrdev-pk` / `90plus-app` | Accessible. No issues/errors matching referral|invite|share-win|deferredReferral|InstallReferrer|clipboard in last 14d. Unrelated unresolved ANRs/auth noise present. |
| Backend org `90plus` / `90plus-backend` | **UNVERIFIED** — `find_organizations` returned only `mrdev-pk`. Need auth/access to org `90plus` or confirm backend DSN org. Cross-check: Railway deploy logs used instead. |

---

## 6. Contract: front types ↔ backend

| Field | Backend `ShareWinOverview` | Front `ShareWinOverview` | Match |
|-------|---------------------------|--------------------------|-------|
| referralCode/Link, shareCount, participants, score, rank, totalShareCount | yes | yes | PASS |
| cycle weekKey/status/endsInMs | yes | yes | PASS |
| leaderboard rows participants/shares/score | yes | yes | PASS |
| prizes + lastWinner | yes | yes | PASS |
| scoring.perParticipant / perShare | 3 / 0 | typed | PASS |
| claim reasons union | same literals | same | PASS |

Unit tests: backend share-win + landing/deep-link suites **48/48 PASS**; front referral/deferred/navigate **37/37 PASS**.  
`npx tsc --noEmit` (root): clean in this run.  
`front` tsc: pre-existing errors elsewhere; **Share & Win relevant:** `front/utils/deferredReferral.ts:116` TS2339 narrowing on `soft.raw` after `Promise.race`.

---

## 7. Edge-case checklist

| Item | Result | Evidence |
|------|--------|----------|
| Link format/domain unique per user | PASS | `buildReferralLink` + unique `referralCode`; prod codes on 126 users |
| Well-known before requireAuth, JSON, no redirect | PASS | `main.ts:197` vs `502-515`; curl 200 JSON |
| Bundle ID / package / Team / App Store id | PASS | AASA/assetlinks/app.json/eas submit match `com.mhmdsh1892.ninetyplusapp`, Team `337M3TRC5C`, ASC `6758296989` |
| SHA-256 vs Play signing cert | UNVERIFIED | Matches repo constants only; need Play Console / upload keystore |
| `associatedDomains` / `intentFilters` autoVerify `/invite` | PASS | `front/app.json:19-24,136-164` |
| Landing → store with referrer / clipboard | PASS | Prod HTML excerpt + unit tests |
| Count once per new user | PASS | unique `referredUserId`; DB 0 dupes; race → P2002 |
| No count for old accounts / login | PASS (code) | 48h window `REFERRAL_ATTRIBUTION_WINDOW_MS`; live claim body UNVERIFIED |
| Missing/deleted/banned referrer | PASS (code) | returns `unknown_code`, no throw |
| Self-referral | PASS | code + DB self count 0 |
| Malformed / stale clipboard | PASS (code) | exact iOS payload regex + alphabet; non-match left alone |
| Android referrer parse noise | PASS (code) | `/invite_([A-Za-z0-9]+)/` then validate |
| UI counter matches DB | PASS for participants/shares/score formula | mismatch query 0; **label “xp” ≠ XP ledger** (see SW-2) |
| Share text AR/RTL + correct link | PASS | `buildReferralSharePayload` ar message + `/invite/{code}` |
| Referral XP idempotent | PASS | key `share-win-referral:{id}`; 2 XP rows = 2 referrals |
| Physical prizes granted automatically | FAIL / gap | `DEFAULT_PRIZES` display-only; no grant service |
| Weekly cycle vs monthly UI copy | FAIL | see SW-1 |
| Hero “every share = XP” vs score rules | FAIL | see SW-3 |
| End-to-end cold install attribution on device | UNVERIFIED | needs manual device steps below |

---

## 8. Findings table

| ID | Sev | Evidence | Root cause | Minimal fix | Needs | Schema/auth? |
|----|-----|----------|------------|-------------|-------|--------------|
| **SW-1** | **P1** | UI `weeklyTitle`/`prizesTitle` = «الترتيب/الجوائز **الشهرية**» (`ar.ts:1308-1324`); backend cycles are **ISO weeks** (`share-win.service.ts:128-195`, DB `2026-W44`) | Copy/Figma not updated to weekly product | Change AR/EN strings to أسبوعي/weekly; align `leaderboardCompetitors` / `lastWinnerNone` | OTA (locales) | N |
| **SW-2** | **P1** | StatsBar renders `` `${score} xp` `` (`StatsBar.tsx:51-53`) where `score = participants * 3` (`SCORE_PER_PARTICIPANT=3`); real XP award is **50** (`xp.service.ts:74`). Hint shows bare «XP» with no amount (`ShareCard.tsx:174-175`) | Competition score labeled as XP currency | Label as نقاط الترتيب / show `scoring.perParticipant`; hint should show `50` (or `overview.scoring` + XP constant) | OTA | N |
| **SW-3** | **P1** | Hero «كل مشاركة = نقاط XP» (`HeroHeader.tsx:29-36`, `ar.ts:1295-1296`); `SCORE_PER_SHARE=0` (`share-win.service.ts:33-34`); ranking primary key is `participantCount` | Misleading hero rule | Replace with “كل صديق يسجّل = …” matching claim rules | OTA | N |
| **SW-4** | **P1** | W43 `finalRank=1` user `drbeto` with **0** participants, **402** shares, score 0 (DB SELECT) | Tie-break allows share-farming to win weeks with zero conversions while UI sells friend invites + physical prizes | Product decision: require `participantCount>0` to win prizes, or stop counting share taps toward rank entirely when awarding | Railway (logic) + possible OTA copy | Maybe N (logic only) |
| **SW-5** | **P2** | 126 codes, **2** conversions; Railway shows many `/share` vs few `/referral/claim` | Funnel leak and/or deferred attribution hard to verify without devices | Device QA matrix below; add metrics for claim reasons | — | N |
| **SW-6** | **P2** | Prizes are JSON/defaults only (`DEFAULT_PRIZES`); no winner fulfillment / notification path for Share & Win | Ops assumes manual award | Document manual process or add admin award | Process / optional Railway | N unless new tables |
| **SW-7** | **P3** | Railway WARN premature close reopen W43 (2026-10-24) | Early COMPLETED then reopen guard | Confirm no manual/admin close race; monitor | Railway logs | N |
| **SW-8** | **P3** | `deferredReferral.ts:116` TS2339 on `soft.raw` | Discriminated union not narrowed | `if (!soft.timedOut) raw = soft.raw; else raw = await …` | OTA/native if shipped in that file | N |
| **SW-9** | **P3** | SHA-256 only verified vs repo; Play App Signing may differ | Missing console export in audit | Compare Play App signing cert SHA-256 to assetlinks | Ops | N |
| **SW-10** | **P3** | Backend Sentry org `90plus` inaccessible from this MCP session | Auth/org scope | Grant access or confirm DSN | — | N |

No P0 ship-blocker on deep-link hosting / unique attribution / well-known HTTP for the paths tested. **P1 copy + ranking/prize integrity issues should be decided before marketing “win PS5 by inviting friends” for the current week.**

---

## 9. Manual device test steps (UNVERIFIED items)

### Android — app **not** installed
1. Uninstall 90Plus. Clear Play Store cache optional.  
2. Open `https://90plus.pro/invite/<VALID_CODE>` in Chrome (not in-app WebView first).  
3. Confirm redirect/intent → Play with `referrer=invite_<CODE>`.  
4. Install, open, complete **new** registration within 48h.  
5. DB/API: sharer’s `participants` +1; `xp_transactions` +50 REFERRAL_CONVERSION once.  
6. Repeat with **existing** account login → claim reason `not_a_new_user`; no increment.

### Android — app installed
1. Tap same HTTPS link → app opens (App Link).  
2. Signed out → lands `/auth` with pending code stored.  
3. New signup → attributed once.

### iOS — not installed
1. Safari open invite link → landing; tap **تحميل التطبيق** (must copy `90plus-invite:CODE`).  
2. Install from App Store; first launch allow paste if prompted.  
3. Register new user → attribution.  
4. Negative: put unrelated clipboard text → no wrong attribution; put `90plus-invite:AB0O1D` (invalid alphabet) → no park.

### iOS — installed
1. Universal Link opens app; code parked; redeem after auth.

### Self / deleted referrer
1. Open own link after signup → `self_referral`.  
2. Ban/delete referrer user (staging) → `unknown_code`, app must not crash (already code-guarded).

### SHA-256 verification
1. Play Console → App integrity → App signing key certificate → SHA-256.  
2. Must equal production `assetlinks.json` fingerprint.

---

## 10. Test / typecheck summary

| Check | Result |
|-------|--------|
| Backend jest share-win + landing/deep-link | 48 passed |
| Front jest deferred/referral/navigate | 37 passed |
| Root `tsc --noEmit` | OK (this run) |
| Front `tsc --noEmit` | Errors present; Share & Win touch: `deferredReferral.ts:116` |
| `scripts/verify-share-win.ts` | **Not run** (writes DB; script forbids production) |

---

## 11. Severity-ranked summary (executive)

1. **P1 SW-1/2/3** — UI tells users the contest is **monthly**, that **shares earn XP**, and shows competition `score` as **`xp`**, while backend is **weekly**, share taps add **0** rank points, referral XP is **50**, and rank score is **3× friends**.  
2. **P1 SW-4** — Closed week W43 was won with **0 referrals** via share-count tie-break (402 shares) — conflicts with prize messaging.  
3. **P2** — Very low conversion (2/126); physical prizes not auto-granted; need device proof of Install Referrer / clipboard.  
4. **Infrastructure PASS** — Prod well-known + invite landings healthy; unique referral invariant holds in DB; XP ledger matches referral rows; Team/bundle/package/App Store id consistent in code + live AASA/assetlinks.

**Ship recommendation:** Do not market Share & Win prizes until SW-1–SW-4 product/copy decisions are fixed or consciously accepted. Deep-link plumbing itself is production-ready pending device UNVERIFIED paths and Play SHA confirmation (SW-9).
