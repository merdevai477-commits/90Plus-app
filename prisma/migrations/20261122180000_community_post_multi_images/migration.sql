-- Allow up to 3 photos per community post (primary image* columns + images JSON).
ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "images" JSONB;
