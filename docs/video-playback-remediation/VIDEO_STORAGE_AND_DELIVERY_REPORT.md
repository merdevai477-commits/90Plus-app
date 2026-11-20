# Owned highlight storage and delivery

**Date:** 2026-11-20  
**Default:** `VIDEO_STORAGE_ENABLED=false`  
**Deploy:** not performed. Migration was not applied to production.

## 1. Executive summary

Highlights still play the original Highlightly URL unless a **verified** owned copy exists. A new ingest path can copy allowlisted direct MP4/HLS files into the existing Cloudflare R2 media bucket and remember only metadata in Postgres. YouTube is never downloaded. Nothing is ingested until an operator sets `VIDEO_STORAGE_ENABLED=true` and `VIDEO_STORAGE_ALLOWED_HOSTS`. Highlightly API access is not treated as permission to rehost.

## 2. Existing architecture

Highlightly cron writes `MatchHighlight.url`. `GET /api/football/fixtures/:id/highlights` returns those URLs. The app plays them in `HighlightVideoSheet` (YouTube WebView or expo-video after the P0 Range preflight). P0 and P1 commits remain ancestors of this work.

## 3. Root causes this does not pretend to erase

External CDN 404/410 and unsupported hosts still fail until an authorized copy exists. The Arabic “جاري تحميل الفيديو…” state is the P1 loading overlay; it ends on ready, a typed error, or the 12s/15s watchdogs. This change does not rewrite the player.

## 4. New storage path

Sync still only stores metadata. After a clip is linked it calls `noteClipForStorage`, which records `EXTERNAL_ONLY` or `PENDING_INGESTION`. A Bull queue `highlight-video-ingest` (or inline if Redis is unset) downloads to a temp file, hashes SHA-256, reuses a verified checksum, otherwise uploads with the existing S3 client and marks the asset `VERIFIED` only after `HeadObject` size matches. Temp files are deleted in `finally`.

Object key: `football/{year}/{month}/fixtures/{fixtureId}/assets/{sha256}.mp4`.

## 5. Database

New tables only: `highlight_stored_assets` and `highlight_ingestions`. No video bytes, base64, or frames. `MatchHighlight` columns are unchanged. Migration: `prisma/migrations/20261120180000_highlight_video_storage/migration.sql` (additive). If the tables are missing, the highlights read path logs and keeps the external URL.

## 6. Deduplication

Unique `checksum`. A second clip that hashes to a `VERIFIED` asset links to that row and does not upload. Concurrent creates handle Prisma `P2002` by re-reading the row. Claim uses `updateMany` from `PENDING_INGESTION`/`FAILED` to `DOWNLOADING`.

## 7. Security

Downloads allow only `http(s)`, block localhost/private/link-local addresses, and recheck every redirect. YouTube, `streama.in`, and `x.com` stay external. Hosts must be on `VIDEO_STORAGE_ALLOWED_HOSTS`. Size cap defaults to 80 MB and is enforced while streaming, not from `Content-Length` alone. R2 secrets stay on the server. Public playback URLs use `R2_MEDIA_PUBLIC_URL` only for `VERIFIED` assets.

## 8. Playback

`playbackUrls` is `[owned CDN URL, original URL]` when verified. `url` becomes the owned URL so older clients prefer it. The mobile summary list and goal candidate builder pass that order into the existing sheet. Unverified keys are never returned.

## 9. Cost controls

Env caps: concurrent downloads, retries, monthly GB, total GB, max file size. Budget exceeded records `BUDGET_EXCEEDED` and leaves the external URL. No historical backfill. `dryRunHighlightStorageOrphans` only logs unreferenced assets. Duration cap is configured (`VIDEO_STORAGE_MAX_DURATION_SECONDS`) and is not measured in this worker (no ffprobe pass).

## 10. Testing

| Check | Result |
|---|---|
| Prisma schema validate | PASS |
| Storage unit tests (11) | PASS |
| Highlightly sync/read tests | PASS |
| Front P0/P1 playback tests (37) | PASS |
| Real R2 upload | NOT RUN (storage flag off, no test bucket write) |
| HTTP Range against a CDN copy | NOT RUN |
| Production migration | NOT RUN |

## 11. Android emulator

| Item | Result |
|---|---|
| Device | `emulator-5554` `sdk_gphone64_x86_64` |
| App | `com.mhmdsh1892.ninetyplusapp` resumed on Expo dev client |
| Screen seen | Arabic matches home (leagues visible, not a login wall) |
| Goal / highlight playback | BLOCKED — opening the finished filter hit the date picker; no goal clip was played, so picture motion was not verified |
| Owned R2 URL on device | NOT RUN |

## 12. iOS

Code path is unchanged aside from receiving `playbackUrls` when the API sends them. No iPhone session was run. Do not treat this as device playback success.

## 13. Files

- `prisma/schema.prisma`, `prisma/migrations/20261120180000_highlight_video_storage/migration.sql`
- `src/services/highlight-storage/*` (eligibility, download, ingest, object store, playback, cleanup)
- `src/queues/highlight-video-ingest.queue.ts`
- `src/services/highlightly/match-highlights-sync.service.ts` (enqueue only)
- `src/services/highlightly/match-highlights.service.ts` and `highlightly.policy.ts`
- `src/main.ts` (start worker when the flag is on)
- `front/services/apiFootball.ts`, `front/utils/assignGoalClips.ts`, `front/utils/goalClipPlaybackCandidates.ts`, `front/app/(tabs)/match-details.tsx`
- `.env.example`

Highlightly ranking, Mux, and Reels players were not rewritten.

## 14. Migrations

Additive create-table only. Not executed against production here.

## 15. Environment names

`VIDEO_STORAGE_ENABLED`, `VIDEO_STORAGE_MAX_FILE_SIZE_MB`, `VIDEO_STORAGE_MAX_DURATION_SECONDS`, `VIDEO_STORAGE_MAX_CONCURRENT_DOWNLOADS`, `VIDEO_STORAGE_MAX_RETRIES`, `VIDEO_STORAGE_RETRY_DELAY`, `VIDEO_STORAGE_RETENTION_DAYS`, `VIDEO_STORAGE_MAX_MONTHLY_INGESTION_GB`, `VIDEO_STORAGE_MAX_TOTAL_GB`, `VIDEO_STORAGE_ALLOWED_HOSTS`, plus existing `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_MEDIA_BUCKET_NAME`, `R2_MEDIA_PUBLIC_URL`.

## 16. Remaining risks

Allowlist must be a legal decision before any real download. R2 Range playback is unverified on device. Worker duration is not measured. Applying the migration is required before ingest rows can be stored.

## 17. Build readiness

Safe for an internal build with the flag **off**. Not ready to turn ingestion on in production.

## 18. Recommendation

Apply the additive migration in a non-production database first. Confirm redistribution rights, then set the allowlist to specific CDN hosts and enable the flag for new clips only. Re-test a known-good MP4 and a 404 on the emulator before any production enablement.
