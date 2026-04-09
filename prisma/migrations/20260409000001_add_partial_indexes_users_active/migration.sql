-- Partial indexes for soft-deleted users
-- Keeps indexes small and improves query performance by excluding isDeleted = true rows.

CREATE INDEX IF NOT EXISTS idx_users_username_active
  ON users (username)
  WHERE "isDeleted" = false;

CREATE INDEX IF NOT EXISTS idx_users_displayname_active
  ON users ("displayName")
  WHERE "isDeleted" = false;

CREATE INDEX IF NOT EXISTS idx_users_search_active
  ON users (LOWER(username), LOWER("displayName"))
  WHERE "isDeleted" = false;

