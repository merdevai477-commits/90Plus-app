---
inclusion: always
---

# Env Vars, Migrations, and Cache Keys

This file is the source of truth for where configuration, secrets, and migration metadata live in the project. Any new code that adds environment variables, schema migrations, or cache keys must follow these rules — no exceptions.

## Environment Variables

- **All secrets, API keys, URLs, feature flags, and tunable constants** belong in `.env`.
  - Backend root: `c:\Football-app\.env` (loaded by Node via `dotenv`)
  - Frontend root: `c:\Football-app\front\.env` and `c:\Football-app\front\.env.production` (loaded by Expo via `expo-constants` / `EXPO_PUBLIC_*`)
- **Never** hardcode a secret, base URL, or third-party API key in source.
- When you introduce a new env var:
  1. Add it to `.env` with the actual local value.
  2. Add the **same key** to `.env.example` with a placeholder value (e.g. `your-key-here`, `https://example.com`) and a one-line comment explaining what it is and where to get it.
  3. If it is consumed on Railway / EAS, mention it in the commit body so deploy config can be updated.
  4. If it is `EXPO_PUBLIC_*`, also document that it ships to the client and must not contain secrets.
- Never read `process.env.X` outside of `src/config/` (backend) or `front/config/api.config.ts` (frontend) — those are the only places that translate raw env into typed module exports the rest of the code consumes.

## Database Migrations

- The **only** migration store is `c:\Football-app\prisma\migrations\`.
- Workflow:
  1. Edit `prisma/schema.prisma`.
  2. Generate a migration with a stable timestamp prefix and snake_case name (e.g. `20260520000000_add_users_xp_index`).
  3. The migration `migration.sql` lives in its own folder under `prisma/migrations/<name>/`.
  4. Use `CREATE INDEX CONCURRENTLY` for index additions on live tables so deploys don't block writes.
  5. Run `ANALYZE "<table>"` at the end of any index-adding migration so PostgreSQL picks up the new statistics.
- **Never edit an applied migration.** If a migration is already on `main`, write a new one to fix it.
- Connection string is `DATABASE_URL` in `.env` (Neon / Railway PG). Do not duplicate it.
- For test scripts that touch the DB, gate them behind `process.env.NODE_ENV !== 'production'`.

## Cache Keys & TTLs

- Redis is the canonical cache; client is `src/lib/redis.ts` (singleton). Do not instantiate new clients.
- Naming: `<domain>:<id>[:<sub>]` lowercase, colons as separators (e.g. `user:abc123`, `match:99887:lineups`, `football:fixtures:date:2026-05-20`).
- TTLs are defined in the same module that owns the data. Match the TTL to volatility:
  - Live data (live scores, in-progress events) → 8–30s
  - Hot reads (today's fixtures, leaderboards) → 1–5 min
  - Profiles, teams, leagues → 5 min – 1 h
  - Finished matches, historical data → 24 h – permanent
- HTTP-level shared cache: use `responseCacheMiddleware({ ttl, sharedCache: true })` in `src/middleware/responseCache.middleware.ts` only for endpoints whose response is the same for all users (no userId in the key).
- The Redis URL is `REDIS_URL` in `.env`. If it is missing, services must degrade to in-memory caches and log a warning — never crash.

## Quick Reference for AI Agents

If a request mentions:
- "migration" / "schema change" → write SQL in `prisma/migrations/<timestamp>_<name>/migration.sql` and update `prisma/schema.prisma`.
- "env" / "secret" / "API key" / "config" → put the value in `.env`, the placeholder in `.env.example`.
- "cache" / "Redis" / "TTL" → use the namespacing rules above and the existing `src/lib/redis.ts` singleton.
- "where do I store X" → if it's runtime config, it's `.env`. If it's persistent data, it's the database via Prisma.
