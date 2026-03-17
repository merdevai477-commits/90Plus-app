#!/bin/bash
# Setup Fly.io secrets from .env file
# Run this after creating your Fly.io app

echo "Setting up Fly.io secrets..."

# Read from .env and set secrets
# Note: DATABASE_URL will be set automatically by fly postgres attach

fly secrets set \
  NODE_ENV="production" \
  CLERK_SECRET_KEY="$(grep CLERK_SECRET_KEY .env | cut -d '=' -f2)" \
  CLERK_PUBLISHABLE_KEY="$(grep CLERK_PUBLISHABLE_KEY .env | cut -d '=' -f2)" \
  CLERK_WEBHOOK_SECRET="$(grep CLERK_WEBHOOK_SECRET .env | cut -d '=' -f2)" \
  SUPABASE_URL="$(grep SUPABASE_URL .env | cut -d '=' -f2)" \
  SUPABASE_ANON_KEY="$(grep SUPABASE_ANON_KEY .env | cut -d '=' -f2)" \
  SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY .env | cut -d '=' -f2)" \
  CLOUDINARY_CLOUD_NAME="$(grep CLOUDINARY_CLOUD_NAME .env | cut -d '=' -f2)" \
  CLOUDINARY_API_KEY="$(grep CLOUDINARY_API_KEY .env | cut -d '=' -f2)" \
  CLOUDINARY_API_SECRET="$(grep CLOUDINARY_API_SECRET .env | cut -d '=' -f2)" \
  FOOTBALL_API_KEY="$(grep FOOTBALL_API_KEY .env | cut -d '=' -f2)"

echo "✅ Secrets set successfully!"
echo "Note: Set REDIS_URL manually from Upstash console"
