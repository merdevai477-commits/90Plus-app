# Release fixes applied — 2026-10-30

## P0 (ship blockers) — `1ad6d86fc` + this commit
| ID | Fix |
|----|-----|
| **TS-1** | Normalize 365 `athletesStats` `{tables,filters}` → boards |
| **TS-2** | Do not shared-cache `_meta.unavailable` SUCCESS |
| **PR-1** | Copy `src/data/*.md` into `dist` + terms path fallbacks |

## P1
| ID | Fix |
|----|-----|
| **SW-1..3** | Weekly copy; ranking points ≠ XP; hero = converted friends |
| **SW-4** | `closeCycle` only ranks `participantCount > 0` |
| **SW-8** | `deferredReferral` union narrowing |
| **KC-1** | Confirm busy/`confirming` wired |
| **KC-2** | Slot pick `FOR UPDATE` + same-player idempotent |
| **KC-3** | DDL only if columns missing (cached) |
| **KC-4** | Wallet upsert `update: {}` |
| **PR-2** | Feed filters `user.isDeleted: false` |
| **PR-3** | Soft-delete clears R2 + `community_media` |
| **PR-5** | Cannot report own reel comment |
| **PR-9** | my-reports maps community types |
| **GK-5** | Predictions `authFetch` 401→`getToken({skipCache})` retry |
| **GK-6** | Concurrent create P2002 → retry as update |
| **TS-3** | Scorers tab distinct unavailable UI |
| **MT-1** | Synthetic goals when events empty / score>0 |
| **MT-2** | Age-out SUSP from live after kickoff+6h |

## Front release hygiene
- `npx tsc --noEmit` in `front/` → **0 errors**
- Push channel `sound: ''` (string), Image `cacheKey` on source, AuthPanel `variant`, VideosContext clearVideos Promise type, etc.

## Intentionally NOT changed (need product/ops)
| ID | Why |
|----|-----|
| **GK-1** | Enabling `PREDICTION_VOID_ENABLED` is an env/product call |
| **GK-3** | Resettle writes need ops dry-run approval |
| **KC-7 / PR-6** | New unique indexes = migration approval |
| **PR-4** | Admin community moderation queue = larger feature |

## Deploy checklist
1. **Railway** redeploy backend (P0/P1 server fixes)
2. After deploy: purge Redis `365:competition:*:stats*` if scorers still empty once; smoke `GET /api/terms/latest`
3. **EAS native build** (OTA alone not enough for all clients)
4. Device smoke: Share & Win copy, Coach confirm double-tap, Top Scorers tabs, soft-deleted users absent from feed, live match events
