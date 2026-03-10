# 🔧 Fix Database Connection Pool Exhaustion in Railway
# Run this script to update environment variables

Write-Host "🔧 Fixing database connection pool exhaustion..." -ForegroundColor Cyan
Write-Host ""

# Check if railway CLI is installed
$railwayExists = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railwayExists) {
    Write-Host "❌ Railway CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm i -g @railway/cli" -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Step 1: Set DATABASE_CONNECTION_POOL_SIZE" -ForegroundColor Green
railway variables set DATABASE_CONNECTION_POOL_SIZE=5

Write-Host ""
Write-Host "📋 Step 2: Disable keep-alive in production" -ForegroundColor Green
railway variables set DISABLE_KEEPALIVE=true

Write-Host ""
Write-Host "⚠️  Step 3: Update DATABASE_URL (manual)" -ForegroundColor Yellow
Write-Host ""
Write-Host "You need to manually update DATABASE_URL to include pool parameters:" -ForegroundColor White
Write-Host ""
Write-Host "Current DATABASE_URL should look like:" -ForegroundColor Gray
Write-Host "postgresql://[user]:[password]@[host]/[database]" -ForegroundColor Gray
Write-Host ""
Write-Host "Add these parameters at the end:" -ForegroundColor Cyan
Write-Host "?connection_limit=5&pool_timeout=10&connect_timeout=20" -ForegroundColor Cyan
Write-Host ""
Write-Host "Final format:" -ForegroundColor White
Write-Host "postgresql://[user]:[password]@[host]/[database]?connection_limit=5&pool_timeout=10&connect_timeout=20" -ForegroundColor Green
Write-Host ""
Write-Host "To update, run:" -ForegroundColor Yellow
Write-Host 'railway variables set DATABASE_URL="your-updated-url-here"' -ForegroundColor White
Write-Host ""

Write-Host "✅ Environment variables updated!" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Next steps:" -ForegroundColor Cyan
Write-Host "1. Update DATABASE_URL manually (see above)" -ForegroundColor White
Write-Host "2. Commit and push changes:" -ForegroundColor White
Write-Host '   git add Backend/src/lib/prisma.ts Backend/DATABASE_CONNECTION_FIX.md' -ForegroundColor Gray
Write-Host '   git commit -m "Fix database connection pool exhaustion"' -ForegroundColor Gray
Write-Host '   git push origin main' -ForegroundColor Gray
Write-Host ""
Write-Host "3. Verify in Railway logs after deployment" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
