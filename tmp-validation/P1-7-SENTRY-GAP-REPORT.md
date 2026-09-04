# P1-7 Empty Backoff + Sentry MCP Gap — Final Report

**Date:** 2026-09-04  
**Scope:** Task 1 (live empty-upstream storm) + Task 2 (Sentry visibility)

---

## Task 1 — Empty-upstream backoff for live fixtures

### Diagnosis (pre-fix)

| Item | Finding |
|------|---------|
| **Storm source** | `football-data-cache.service.ts` — `getMatchEvents` (365 path) and `getMatchLineups` (365 empty → API fallback) |
| **Trigger** | Time-based re-polls every ~60s from `otherLeaguesSync` live tick, `sync365SyntheticLiveSnapshots` (`forceRefresh: true`), HTTP detail polls — **no backoff on live empty** |
| **Terminal path** | Phase 1 latch (`isTerminalLatched`) correctly suppresses finished fixtures — confirmed on prod fixture 4732070 |
| **Live empty gap** | Live fixtures with `upstream_empty` were **not cached** (only terminal/finished cached empty), so every tick re-escalated 365 → force → EN → API |
| **Empty vs error** | `upstream_empty` is logged explicitly (`reason=upstream_empty`); timeouts/HTTP failures use separate log paths — distinguishable |

### Fix implemented

New `empty-upstream-backoff.service.ts`:

- Redis key: `football:empty_streak:{fixtureId}` (6h TTL)
- Backoff steps: **60s → 120s → 240s → cap 300s**
- `shouldSkipEmptyUpstreamPoll()` gates upstream calls before escalation
- `recordEmptyUpstreamResult()` on consecutive empties; `recordNonEmptyUpstreamResult()` resets streak on real data
- Wired into `getMatchEvents` + `getMatchLineups` (365 paths only, live non-terminal)
- Terminal handoff: `clearEmptyUpstreamBackoff()` on `writeTerminalFixtureSnapshot()`
- Logs: `[EmptyBackoff] fixture=… streak=N nextRetryInMs=… action=skip|empty`

### Test results

All 7 unit/integration tests pass (`empty-upstream-backoff.service.test.ts`):

| Test | Result |
|------|--------|
| Stepped backoff 60→120→240→300 cap | PASS |
| 3 consecutive empties → increasing intervals | PASS |
| Non-empty after 2 empties → streak reset, base cadence | PASS |
| Cap at 300s, no unbounded growth | PASS |
| 20 min @ 60s ticks: **21 baseline → 6 with backoff** (−71%) | PASS |
| Terminal handoff clears streak cleanly | PASS |
| Redis null → fail-open (no skip) | PASS |

### Call-frequency before vs after

| Scenario | Before (measured / modeled) | After (expected) |
|----------|----------------------------|------------------|
| **Production (pre-deploy)** | ~1 `[365Events]`/`[Lineups]` `upstream_empty` log per fixture per **~60s** during live empty window (Railway logs, fixtures 4778474 / 4845128) | — |
| **20-min simulation (unit test)** | 21 upstream attempts at fixed 60s cadence | **6 attempts** (60s, +120s, +240s, +300s, +300s, +300s) |
| **Production (post-deploy)** | *Pending deploy + live-match re-check* | Expect `[EmptyBackoff] action=skip` between attempts; upstream_empty rate should drop to ~6/20min/fixture worst case |

**Production re-check:** Deploy this commit, then grep Railway logs for `[365Events]`/`[Lineups]` `upstream_empty` vs `[EmptyBackoff]` over a live match window. Baseline from prior validation: ~20 calls/20min/fixture; target ≤6–8.

---

## Task 2 — Sentry MCP visibility gap

### Root cause

**Org/project mismatch between the MCP connector and where the mobile app actually reports.**

| | MCP connector | Mobile app (actual) |
|--|---------------|---------------------|
| **Org** | `90plus` (`https://de.sentry.io`) | `mrdev-pk` (`https://de.sentry.io/organizations/mrdev-pk/…`) |
| **Project queried** | `90plus-mobile` | **`90plus-app`** |
| **Access** | `90plus-backend` ✅ (20+ issues), `90plus-mobile` listed but **0 issues** | MCP gets **403** on `mrdev-pk`; org not in connector scope |

Evidence:

- `front/app.json` + `front/eas.json`: `organization: mrdev-pk`, `project: 90plus-app`
- `front/docs/SENTRY_FIND_CRASHES_AR.md`: dashboard at `…/mrdev-pk/issues/?project=90plus-app`
- MCP `find_organizations`: only `90plus` (not `mrdev-pk`)
- MCP `find_projects` under `90plus`: `90plus-backend`, `90plus-mobile` — no `90plus-app`
- MCP `search_issues project:90plus-mobile`: **0 issues**
- MCP `get_sentry_resource issueId=90PLUS-APP-K` under `90plus`: **404**
- MCP query `mrdev-pk`: **403 Forbidden**

The `90plus-mobile` project in the MCP-visible org appears to be an unused/empty shell. Real mobile crashes (including `90PLUS-APP-K`) live under **`mrdev-pk / 90plus-app`**, which this connector cannot read.

### Crash status (`90PLUS-APP-K`)

**Cannot confirm fixed or unfixed via MCP.** No access to the correct org/project.

Release-hash search on `90plus-backend` also returned no events tagged with commits `67e055471`–`ea13a2e27` (backend project; mobile releases are separate).

### Required action (outside Cursor)

Re-authenticate the Sentry MCP connector with a token that has access to **`mrdev-pk`** org and project **`90plus-app`**:

1. Cursor → Settings → MCP → Sentry plugin → re-auth / update token
2. Ensure the auth account is a member of org **`mrdev-pk`** with read access to project **`90plus-app`**
3. Optionally remove or ignore the empty `90plus-mobile` project in org `90plus` to avoid future confusion

After re-auth, re-run:

- `search_issues query=90PLUS-APP-K organizationSlug=mrdev-pk`
- Filter events with `lastSeen` after P2-9 deploy (`ea13a2e27`)
- Search releases tagged with fix-series commit hashes

Direct dashboard (manual): https://de.sentry.io/organizations/mrdev-pk/issues/?project=90plus-app

---

## Files changed (Task 1)

- `src/services/empty-upstream-backoff.service.ts` (new)
- `src/services/__tests__/empty-upstream-backoff.service.test.ts` (new)
- `src/utils/football-cache-keys.util.ts` — streak key prefix
- `src/services/football-data-cache.service.ts` — wire events/lineups
- `src/services/live-fixture-cache.service.ts` — clear streak on terminal write
