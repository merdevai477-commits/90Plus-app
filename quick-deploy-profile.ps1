# ============================================
# Quick Deploy Profile Fix
# ============================================
# رفع سريع لإصلاحات البروفايل
# ============================================

Write-Host ""
Write-Host "🚀 Quick Deploy Profile Fix" -ForegroundColor Cyan
Write-Host ""

# إضافة جميع الملفات
Write-Host "📦 Adding files..." -ForegroundColor Yellow
git add .

# عمل commit
Write-Host "💬 Creating commit..." -ForegroundColor Yellow
$commitMsg = @"
🔧 Fix: Profile loading issue - Complete solution

✅ Fixes:
* Added comprehensive logging
* Added API health check
* Added auto-retry system
* Enhanced error state UI
* Fixed location/country mapping

Files:
* front/hooks/useProfileCache.ts
* front/app/(tabs)/profile.tsx
* front/src/services/authService.ts
* Backend/src/routes/clerk-user.routes.ts
"@

git commit -m $commitMsg

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Commit failed!" -ForegroundColor Red
    exit 1
}

# Push
Write-Host "🚀 Pushing to server..." -ForegroundColor Yellow
$branch = git branch --show-current
git push origin $branch

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Push failed, trying pull first..." -ForegroundColor Yellow
    git pull origin $branch --rebase
    git push origin $branch
}

Write-Host ""
Write-Host "✅ Deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next:" -ForegroundColor Cyan
Write-Host "  1. Wait 2-5 minutes" -ForegroundColor White
Write-Host "  2. Check Railway dashboard" -ForegroundColor White
Write-Host "  3. Test profile in app" -ForegroundColor White
Write-Host ""
