# ============================================
# EMERGENCY FIX: API Timeout Issue
# ============================================

Write-Host ""
Write-Host "🚨 EMERGENCY FIX: API Timeout" -ForegroundColor Red
Write-Host ""

Write-Host "📦 Adding files..." -ForegroundColor Yellow
git add front/config/api.config.ts
git add front/src/services/authService.ts

Write-Host "💬 Creating commit..." -ForegroundColor Yellow
git commit -m "🚨 EMERGENCY: Fix API timeout (500ms -> 30s)

Critical fix for API timeout issue causing all requests to fail.

Changes:
* Increased timeout from 10s to 30s in api.config.ts
* Increased timeout from 10s to 30s in authService.ts
* Increased retry attempts from 2 to 3

This fixes:
* /api/coins/balance timeout
* /api/clerk/me timeout
* /api/daily-spin/status timeout
* /api/quiz/daily-status timeout
* All other API timeouts"

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
Write-Host "✅ EMERGENCY FIX DEPLOYED!" -ForegroundColor Green
Write-Host ""
Write-Host "⏰ Wait 2-5 minutes for Railway to deploy" -ForegroundColor Cyan
Write-Host "🔄 Then restart the app" -ForegroundColor Cyan
Write-Host ""
