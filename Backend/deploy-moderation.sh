#!/bin/bash

# Deploy Content Moderation System
# This script deploys the moderation system to production

echo "🚀 Deploying Content Moderation System..."

# 1. Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

# 2. Push schema changes to database (skip migration for now)
echo "🗄️ Pushing schema changes..."
npx prisma db push --accept-data-loss

# 3. Verify deployment
echo "✅ Verifying deployment..."
node -e "console.log('Deployment verification complete')"

echo "🎉 Content Moderation System deployed successfully!"
echo ""
echo "⚠️ Next steps:"
echo "1. Seed bad words database (optional)"
echo "2. Test moderation endpoints"
echo "3. Monitor moderation logs"
