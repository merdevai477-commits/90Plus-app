-- Create case-insensitive indexes for user search
-- These indexes enable fast case-insensitive searches on username and displayName
-- Using LOWER() function for case-insensitive matching

CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_displayname_lower ON users(LOWER(displayName));

