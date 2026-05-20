-- Add a composite index on (xp DESC, level DESC) so the rank-screen
-- leaderboard query (ORDER BY xp DESC, level DESC LIMIT 50) can be served
-- by a single index scan instead of a full table sort once the user base
-- grows. The (xp) single-column index is also kept because Prisma generates
-- it from the schema-level @@index([xp]) declaration.
--
-- Created concurrently so it doesn't block writes on the live table.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_xp_idx"
  ON "users" ("xp" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_xp_level_idx"
  ON "users" ("xp" DESC, "level" DESC);

ANALYZE "users";
