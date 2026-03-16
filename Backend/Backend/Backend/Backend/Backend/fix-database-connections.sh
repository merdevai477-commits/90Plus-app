#!/bin/bash

# 🔧 Fix Database Connection Pool Exhaustion in Railway
# Run this script to update environment variables

echo "🔧 Fixing database connection pool exhaustion..."
echo ""

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   npm i -g @railway/cli"
    exit 1
fi

echo "📋 Step 1: Set DATABASE_CONNECTION_POOL_SIZE"
railway variables set DATABASE_CONNECTION_POOL_SIZE=5

echo ""
echo "📋 Step 2: Disable keep-alive in production"
railway variables set DISABLE_KEEPALIVE=true

echo ""
echo "⚠️  Step 3: Update DATABASE_URL (manual)"
echo ""
echo "You need to manually update DATABASE_URL to include pool parameters:"
echo ""
echo "Current DATABASE_URL should look like:"
echo "postgresql://[user]:[password]@[host]/[database]"
echo ""
echo "Add these parameters at the end:"
echo "?connection_limit=5&pool_timeout=10&connect_timeout=20"
echo ""
echo "Final format:"
echo "postgresql://[user]:[password]@[host]/[database]?connection_limit=5&pool_timeout=10&connect_timeout=20"
echo ""
echo "To update, run:"
echo "railway variables set DATABASE_URL=\"your-updated-url-here\""
echo ""

echo "✅ Environment variables updated!"
echo ""
echo "📦 Next steps:"
echo "1. Update DATABASE_URL manually (see above)"
echo "2. Commit and push changes:"
echo "   git add Backend/src/lib/prisma.ts"
echo "   git commit -m 'Fix database connection pool exhaustion'"
echo "   git push origin main"
echo ""
echo "3. Verify in Railway logs after deployment"
echo ""
