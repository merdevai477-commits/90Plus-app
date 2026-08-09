# Knowledge Export API (Production)

Internal, read-only season-aware football export for the **Football Knowledge Factory**.

This API lives in the **90Plus production backend**. It does **not** create embeddings, call Bedrock, write to S3, or build vector documents.

---

## Endpoints

Base: `/api/internal/football/knowledge`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/seasons` | Distinct seasonKeys observed in `Cached365PlayerCareer` |
| GET | `/season/:seasonKey` | Season metadata + competitions found for that key |
| GET | `/season/:seasonKey/competitions` | Same competition list as season summary |
| GET | `/season/:seasonKey/competition/:competitionId` | Chunked teams + players + season stats |

Query params for competition export:

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `cursor` | int | none | `athleteId` cursor (exclusive lower bound) |
| `pageSize` | int | 100 | Max 250 careers scanned per request |
| `teamId` | int | none | Optional 365 team filter |

---

## Authentication

**Internal only.** Fail-closed if unset.

| Header | Value |
|--------|-------|
| `x-api-key` | `KNOWLEDGE_EXPORT_API_KEY` |
| or `x-knowledge-export-key` | same |

Rate limit: 60 req/min/key in production (300 in development). Trusted IPs (`TRUSTED_IPS`) can skip.

---

## Request examples

```bash
export KEY="$KNOWLEDGE_EXPORT_API_KEY"
export BASE="https://90plus.pro/api/internal/football/knowledge"

# Seasons
curl -s -H "x-api-key: $KEY" "$BASE/seasons"

# Season 2026 summary (label should resolve to 2025/2026)
curl -s -H "x-api-key: $KEY" "$BASE/season/2026"

# Competition chunk (Morocco Botola = 557 example)
curl -s -H "x-api-key: $KEY" \
  "$BASE/season/2026/competition/557?pageSize=100"

# Next page
curl -s -H "x-api-key: $KEY" \
  "$BASE/season/2026/competition/557?cursor=47349&pageSize=100"
```

---

## Season guarantee

| Field | Meaning |
|-------|---------|
| `seasonKey` | 365 career season key (string/int path). **Not** API-Football start-year. |
| `seasonLabel` | Human campaign label. |

**Proven in production `Cached365PlayerCareer`:**

`seasonKey=2026` → `seasonLabel=2025/2026` (majority European club campaigns).

Resolution order (single module: `src/utils/knowledge-season-resolver.util.ts`):

1. Provider career label when campaign-shaped (`YYYY/YYYY` or `YYYY/YY`)
2. Canonical 365 end-year map (includes `2026 → 2025/2026`)
3. Otherwise `unresolved` / low confidence

**Do not** use generic HTTP `?season=2026` for this export. That path is a different ID/season model and was not proven season-correct for membership.

---

## Response schema (competition export)

```json
{
  "status": "success",
  "dataset": {
    "provider": "90plus",
    "seasonKey": "2026",
    "seasonLabel": "2025/2026",
    "seasonResolveSource": "provider_career_label",
    "generatedAt": "2026-08-09T21:00:00.000Z",
    "schemaVersion": "1.0"
  },
  "competition": {
    "competitionId": 557,
    "leagueId": 7000557,
    "name": "الدوري المغربي",
    "country": null
  },
  "coverage": {
    "status": "PARTIAL",
    "membershipSource": "production_365_career",
    "reason": "Team/player membership is derived from Cached365PlayerCareer rows...",
    "seasonSpecific": true
  },
  "standings": null,
  "standingsAvailability": "not_season_proven",
  "fixtures": null,
  "fixturesAvailability": "not_season_proven",
  "teamStatistics": null,
  "teamStatisticsAvailability": "not_season_proven",
  "teams": [
    {
      "teamId": 123,
      "name": "…",
      "players": [
        {
          "athleteId": 47349,
          "playerId": null,
          "name": "…",
          "position": "…",
          "nationality": "…",
          "season": { "seasonKey": "2026", "seasonLabel": "2025/2026" },
          "statistics": {
            "appearances": 20,
            "minutes": 1800,
            "goals": 2,
            "assists": 5,
            "yellowCards": 3,
            "redCards": 0,
            "rating": 7.2
          },
          "source": {
            "provider": "90plus",
            "apiLayer": "365",
            "cacheTable": "cached_365_player_career"
          }
        }
      ]
    }
  ],
  "pagination": {
    "cursor": null,
    "nextCursor": 99999,
    "hasMore": true,
    "pageSize": 100,
    "scannedAthletes": 100
  },
  "metrics": {
    "teamCount": 2,
    "playerCount": 15,
    "statisticFieldCount": 90
  }
}
```

`leagueId` = `7_000_000 + competitionId` (synthetic 365 league id used elsewhere in production).

---

## Source of truth (audit table)

| ENTITY | SOURCE | SERVICE | DB MODEL | CACHE | EXTERNAL | SEASON-AWARE? | CONFIDENCE |
|--------|--------|---------|----------|-------|----------|---------------|------------|
| Season key/label | 365 career defs + resolver | `knowledge-season-resolver` | `Cached365PlayerCareer.data` | Redis career (upstream) | `/web/athletes/career?seasonKey=` | Yes | HIGH |
| Competition membership | Cached careers filtered by seasonKey | `knowledge-export.service` | `Cached365PlayerCareer` | — | (via prior career fetch) | Partial index | HIGH that source is honest; coverage PARTIAL |
| Team membership | Career competition rows | same | same | — | same | Yes (per seasonKey) | HIGH for proven rows |
| Player membership | Career competition rows | same | same | — | same | Yes | HIGH for proven rows |
| Player statistics | Career365CompetitionStat | same | same | — | same | Yes | HIGH |
| athleteId ↔ playerId | **None durable** | — | — | — | — | N/A | HIGH that mapping is absent → `playerId: null` |
| Team statistics | Not exported | — | — | — | — | Not season-proven for export | — |
| Standings | Not exported | 365 standings lack season param | `CachedStandings` | Redis | `/web/standings/` | Not proven | — |
| Fixtures | Not exported | Mixed calendar/season | `CachedFixture` | Redis | fixtures feeds | Not proven for this contract | — |
| Squads | Not used | API-Football squads | — | — | `/players/squads` | No | — |

---

## Coverage semantics

| Status | Meaning |
|--------|---------|
| `FULL` | Not returned by this API today (no complete season roster index). |
| `PARTIAL` | Data is season-specific where present, but membership is incomplete vs a full competition. |
| `UNKNOWN` | Reserved |

`membershipSource`: `production_365_career`

The Knowledge Factory should **quarantine or mark incomplete** any PARTIAL dataset before production RAG use.

---

## Performance architecture

- **No N+1 provider calls** on export: reads Postgres `cached_365_player_career` in pages.
- Cursor = `athleteId` ascending.
- Request-scoped Maps only; no global unbounded cache for export payloads.
- Max page size 250.
- Season/competition listing uses a bounded scan (up to 2000–5000 careers).

Factory ingestion pattern:

```
loop cursor:
  GET .../competition/{id}?cursor=&pageSize=100
  merge teams/players by teamId+athleteId
  until hasMore=false
```

---

## Security

- Dedicated API key (`KNOWLEDGE_EXPORT_API_KEY`)
- Not mounted under public `/api/football`
- Rate limited
- No AWS/provider secrets in responses
- No sensitive user/DB fields
- Structured auth failure logs (no key values)

---

## Observability

Structured logs under `[KnowledgeExport]`:

- seasonKey, competitionId, teamCount, playerCount, statisticFieldCount
- coverage, scannedAthletes, hasMore, durationMs
- auth failures (path + ip only)

---

## Tests

```bash
npx jest --runInBand \
  src/utils/__tests__/knowledge-season-resolver.util.test.ts \
  src/services/__tests__/knowledge-export.service.test.ts \
  src/middleware/__tests__/knowledge-export-auth.middleware.test.ts
```

Covered:

1. seasonKey=2026 → 2025/2026  
2. invalid seasonKey  
3. invalid competitionId  
4. season/competition mismatch (empty PARTIAL)  
5. duplicate players / teams  
6. missing durable playerId (`null`)  
7. statistics belong to requested season only  
8. PARTIAL coverage always for career-derived membership  
9. auth failure / missing key / success  
10. pagination fields on export result  

---

## Known limitations

1. **Membership is cache-bound** — only athletes previously written to `Cached365PlayerCareer` appear.
2. **No complete competition index** for a season → always `coverage.status = PARTIAL`.
3. **No athleteId ↔ API-Football playerId** durable map → `playerId` always `null`.
4. **Standings / fixtures / team stats omitted** — not season-proven for this contract.
5. **Country on competition** often null (not stored on career competition rows).
6. Calendar-year leagues may label seasonKey `2026` as `"2026"` rather than `2025/2026`; resolver prefers majority campaign-shaped labels.

---

## Rollback strategy

1. Unset `KNOWLEDGE_EXPORT_API_KEY` → endpoints fail closed (500 configured / 401 auth).
2. Or remove mount in `src/main.ts`:  
   `app.use(`${API_PREFIX}/internal/football/knowledge`, knowledgeExportRoutes)`
3. No DB migrations were introduced; rollback is code/config only.

---

## Files

| File | Role |
|------|------|
| `src/utils/knowledge-season-resolver.util.ts` | SeasonResolver |
| `src/services/knowledge-export.service.ts` | Export adapter |
| `src/controllers/knowledge-export.controller.ts` | HTTP |
| `src/routes/knowledge-export.routes.ts` | Routes + rate limit |
| `src/middleware/knowledge-export-auth.middleware.ts` | API key auth |
| `src/utils/scores365-league-id.util.ts` | Synthetic leagueId helper |

---

## Next step for Football Knowledge Factory

1. Set `KNOWLEDGE_EXPORT_API_KEY` in 90Plus production and Factory secrets.
2. Ingest with cursor pagination per `seasonKey` + `competitionId`.
3. Treat all responses as **PARTIAL** until a complete roster index exists.
4. Build canonical documents from returned teams/players/statistics only.
5. Do **not** call public `/api/football/*?season=` for season membership.
