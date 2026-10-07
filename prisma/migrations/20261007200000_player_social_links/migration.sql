-- Official Facebook / Instagram pages per player (365Scores athleteId), set by admins.
CREATE TABLE "player_social_links" (
    "athleteId" INTEGER NOT NULL,
    "name" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_social_links_pkey" PRIMARY KEY ("athleteId")
);
