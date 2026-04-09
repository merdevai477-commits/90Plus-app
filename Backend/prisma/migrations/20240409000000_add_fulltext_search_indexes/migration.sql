-- Add Full-Text Search GIN indexes for username and displayName
-- These indexes enable fast text search with ranking support

-- Create GIN index for username with English text search configuration
CREATE INDEX IF NOT EXISTS idx_users_username_gin_en 
ON users USING gin(to_tsvector('english', username));

-- Create GIN index for displayName with English text search configuration
CREATE INDEX IF NOT EXISTS idx_users_displayname_gin_en 
ON users USING gin(to_tsvector('english', COALESCE("displayName", '')));

-- Create GIN index for username with Simple text search configuration (works for Arabic)
CREATE INDEX IF NOT EXISTS idx_users_username_gin_simple 
ON users USING gin(to_tsvector('simple', username));

-- Create GIN index for displayName with Simple text search configuration (works for Arabic)
CREATE INDEX IF NOT EXISTS idx_users_displayname_gin_simple 
ON users USING gin(to_tsvector('simple', COALESCE("displayName", '')));

-- Create composite GIN index for combined search (English)
CREATE INDEX IF NOT EXISTS idx_users_combined_search_gin_en 
ON users USING gin(
  (to_tsvector('english', username) || to_tsvector('english', COALESCE("displayName", '')))
);

-- Create composite GIN index for combined search (Simple - for Arabic)
CREATE INDEX IF NOT EXISTS idx_users_combined_search_gin_simple 
ON users USING gin(
  (to_tsvector('simple', username) || to_tsvector('simple', COALESCE("displayName", '')))
);
