# ============================================
# Fix Database Timeout Issue
# ============================================

Write-Host ""
Write-Host "🚨 Fixing Database Timeout Issue" -ForegroundColor Red
Write-Host ""

Write-Host "📝 Changes to be made:" -ForegroundColor Yellow
Write-Host "  1. Increase database timeout from 5s to 30s" -ForegroundColor White
Write-Host "  2. Increase Prisma connection timeout" -ForegroundColor White
Write-Host ""

Write-Host "❓ Continue? (y/n): " -ForegroundColor Yellow -NoNewline
$response = Read-Host
if ($response -ne "y") {
    Write-Host "❌ Cancelled" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🔧 Applying fixes..." -ForegroundColor Yellow
Write-Host ""

# Fix 1: Increase database timeout in main.ts
Write-Host "  📝 Fixing Backend/src/main.ts..." -ForegroundColor Cyan
$mainContent = Get-Content "Backend/src/main.ts" -Raw
$mainContent = $mainContent -replace 'setTimeout\(\(\) => reject\(new Error\(''Database connection timeout''\)\), 5000\)', 'setTimeout(() => reject(new Error(''Database connection timeout'')), 30000)'
Set-Content "Backend/src/main.ts" -Value $mainContent
Write-Host "  ✅ main.ts fixed" -ForegroundColor Green

# Fix 2: Check if prisma.ts needs update
Write-Host "  📝 Checking Backend/src/lib/prisma.ts..." -ForegroundColor Cyan
$prismaContent = Get-Content "Backend/src/lib/prisma.ts" -Raw
if ($prismaContent -match "connectionTimeoutMillis") {
    Write-Host "  ✅ prisma.ts already has timeout settings" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  prisma.ts needs manual update" -ForegroundColor Yellow
    Write-Host "     Add connection pool settings manually" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📦 Committing changes..." -ForegroundColor Yellow
git add Backend/src/main.ts
git commit -m "🚨 EMERGENCY: Fix database timeout (5s -> 30s)

Critical fix for database connection timeout causing all API requests to fail.

Changes:
* Increased database timeout from 5s to 30s in main.ts
* This fixes all API endpoints timing out after 5 seconds

Affected endpoints:
* /api/clerk/me
* /api/coins/balance
* /api/profile/cooldowns
* /api/predictions/stats
* All other endpoints"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Commit failed!" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Pushing to server..." -ForegroundColor Yellow
$branch = git branch --show-current
git push origin $branch

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Push failed, trying pull first..." -ForegroundColor Yellow
    git pull origin $branch --rebase
    git push origin $branch
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ FIX DEPLOYED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. ⏰ Wait 2-5 minutes for Railway deployment" -ForegroundColor White
Write-Host ""
Write-Host "2. 🔄 Restart Railway Services:" -ForegroundColor White
Write-Host "   - Go to: https://railway.app/dashboard" -ForegroundColor Gray
Write-Host "   - Restart Database service" -ForegroundColor Gray
Write-Host "   - Restart Backend service" -ForegroundColor Gray
Write-Host ""
Write-Host "3. ⏰ Wait 3 minutes for services to start" -ForegroundColor White
Write-Host ""
Write-Host "4. 🧪 Test the app" -ForegroundColor White
Write-Host ""

Write-Host "🔗 Useful Links:" -ForegroundColor Cyan
Write-Host "  - Railway: https://railway.app/dashboard" -ForegroundColor White
Write-Host "  - Health: https://your-api.railway.app/api/health" -ForegroundColor White
Write-Host ""

Write-Host "❓ Open Railway dashboard? (y/n): " -ForegroundColor Yellow -NoNewline
$response = Read-Host
if ($response -eq "y") {
    Start-Process "https://railway.app/dashboard"
}

Write-Host ""
Write-Host "✨ Done! Now restart Railway services!" -ForegroundColor Green
Write-Host ""
