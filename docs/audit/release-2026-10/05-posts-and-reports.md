# Phase 1 Pre-Release Audit — Posts (Community) + Reports + Block + Moderation

**Date:** 2026-10-30  
**Repo:** `c:\Football-app`  
**Auditor role:** Principal QA/Release Engineer (READ-ONLY)  
**Production API:** `https://90plus.pro/api` (health `git: 277f632aed21`, DB Connected)  
**Scope:** Community feed (البوستات / المجتمع), reports (الابلاغات), block, moderation / compliance path  

> **Scope clarification (no assumption):** “Posts” in this app are **Community** (`/api/community/*`) — text / image / team-poll. **Mux video uploads are Reels**, not Community posts. Community media is **Cloudflare R2** via multer → sharp → `r2MediaStorage.uploadPublic('community', …)`.

---

## 1. File map

### Backend (live = repo root `src/` + `prisma/`)

| Area | Path |
|------|------|
| Mount | `src/main.ts:488-495` (`/api/terms`, `/api/reports`, `/api/community`) |
| Community routes | `src/routes/community.routes.ts` |
| Community service | `src/services/community.service.ts` |
| Text / cursor helpers | `src/services/community-text.ts` |
| Community rate limits | `src/services/community-rate-limit.service.ts` |
| Image safety | `src/services/community-image-safety.ts`, `src/middleware/image-moderation.middleware.ts` |
| Text moderation | `src/services/community-moderation.service.ts`, `community-profanity.ts` |
| R2 | `src/services/r2-media-storage.service.ts` |
| Reports (reels/users) | `src/routes/reports.routes.ts` |
| User report / block / delete-me | `src/routes/user.routes.ts` |
| Block helper | `src/services/block.service.ts` |
| Moderation (reel-centric) | `src/services/moderation.service.ts` |
| Admin reports | `src/routes/admin.routes.ts` |
| AsS community moderation UI API | `src/routes/ass.routes.ts` + `src/services/ass-community.service.ts` |
| Account deletion | `src/controllers/user.controller.ts` → `src/services/account-deletion.service.ts` |
| Terms API | `src/routes/terms.routes.ts`, `src/services/terms.service.ts`, `src/data/terms-of-service-v1.0.md` |
| Auth middleware | `src/middleware/clerk.middleware.ts` (`requireAuth` @ L129) |
| Rate limiters | `src/middleware/rateLimit.middleware.ts` |
| Prisma models | `prisma/schema.prisma` — `Block` 701, `Report` 932, `CommunityPost` 989, `CommunityComment` 1041, likes/shares/media 1066–1152 |

### `Backend/` directory

**STALE / not live API.** Only static HTML: `Backend/terms.html`, `Backend/public/terms-of-service.html`. Live server is root `src/main.ts` on Railway service `90Plus-app`.

### Frontend (`front/`)

| Area | Path |
|------|------|
| Tab UI | `front/app/(tabs)/community.tsx` |
| Feed list / cards | `front/components/community/CommunityFeedList.tsx`, `PostCard.tsx`, `GhostPostCard.tsx`, `RichText.tsx` |
| Comments | `CommentsSheet.tsx`, `CommentItem.tsx`, `useCommentThread.tsx`, `CommentComposer.tsx` |
| Hooks | `front/hooks/community/useCommunityFeed.ts`, `usePostActions.ts`, `useComments.ts`, `communityCache.ts` |
| API client / types | `front/services/community.api.ts` |
| Report (reels/generic) | `front/components/common/ReportContentModal.tsx`, `ReportSystem.tsx`, `front/services/reportService.ts` |
| My reports | `front/app/(tabs)/my-reports.tsx` |
| Block UI | `front/services/blockService.ts`, `front/components/Settings/BlockedUsersScreen.tsx`, `front/app/settings/blocked-users.tsx` |
| Terms consent (signup) | `front/app/auth/index.tsx` + `LEGAL_URLS` in `front/config/legal.config.ts` |

---

## 2. Route inventory

Auth = Clerk `requireAuth` (`src/middleware/clerk.middleware.ts:129`) unless noted.  
Community handlers also re-check `req.auth?.userId` in `handle()` (`community.routes.ts:29-32`).

### 2.1 `/api/community` — `src/routes/community.routes.ts` mounted `main.ts:495`

| Method | Path | Auth? | Rate limit? | Validation? | Ownership? | file:line |
|--------|------|-------|-------------|-------------|------------|-----------|
| GET | `/feed` | Y | `lenientLimiter` | cursor decode in service | N/A (read) | `55` |
| GET | `/feed/peek` | Y | `lenientLimiter` | — | N/A | `57` |
| GET | `/trending` | Y | `lenientLimiter` | — | N/A | `59` |
| GET | `/search` | Y | `lenientLimiter` | `q` slice 80; type whitelist | block filter in service | `61-72` |
| GET | `/hashtags/:tag/posts` | Y | `lenientLimiter` | cursor | block post-filter | `74-79` |
| GET | `/users/:username/posts` | Y | `lenientLimiter` | cursor | empty if blocked | `81-86` |
| GET | `/mentions/search` | Y | `lenientLimiter` | `q` slice 30 | excludes blocked | `88-93` |
| POST | `/media` | Y | `writeLimiter` + multer 15MB image + magic bytes + image moderation | sharp + NSFW classify | media keyed to actor | `97-108` |
| POST | `/posts` | Y | `writeLimiter` + community RL `post` | normalize/max length/moderation | own create | `112` |
| GET | `/posts/:id` | Y | `lenientLimiter` | — | 404 if blocked author | `114` |
| PATCH | `/posts/:id` | Y | `writeLimiter` | content/media rules | **owner only** (`updatePost` 1200) | `116-121` |
| DELETE | `/posts/:id` | Y | `writeLimiter` | — | **owner only** (`deletePost` 1166) | `123-131` |
| POST | `/posts/:id/like` | Y | **none** (no `writeLimiter`) | unique `(userId,postId)` | any auth user | `133` |
| DELETE | `/posts/:id/like` | Y | **none** | — | own like row | `134` |
| POST | `/posts/:id/vote` | Y | `writeLimiter` | choice A\|B | blocked → 404 | `136-141` |
| POST | `/posts/:id/share` | Y | `writeLimiter` | platform slice 30 | — | `143-148` |
| POST | `/posts/:id/report` | Y | `writeLimiter` | type/reason | blocks self-report | `150-155` |
| GET | `/posts/:id/comments` | Y | `lenientLimiter` | cursor | hides blocked authors | `159-164` |
| POST | `/posts/:id/comments` | Y | `writeLimiter` + community RL | max length; per-post cap 20 | blocked post author → 403 | `166-171` |
| GET | `/comments/:id/replies` | Y | `lenientLimiter` | cursor | — | `173-178` |
| DELETE | `/comments/:id` | Y | `writeLimiter` | — | **author OR post owner** (`deleteComment` 1609) | `180-188` |
| POST | `/comments/:id/like` | Y | **none** | unique | — | `190` |
| DELETE | `/comments/:id/like` | Y | **none** | — | — | `191` |
| POST | `/comments/:id/report` | Y | `writeLimiter` | type/reason | blocks self-report | `193-198` |

Also: global `generalLimiter` on `/api` (`main.ts:325`).

### 2.2 `/api/reports` — `reports.routes.ts` / `main.ts:489`

| Method | Path | Auth? | Rate limit? | Validation? | Ownership / anti-self? | file:line |
|--------|------|-------|-------------|-------------|------------------------|-----------|
| POST | `/reel/:reelId` | Y | `strictLimiter` | reason map | **cannot report own reel** | `21-149` |
| POST | `/comment/:commentId` | Y | `strictLimiter` | reason map | **NO self-report check** (reel `Comment`) | `152-241` |
| POST | `/user/:userId` | Y | `strictLimiter` | reason required | cannot report self | `244-334` |
| GET | `/my-reports` | Y | none beyond general | — | reporter-scoped | `337-391` |

### 2.3 `/api/users` block / report / delete — `user.routes.ts` / `main.ts:456`

| Method | Path | Auth? | Rate limit? | Notes | file:line |
|--------|------|-------|-------------|-------|-----------|
| DELETE | `/me` | Y | `accountDeletionRateLimiter` | soft-delete + 30d grace | `26` |
| POST | `/report/:userId` | Y | `strictLimiter` | **live** handler (first registration) | `34-134` |
| POST | `/block/:userId` | Y | **none** | raw SQL upsert; no self-block | `144-224` |
| DELETE | `/block/:userId` | Y | **none** | unblock | `230-278` |
| GET | `/blocked` | Y | none | list | `285-340` |
| GET | `/block/:userId/status` | Y | none | status | `347-396` |
| POST | `/report/:userId` | Y | `validate({…})` | **DEAD CODE** — never reached (duplicate path after first) | `404+` |

### 2.4 Terms / admin / AsS (compliance & moderation)

| Method | Path | Auth? | file:line |
|--------|------|-------|-----------|
| GET | `/api/terms/latest` | N | `terms.routes.ts:10+` — **prod 500** (see findings) |
| POST | `/api/terms/accept` | Y | `terms.routes.ts:27` |
| GET | `/api/terms/user-acceptance` | Y | `terms.routes.ts:71` |
| GET | `/terms-of-service.html` | N | `main.ts:584` — **prod 200** |
| GET | `/api/admin/reports` | `requireAdmin` | `admin.routes.ts:20` — **no community post/comment include** |
| POST | `/api/admin/reports/:id/review` | `requireAdmin` | `admin.routes.ts:196` — deletes reel/comment only |
| GET/POST | `/api/ass/community/posts|comments…` | `requireAssSession` | `ass.routes.ts:176-235` |

---

## 3. Flow traces (UI → DB)

### 3.1 Create text/image post

1. UI compose → `usePostActions` / publish queue → `communityApi.createPost` (`front/services/community.api.ts:161-171`)  
2. `POST /api/community/posts` → `requireAuth` + `writeLimiter` → `handle` → `createPost` (`community.service.ts:954`)  
3. Optional image: `POST /media` multer → sharp WebP → `uploadPublic('community', actor.id, …)` key `community/{userId}/{ts}_{uuid}_{name}` (`r2-media-storage.service.ts:55-57`) → `CommunityMedia` row; create attaches only if `mediaId` + `userId: actor.id` + `attachedAt: null` (`1002-1008`) — **cannot attach another user’s media**  
4. Persist `CommunityPost`, hashtags, mentions; Redis feed cache invalidate; AI enqueue  
5. Response `{ status:'SUCCESS', data: CommunityPostDto }` → front types align (`community.api.ts` ↔ `toPostDto`)

**Video:** no Community video/Mux path. Mux is Reels (`/api/reels`, `/api/webhooks/mux`).

### 3.2 Edit / delete post

- Edit: `PATCH` → `updatePost` owner check `userId !== actor.id` → 403 (`1176-1200`)  
- Delete: **soft** `status: 'DELETED'` (`1160-1167`); feed queries `status: 'ACTIVE'` only (`418-420`). Comments/likes **not cascaded hard** (rows remain). R2 `deleteObject(imageStoragePath)` fire-and-forget; **DB path not cleared**; **`CommunityMedia` row not deleted**.

### 3.3 Feed pagination / infinite scroll

- Cursor: `(createdAt desc, id desc)` + `encodeCursor`/`decodeCursor` (`community-text.ts:54-72`)  
- Front: `useInfiniteQuery` + client dedupe by id (`useCommunityFeed.ts:64-74`)  
- First page Redis cache key `community:feed:first:v2` **global** (`451-467`), then per-viewer `finishPostPage` applies likes/following/**block filter** (`431-443`)  
- **Block filter is post-query:** blocked authors removed after `take: limit` → short pages / skipped slots possible when many blocks  
- New posts: `feed/peek` + cache invalidation on writes

### 3.4 Likes / comments

- Unique `@@unique([userId, postId])` / comment likes; toggle uses create+P2002 ignore / deleteMany + decrement (`1326-1364`, `1616-1659`)  
- Denormalized counters incremented in same transaction as insert (likes)

### 3.5 Report community content

- Front: `communityApi.report` → `POST …/report` → `reportContent` (`1674-1733`)  
- Self-report blocked; duplicate same reporter+target returns `{reported:true}` (no 24h window)  
- Auto-hide at `AUTO_HIDE_REPORTS = 3` → status `HIDDEN` (global hide, not reporter-only)  
- Safety flag `markCommunitySafetyFlag(…, 'REPORTED')`

### 3.6 Block

- Front `blockService` → `/api/users/block/:userId`  
- Community: `blockedPairIds` bidirectional (`194-206`) filters feed/comments/search/getPost/vote/notify  
- Match chat: `match-chat.service.ts:90-91`, `253-256`  
- Schema unique `(blockerId, blockedId)` (`prisma` Block model)

### 3.7 Account delete (known lead)

- `DELETE /api/users/me` → `UserController.deleteAccount` → **`AccountDeletionService.initiateAccountDeletion`** soft-delete (`isDeleted`, `deletedAt`, `scheduledDeletionAt` +30d) + delete Clerk user immediately (`account-deletion.service.ts:74-106`)  
- **Not anonymization.** Permanent path `permanentlyDeleteAccount` / `deleteUserData` collects **reel + avatar/cover** R2 paths only — **no `community_posts.imageStoragePath` / `community_media`** (`152-214`)

---

## 4. Real endpoint tests (production)

Base: `https://90plus.pro/api` — **no auth token** (mutating probes expect 401).

| Request | HTTP | Response excerpt |
|---------|------|------------------|
| `GET /health` | 200 | `"database":"Connected","environment":"production","git":"277f632aed21","communityImageScan":true` |
| `GET /community/feed` | 401 | `{"status":"ERROR","message":"Unauthorized - Invalid token"}` |
| `POST /community/posts` `{}` | 401 | same |
| `POST /community/posts/{uuid}/report` `{"type":"SPAM"}` | 401 | same |
| `POST /community/posts/{uuid}/like` | 401 | same |
| `DELETE /community/posts/{uuid}` | 401 | same |
| `POST /community/media` | 401 | same |
| `POST /users/block/{uuid}` | 401 | same |
| `POST /reports/user/{uuid}` `{"reason":"spam"}` | 401 | same |
| `GET /reports/my-reports` | 401 | same |
| `POST /terms/accept` | 401 | same |
| `GET /terms/latest` | **500** | `{"error":"E010","message":"Failed to get terms",…}` |
| `GET /terms-of-service.html` | **200** | HTML served |

Railway deploy log corroborates: `ENOENT … '/app/dist/src/data/terms-of-service-v1.0.md'` at `2026-10-30T16:09:16Z`.

**Authenticated IDOR tests:** UNVERIFIED (no test token). Exact requests:

```http
PATCH /api/community/posts/{victimPostId}
Authorization: Bearer <attacker>
Content-Type: application/json
{"content":"pwned"}
# Expect 403 FORBIDDEN

DELETE /api/community/posts/{victimPostId}
# Expect 403

DELETE /api/community/comments/{victimCommentId}
# Expect 403 unless attacker owns parent post
```

---

## 5. DB checks (read-only via local `.env` → Railway Postgres `trolley.proxy.rlwy.net`)

Neon MCP project `Football-app` has **no** `community_posts` (not prod). Prod DB queried with Prisma `$queryRawUnsafe` SELECT-only.

| Check | Result |
|-------|--------|
| Post status counts | ACTIVE **5**, DELETED **3**, HIDDEN **0** |
| Comment status | ACTIVE **5** |
| `likesCount` ≠ COUNT(likes) on ACTIVE posts | **0** mismatched |
| `commentsCount` ≠ COUNT(ACTIVE comments) | **0** mismatched |
| Comment like denorm mismatch | **0** |
| Poll vote denorm mismatch | **0** |
| ACTIVE posts by `users.isDeleted=true` | **0** (7 soft-deleted users exist; **0** of their community posts remain) |
| `community_media` | unattached **3**, attached **4**, total **7** |
| DELETED posts still having `imageStoragePath` | **3** |
| Attached media whose path not on non-DELETED post | **3** |
| Reports | community post **0**, community comment **0**, reel comment **1**, user-only **2**, total **3** |
| Duplicate reporter+communityPost | none |
| `blocks` rows | **0** |
| Unique indexes on `reports` | **no** unique on `(reporterId, target*)` — only PK + non-unique indexes |

---

## 6. Railway + Sentry

### Railway (`superb-passion` / `90Plus-app` / production)

- Community traffic healthy: feed/trending/peek 200/304; AsS moderation listing heavily used.  
- Unauth probes logged as 401 (expected).  
- **`GET /api/community/search` → 404** observed `2026-10-30T15:22:32Z` (route exists in deployed commit tree for `277f632` — treat as intermittent / prior revision / proxy oddity; **re-verify with auth token**).  
- Earlier `feed/peek` 404s (~14:42) then 200 after — deploy churn possible.  
- **Terms:** HTML 200; `/api/terms/latest` ENOENT (above).

### Sentry

| Org / project | Access | Finding |
|---------------|--------|---------|
| `mrdev-pk` / `90plus-app` (mobile) | OK (`de.sentry.io`) | No unresolved issues matching community/report/block in 14d natural-language search; top unresolved are SecureStore / Clerk session / ANR / native (not Community-specific) |
| `90plus` / `90plus-backend` | **UNVERIFIED** — org not in MCP `find_organizations` (only `mrdev-pk`). Railway has `SENTRY_DSN`/`SENTRY_ORG`/`SENTRY_PROJECT` vars (values sealed). Cross-check: use Railway deploy logs above |

---

## 7. Contract: front types ↔ backend

| Field | Backend DTO | Front `community.api.ts` | Match? |
|-------|-------------|--------------------------|--------|
| Envelope | `{ status:'SUCCESS', data }` | reads `json.data` | Y |
| Errors | `{ status:'ERROR', code, message, retryAfterSec?, max? }` | `CommunityApiError` | Y |
| Post | `CommunityPostDto` | `CommunityPost` | Y (kind, poll, image, counts, likedByMe, isMine) |
| Page | `{ items, nextCursor }` | `CommunityPage<T>` | Y |
| Author | always embedded `user` select | non-null `CommunityAuthor` | Y for live users; **no null-author DTO** if relation missing |
| Reports my-reports | reel/comment/user only mapping | ReportContentModal uses `/reports/...` | Community reports **not** classified in `my-reports` |

---

## 8. Edge-case checklist

| Item | Result | Evidence |
|------|--------|----------|
| Create text post | PASS (code) | `createPost` + route auth |
| Create image post | PASS (code) | `/media` + mediaId ownership |
| Create video post | N/A | Community has no video; Mux = reels |
| Edit own / not others | PASS (code) / IDOR UNVERIFIED live | `updatePost` 1200 |
| Soft delete | PASS | status DELETED; feed ACTIVE-only |
| Hard delete cascade | FAIL / partial | soft only; likes/comments retained; R2 best-effort |
| Feed cursor stability | PASS code | createdAt+id cursor |
| Dupes when new posts arrive | PASS front dedupe | `useCommunityFeed.ts:64-74` |
| Short pages under blocks | FAIL risk | post-filter blocks in `finishPostPage` |
| Like unique + race | PASS code | P2002 + unique index |
| Like count vs rows | PASS DB now | 0 mismatches |
| Comment/reply counts | PASS DB now | 0 mismatches |
| Ownership mutate | PASS code | delete/update checks |
| R2 key overwrite other user | PASS | key includes `userId`; attach filters `userId: actor.id` |
| Mux webhook for posts | N/A | not used for community |
| RTL / long text / emoji | PASS code | `RichText` rtl + `normalizeCommunityText` strips bidi; max 2000/1000; tests pass |
| Deleted-user posts in feed | **FAIL (code)** / **PASS (current data)** | `queryPosts` no `user.isDeleted`; DB ACTIVE posts of deleted users = 0 |
| Report post/comment/user | PASS paths exist | community + reports + users |
| Duplicate report prevention | PARTIAL | app-level only; **no DB unique**; community permanent; reels 24h |
| Can't report own community content | PASS | `SELF_REPORT` |
| Can't report own reel comment | **FAIL** | `reports.routes.ts` comment handler missing self check |
| Report rate limit | PASS | `strictLimiter` / `writeLimiter` |
| Hide after reports | PASS | AUTO_HIDE 3 → HIDDEN |
| Reporter-only hide | FAIL (by design absent) | global HIDDEN |
| Block hides feed/comments/chat | PASS code | community + match-chat |
| Block persist / unblock | PASS schema + routes | 0 rows in prod today |
| Auth on mutating routes | PASS probes | all 401 without token |
| Zod/Joi on community body | PARTIAL | hand-rolled normalize/limits; user report#2 dead validate() |
| Apple 1.2 / Google UGC: report+block | PASS code paths | community report + block + AsS delete |
| Terms acceptance UX | PASS HTML + signup checkbox | `LEGAL_URLS.terms` → `/terms` → HTML 200 |
| Terms API latest | **FAIL** | 500 ENOENT in dist |
| Admin review community reports | FAIL / gap | admin include lacks community relations; `autoDeleteContent` reel\|comment only |
| `Backend/` live | STALE | static HTML only |

### Tests run (read-only)

- Jest: `community-text`, `community-rate-limit`, `community-safety-flag` — **18/18 PASS**  
- `npx tsc --noEmit` (root `tsconfig.json`): **exit 0**

---

## 9. Findings table

| ID | Severity | Evidence | Root cause | Proposed minimal fix | Needs | Schema/Auth? |
|----|----------|----------|------------|----------------------|-------|--------------|
| **PR-1** | **P0** | Prod `GET /api/terms/latest` → 500; Railway ENOENT `/app/dist/src/data/terms-of-service-v1.0.md`; `tsc` does not copy `.md`; `copy:public` only copies `public/` | Terms markdown not packaged into deploy artifact | Copy `src/data/terms-of-service-v1.0.md` into dist in build **or** serve from `public/` / inline content; smoke-test `/api/terms/latest` in CI | Build/deploy | N |
| **PR-2** | **P1** | `queryPosts` (`community.service.ts:418-424`) filters `status:'ACTIVE'` only; `authorSelect` has no `isDeleted`; 7 soft-deleted users in DB | Grace-period deleted accounts can still author visible posts | Add `user: { isDeleted: false }` (or `userId notIn deleted`) to feed/search/getPost queries | Soft-delete UX | N |
| **PR-3** | **P1** | `deletePost` soft-deletes; DB: 3 DELETED posts still have `imageStoragePath`; 3 attached `community_media` without live post; `deleteUserData` skips community R2 keys (`account-deletion.service.ts:152-214`); orphan sweep only `attachedAt:null` | R2 community objects orphaned on soft/hard delete | On soft-delete: delete R2 + null path + delete/detach `CommunityMedia`; on account purge collect community paths | Storage cost / GDPR | N |
| **PR-4** | **P1** | `admin.routes.ts:72-85` includes reel/comment only; review uses `autoDeleteContent` reel\|comment (`moderation.service.ts:94-97`); community reports use separate AsS | Admin report queue incomplete for Community UGC | Include `reportedCommunityPost/Comment` in admin API; wire hide/delete to `hidePost`/`removeComment` | Moderation ops | N |
| **PR-5** | **P1** | `reports.routes.ts:168-214` no `comment.userId === user.id` guard (reel has guard at L45-48) | Self-report of own reel comment allowed | Mirror reel self-check | Abuse | N |
| **PR-6** | **P2** | `pg_indexes` on `reports`: no unique (reporter, target); race can double-insert; community uses findFirst only | App-level dedupe only | Partial unique indexes per target column | Integrity | **Y** (migration) |
| **PR-7** | **P2** | Like routes `community.routes.ts:133-134,190-191` lack `writeLimiter`; likes skip `consumeCommunityRate` | Like spam / cost | Attach `writeLimiter` and/or community RL | Abuse | N |
| **PR-8** | **P2** | Block filter after pagination (`finishPostPage` 431-433) | Short pages / skips under blocks | Filter `userId notIn blocked` in SQL `where` before `take` | UX | N |
| **PR-9** | **P2** | `my-reports` contentType ignores community IDs (`reports.routes.ts:372-383`) | Wrong type in UI for community reports | Map `reportedCommunityPostId` / `CommentId` | UX | N |
| **PR-10** | **P2** | Duplicate `POST /users/report/:userId` (`user.routes.ts:34` vs `404`) | Dead second handler / confusion | Delete dead route | Maintainability | N |
| **PR-11** | **P2** | Block mutate routes lack `strictLimiter`/`writeLimiter` | Weaker abuse control vs reports | Add `strictLimiter` | Abuse | N |
| **PR-12** | **P3** | Soft-deleted posts keep counters/likes/comments rows | Intentional soft-delete | Optional janitor hard-purge after N days | Storage | optional Y |
| **PR-13** | **P3** | Railway log search 404 while route present in `277f632` | UNVERIFIED cause | Authenticated repro of `/community/search` | Ops | N |
| **PR-14** | **P3** | Front assumes non-null `post.author` | Would crash if orphan user | Defensive placeholder (“Deleted user”) | Crash | N |

### Known leads re-verification

| Lead | Verdict |
|------|---------|
| Soft-deleted users’ posts still in feed | **Code FAIL (PR-2)**; **current prod data: 0** such ACTIVE posts |
| R2 `community_media` not cleaned when DB cascades/soft-deletes | **CONFIRMED (PR-3)** — DB counts above |
| `DELETE /users/me` path | **`deleteAccount` → soft-delete + Clerk delete + 30-day permanent**; **not** anonymization (`user.routes.ts:26`, `account-deletion.service.ts:74-106`) |

---

## 10. Manual device test steps (UNVERIFIED / P0–P1)

### iOS + Android (same script)

1. **Terms (PR-1 / compliance):** Fresh install → register → tap Terms link → confirm HTML loads. Optional: if any screen calls `/api/terms/latest`, confirm failure toast (expect fail until PR-1). Accept checkbox required before OAuth/email signup.  
2. **Report + block (Guideline 1.2):** Account A posts text+image+poll. Account B reports post (each reason once) → toast; after 3 distinct reporters expect post hidden for all. Block A from B → A’s posts gone from B’s feed/comments; match chat messages from A hidden; unblock restores.  
3. **IDOR:** B attempts edit/delete A’s post via proxied API (Charles) → expect 403.  
4. **Soft-deleted author (PR-2):** Soft-delete A (`Delete account`) while post ACTIVE → B still sees post? (expect **yes** today = FAIL).  
5. **Pagination + block:** B blocks several prolific authors → scroll feed; note gaps/short pages (PR-8).  
6. **Likes race:** Double-tap like rapidly → count should not jump +2; refresh matches.  
7. **RTL:** Arabic long post + emoji + LTR URL → `RichText` right-align; expand see more.  
8. **Search:** Authenticated `/community/search?q=…` must be 200 (PR-13).  
9. **My reports:** After community report, open My Reports — type may show as `user` incorrectly (PR-9).  
10. **Media orphan:** Upload image, abandon compose; wait 24h+ janitor OR inspect R2 for `community/{userId}/…` after soft-delete post.

### Auth-gated curl template (do not run against prod with real abuse)

```bash
TOKEN=...
curl.exe -sS -H "Authorization: Bearer %TOKEN%" "https://90plus.pro/api/community/feed"
curl.exe -sS -H "Authorization: Bearer %TOKEN%" "https://90plus.pro/api/community/search?q=test&type=all"
```

---

## 11. Severity-ranked summary (for release gate)

1. **P0 PR-1** — `/api/terms/latest` broken in production (packaging). HTML terms OK; signup uses HTML URL — still breaks any client/API acceptance path and fails compliance tooling that hits the API.  
2. **P1 PR-2** — Soft-deleted users’ community posts not filtered (code defect; dormant in current data).  
3. **P1 PR-3** — Community R2 / `community_media` leak on delete & account purge.  
4. **P1 PR-4** — Admin moderation path incomplete for community reports (AsS partially covers).  
5. **P1 PR-5** — Own reel-comment self-report allowed.  
6. **P2** — Report uniqueness, like rate limits, block pagination, my-reports typing, dead route, block rate limit.  

**Ship recommendation:** Do **not** treat Community UGC compliance as fully green until **PR-1** fixed and **PR-2/PR-4** scheduled; counters and auth gates look solid for soft launch volume (5 ACTIVE posts).

---

*End of Phase 1 report. No source files modified; this document intentionally uncommitted per audit rules.*
