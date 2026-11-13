-- Elite recognition badges. Additive only: new enums and tables.

CREATE TYPE "EliteBadgeCategory" AS ENUM ('PREDICTION', 'SCORERS', 'COACH', 'COMMUNITY', 'ENGAGEMENT', 'POINTS', 'COMPETITION');
CREATE TYPE "EliteBadgeRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

CREATE TABLE "elite_badge_definitions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" "EliteBadgeCategory" NOT NULL,
    "rarity" "EliteBadgeRarity" NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "elite_badge_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "elite_badge_definitions_key_key" ON "elite_badge_definitions"("key");
CREATE INDEX "elite_badge_definitions_category_idx" ON "elite_badge_definitions"("category");

CREATE TABLE "elite_badge_awards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "customTitle" TEXT NOT NULL,
    "description" TEXT,
    "competitionId" TEXT,
    "awardedBy" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "activeSlot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "elite_badge_awards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "elite_badge_awards_activeSlot_key" ON "elite_badge_awards"("activeSlot");
CREATE INDEX "elite_badge_awards_userId_createdAt_idx" ON "elite_badge_awards"("userId", "createdAt");
CREATE INDEX "elite_badge_awards_badgeId_idx" ON "elite_badge_awards"("badgeId");
CREATE INDEX "elite_badge_awards_competitionId_idx" ON "elite_badge_awards"("competitionId");
CREATE INDEX "elite_badge_awards_expiresAt_idx" ON "elite_badge_awards"("expiresAt");

CREATE TABLE "elite_badge_award_logs" (
    "id" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "elite_badge_award_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "elite_badge_award_logs_awardId_idx" ON "elite_badge_award_logs"("awardId");
CREATE INDEX "elite_badge_award_logs_createdAt_idx" ON "elite_badge_award_logs"("createdAt");

ALTER TABLE "elite_badge_awards"
    ADD CONSTRAINT "elite_badge_awards_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elite_badge_awards"
    ADD CONSTRAINT "elite_badge_awards_badgeId_fkey"
    FOREIGN KEY ("badgeId") REFERENCES "elite_badge_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "elite_badge_awards"
    ADD CONSTRAINT "elite_badge_awards_competitionId_fkey"
    FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "elite_badge_award_logs"
    ADD CONSTRAINT "elite_badge_award_logs_awardId_fkey"
    FOREIGN KEY ("awardId") REFERENCES "elite_badge_awards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "elite_badge_definitions" ("id", "key", "category", "rarity", "nameAr", "nameEn", "accent") VALUES
('ebd-prediction-streak', 'prediction_streak', 'PREDICTION', 'EPIC', 'أكبر سلسلة توقعات', 'Longest prediction streak', '#f5b942'),
('ebd-king-game', 'king_game', 'PREDICTION', 'LEGENDARY', 'ملك اللعبة', 'King of the game', '#f5b942'),
('ebd-king-results', 'king_results', 'PREDICTION', 'LEGENDARY', 'ملك النتائج', 'King of results', '#f5b942'),
('ebd-prediction-accuracy', 'prediction_accuracy', 'PREDICTION', 'RARE', 'الأدق في التوقعات', 'Most accurate predictor', '#6ea8ff'),
('ebd-competition-champion', 'competition_champion', 'COMPETITION', 'LEGENDARY', 'بطل المسابقة', 'Competition champion', '#f5b942'),
('ebd-scorers-overall', 'scorers_overall', 'SCORERS', 'EPIC', 'خماسي الهدافين', 'Top five scorers', '#f5b942'),
('ebd-scorers-europe', 'scorers_europe', 'SCORERS', 'EPIC', 'خماسي هدافين أوروبا', 'European top scorers', '#3b82f6'),
('ebd-scorers-egypt', 'scorers_egypt', 'SCORERS', 'EPIC', 'خماسي هدافين مصر', 'Egyptian top scorers', '#ff5c7a'),
('ebd-scorers-streak', 'scorers_streak', 'SCORERS', 'RARE', 'سلسلة خماسي الهدافين', 'Top scorers streak', '#fb923c'),
('ebd-coach', 'coach', 'COACH', 'LEGENDARY', 'ملك المدربين', 'Coach master', '#e5e7eb'),
('ebd-coach-tactics', 'coach_tactics', 'COACH', 'RARE', 'أفضل أداء تكتيكي', 'Best tactical performance', '#94a3b8'),
('ebd-community-activity', 'community_activity', 'COMMUNITY', 'RARE', 'الأكثر تفاعلاً في المجتمع', 'Most active community member', '#e5e7eb'),
('ebd-shares', 'shares', 'COMMUNITY', 'RARE', 'الأكثر مشاركة', 'Most shared', '#cbd5e1'),
('ebd-posts', 'posts', 'COMMUNITY', 'COMMON', 'أكثر المنشورات', 'Most published posts', '#2dd4bf'),
('ebd-reels', 'reels', 'COMMUNITY', 'COMMON', 'أكثر الريلز', 'Most published reels', '#c084fc'),
('ebd-reel-engagement', 'reel_engagement', 'COMMUNITY', 'EPIC', 'أكثر الريلز تفاعلاً', 'Most engaging reels', '#c084fc'),
('ebd-comments', 'comments', 'COMMUNITY', 'COMMON', 'أنشط المعلقين', 'Most active commenter', '#6ea8ff'),
('ebd-daily-streak', 'daily_streak', 'ENGAGEMENT', 'RARE', 'سلسلة تفاعل يومي', 'Daily engagement streak', '#c084fc'),
('ebd-activity-streak', 'activity_streak', 'ENGAGEMENT', 'EPIC', 'أطول سلسلة نشاط', 'Longest activity streak', '#e5e7eb'),
('ebd-points', 'points', 'POINTS', 'LEGENDARY', 'الأكثر حصولاً على النقاط', 'Highest points', '#f5b942'),
('ebd-ranking-champion', 'ranking_champion', 'POINTS', 'LEGENDARY', 'بطل الترتيب', 'Ranking champion', '#f5b942')
ON CONFLICT ("key") DO NOTHING;
