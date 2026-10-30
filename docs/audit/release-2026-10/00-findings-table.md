# Pre-release findings — consolidated (2026-10-30)

Phase 1 complete. Per-feature reports: `01`–`06` in this folder.  
**Rule:** fix P0→P1→P2; ask approval only for DB schema/migration or auth changes.

## Ship readiness (before fixes)

| Feature | Status | Top blockers |
|---------|--------|--------------|
| ملك اللعبة (Game King) | READY WITH RISKS | GK-1..5 pending/void/settlement/auth UX |
| شارك واربح (Share & Win) | READY WITH RISKS | SW-1..4 copy + prize fairness |
| صفحة هدافين (Top Scorers) | **NOT READY** | **TS-1 P0** empty boards |
| ملك المدربين (Coaches King) | READY WITH RISKS | KC-1..3 confirm race / runtime DDL |
| البوستات والابلاغات | **NOT READY** | **PR-1 P0** terms API 500 |
| المباريات + Details | READY WITH RISKS | MT-1..2 empty events / SUSP in live |

## Consolidated table (P0–P1 only)

| ID | Feature | Sev | Evidence (summary) | Root cause | Proposed fix | Needs | Schema/auth? |
|----|---------|-----|--------------------|------------|--------------|-------|--------------|
| **TS-1** | Top Scorers | **P0** | Prod stats `leaderboards:[]`; 365 has tables | `parseAthletesStatsBoards` assumes array; live shape `{tables,filters}` | Normalize `athletesStats` → tables array | Railway + cache purge | N |
| **PR-1** | Posts/UGC | **P0** | `GET /api/terms/latest` 500 ENOENT | `.md` not copied into `dist` | Copy `src/data/*.md` in build | Railway deploy | N |
| TS-2 | Top Scorers | P1 | Empty SUCCESS `x-cache: HIT` | Empty miss treated as cacheable success | Avoid caching unavailable / short TTL | Railway | N |
| TS-3 | Top Scorers | P1 | Error ≡ empty UI | No distinct error branch | Retry CTA on `_meta.unavailable` | OTA | N |
| GK-1 | Game King | P1 | PST/ABD stuck; voided=0 | `PREDICTION_VOID_ENABLED` off | Enable void or surface pending UX | Railway env | Y (env) |
| GK-2 | Game King | P1 | Fixture 4870902 SETTLE_SOURCE_CONFLICT | Cache ABD vs provider FT | Reconcile cache / settle under lock | Railway | N |
| GK-3 | Game King | P1 | resettle_runs=0 | Legacy wrong settlements | Controlled resettle | Railway + ops | Y (writes) |
| GK-4 | Game King | P1 | coin `prediction:%` = 0 | Coin idempotency unused/failing | Observe next correct settle | Observe | N |
| GK-5 | Game King | P1 | 401s on leaderboard/POST | No 401→refresh→retry | Client retry once | OTA | N |
| SW-1 | Share & Win | P1 | UI «شهري» vs ISO weeks | Copy mismatch | Locales → أسبوعي/weekly | OTA | N |
| SW-2 | Share & Win | P1 | StatsBar labels score as XP | score≠XP currency | Relabel + show 50 XP | OTA | N |
| SW-3 | Share & Win | P1 | Hero «كل مشاركة = XP» | SCORE_PER_SHARE=0 | Copy = converted friends | OTA | N |
| SW-4 | Share & Win | P1 | W43 winner 0 referrals | Share-farming ranks | Require participants>0 for prizes | Railway (±OTA) | N |
| KC-1 | Coaches King | P1 | `confirming={false}` | Busy flag not wired | Wire confirming state | OTA | N |
| KC-2 | Coaches King | P1 | Concurrent pick race | No FOR UPDATE | Transaction + lock | Railway | N |
| KC-3 | Coaches King | P1 | Runtime ALTER on request | Hot-path DDL | Migrations only | Railway | Y (process) |
| PR-2 | Posts | P1 | Soft-deleted authors in feed | No `isDeleted` filter | Filter in queryPosts | Railway | N |
| PR-3 | Posts | P1 | R2 orphans on delete | No community media cleanup | Delete R2 on soft-delete/purge | Railway | N |
| PR-4 | Posts | P1 | Admin reports reel-only | Community not in admin queue | Wire community targets | Railway | N |
| PR-5 | Posts | P1 | Self-report reel comment | Missing self-check | Mirror reel guard | Railway | N |
| MT-1 | Matches | P1 | ~37% live empty `/events` | EmptyBackoff / upstream gaps | Synthetic goals / shorter backoff | Railway (±OTA) | N |
| MT-2 | Matches | P1 | Long SUSP in `/fixtures/live` | No age-out | Age-out SUSP from live | Railway | N |

P2/P3: see individual reports `01`–`06`.

## Fix order (Phase 3)

1. **TS-1** + terms packaging (**PR-1** / MT-6) — no approval needed  
2. TS-2 cache behavior if still needed after TS-1  
3. P1 non-schema: KC-1, PR-2, PR-5, SW-1..3 (OTA), MT-1/2, GK-5, GK-6, KC-2  
4. Ask before: GK-1 env, GK-3 resettle writes, KC-3/KC-7/PR-6 migrations  
