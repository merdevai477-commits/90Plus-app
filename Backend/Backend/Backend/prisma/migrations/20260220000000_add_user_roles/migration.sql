-- Add role enum and field to User model
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- Add role column with default USER
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- Create index for role queries
CREATE INDEX "users_role_idx" ON "users"("role");
