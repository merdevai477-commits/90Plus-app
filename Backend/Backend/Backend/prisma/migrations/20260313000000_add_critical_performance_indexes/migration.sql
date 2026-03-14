-- ============================================
-- CRITICAL PERFORMANCE INDEXES
-- These indexes optimize the most common queries
-- Target: 10-100x faster database queries
-- ============================================

-- User Performance Indexes
-- For profile lookup (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_clerkUserId_username_idx" 
  ON "users"("clerkUserId", "username");

-- For search and verification
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_username_isVerified_idx" 
  ON "users"("username", "isVerified");

-- For rankings and leaderboards
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_level_coins_idx" 
  ON "users"("level" DESC, "coins" DESC);

-- For active users analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_lastLoginDate_idx" 
  ON "users"("lastLoginDate" DESC) 
  WHERE "lastLoginDate" IS NOT NULL;

-- Reel Performance Indexes
-- For user's reels feed
CREATE INDEX CONCURRENTLY IF NOT EXISTS "reels_userId_createdAt_idx" 
  ON "reels"("userId", "createdAt" DESC);

-- Follow Performance Indexes
-- For followers list
CREATE INDEX CONCURRENTLY IF NOT EXISTS "follows_followerId_createdAt_idx" 
  ON "follows"("followerId", "createdAt" DESC);

-- For following list
CREATE INDEX CONCURRENTLY IF NOT EXISTS "follows_followingId_createdAt_idx" 
  ON "follows"("followingId", "createdAt" DESC);

-- Comment Performance Indexes
-- For reel comments with replies
CREATE INDEX CONCURRENTLY IF NOT EXISTS "comments_reelId_parentId_createdAt_idx" 
  ON "comments"("reelId", "parentId", "createdAt" DESC);

-- Notification Performance Indexes
-- For unread notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS "notifications_userId_isRead_createdAt_idx" 
  ON "notifications"("userId", "isRead", "createdAt" DESC);

-- Quiz Performance Indexes
-- For user quiz history
CREATE INDEX CONCURRENTLY IF NOT EXISTS "quiz_attempts_userId_completedAt_idx" 
  ON "quiz_attempts"("userId", "completedAt" DESC);

-- For quiz leaderboards
CREATE INDEX CONCURRENTLY IF NOT EXISTS "quiz_attempts_categoryId_score_idx" 
  ON "quiz_attempts"("categoryId", "score" DESC);

-- Coin Transaction Performance Indexes
-- For user transaction history
CREATE INDEX CONCURRENTLY IF NOT EXISTS "coin_transactions_userId_createdAt_idx" 
  ON "coin_transactions"("userId", "createdAt" DESC);

-- Cached Fixture Performance Indexes
-- For match listings by date
CREATE INDEX CONCURRENTLY IF NOT EXISTS "cached_fixtures_matchDate_leagueId_idx" 
  ON "cached_fixtures"("matchDate" DESC, "leagueId");

-- For live matches
CREATE INDEX CONCURRENTLY IF NOT EXISTS "cached_fixtures_status_matchDate_idx" 
  ON "cached_fixtures"("status", "matchDate" DESC);

-- ============================================
-- PARTIAL INDEXES (for specific conditions)
-- These are smaller and faster than full indexes
-- ============================================

-- Active users only (logged in last 30 days)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_active_level_idx" 
  ON "users"("level" DESC) 
  WHERE "lastLoginDate" > NOW() - INTERVAL '30 days';

-- Non-deleted reels only
CREATE INDEX CONCURRENTLY IF NOT EXISTS "reels_active_views_idx" 
  ON "reels"("views" DESC) 
  WHERE "isDeleted" = false;

-- Unread notifications only
CREATE INDEX CONCURRENTLY IF NOT EXISTS "notifications_unread_idx" 
  ON "notifications"("userId", "createdAt" DESC) 
  WHERE "isRead" = false;

-- ============================================
-- TEXT SEARCH INDEXES (for search functionality)
-- ============================================

-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Team search (fuzzy matching)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "cached_teams_name_trgm_idx" 
  ON "cached_teams" USING gin(name gin_trgm_ops);

-- Player search (fuzzy matching)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "cached_players_name_trgm_idx" 
  ON "cached_players" USING gin(name gin_trgm_ops);

-- ============================================
-- ANALYZE TABLES (update statistics)
-- This helps PostgreSQL choose the best query plans
-- ============================================

ANALYZE "users";
ANALYZE "reels";
ANALYZE "follows";
ANALYZE "comments";
ANALYZE "notifications";
ANALYZE "quiz_attempts";
ANALYZE "coin_transactions";
ANALYZE "cached_fixtures";
ANALYZE "cached_teams";
ANALYZE "cached_players";
