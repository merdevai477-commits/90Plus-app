# ============================================
# Deploy Profile Fix to Server
# ============================================
# هذا السكريبت يرفع إصلاحات البروفايل للسيرفر
# ============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🚀 Deploy Profile Fix to Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# التحقق من وجود تغييرات
Write-Host "📊 Checking for changes..." -ForegroundColor Yellow
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "✅ No changes to commit" -ForegroundColor Green
    Write-Host ""
    Write-Host "❓ Do you want to push anyway? (y/n): " -ForegroundColor Yellow -NoNewline
    $response = Read-Host
    if ($response -ne "y") {
        Write-Host "❌ Deployment cancelled" -ForegroundColor Red
        exit 0
    }
} else {
    Write-Host "📝 Changes detected:" -ForegroundColor Green
    git status --short
    Write-Host ""
}

# إضافة جميع الملفات
Write-Host "📦 Adding all files..." -ForegroundColor Yellow
git add .

# التحقق من الملفات المضافة
Write-Host ""
Write-Host "📋 Files to be committed:" -ForegroundColor Cyan
git diff --cached --name-only
Write-Host ""

# إنشاء commit message
$commitMessage = @"
🔧 Fix: Profile loading issue - Complete solution

✅ Front-end fixes:
* Added comprehensive logging in useProfileCache
* Added API health check before data fetch
* Added auto-retry (3s + 15s timeout)
* Enhanced error state UI with retry/logout buttons
* Fixed location/country field mapping
* Added retry with exponential backoff

✅ Back-end fixes:
* Added comprehensive logging in /clerk/me endpoint
* Added country field to response
* Improved error messages

✅ Features:
* Auto-retry system
* API health check
* Enhanced error handling
* Better UX with clear error messages
* Cache management

Files modified:
* front/hooks/useProfileCache.ts
* front/app/(tabs)/profile.tsx
* front/src/services/authService.ts
* Backend/src/routes/clerk-user.routes.ts

Documentation:
* PROFILE_LOADING_FIX.md
* إصلاح_مشكلة_البروفايل.md
* PROFILE_QUICK_FIX.md
* PROFILE_FIX_SUMMARY.md
"@

Write-Host "💬 Commit message:" -ForegroundColor Cyan
Write-Host $commitMessage -ForegroundColor Gray
Write-Host ""

# تأكيد الـ commit
Write-Host "❓ Proceed with commit? (y/n): " -ForegroundColor Yellow -NoNewline
$response = Read-Host
if ($response -ne "y") {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Red
    exit 0
}

# عمل commit
Write-Host ""
Write-Host "📝 Creating commit..." -ForegroundColor Yellow
git commit -m $commitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Commit failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Commit created successfully" -ForegroundColor Green
Write-Host ""

# التحقق من البرانش الحالي
$currentBranch = git branch --show-current
Write-Host "🌿 Current branch: $currentBranch" -ForegroundColor Cyan
Write-Host ""

# Push للسيرفر
Write-Host "🚀 Pushing to remote..." -ForegroundColor Yellow
Write-Host ""

git push origin $currentBranch

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Trying to pull first..." -ForegroundColor Yellow
    git pull origin $currentBranch --rebase
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Pull failed! Please resolve conflicts manually" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "🚀 Pushing again..." -ForegroundColor Yellow
    git push origin $currentBranch
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Push failed again!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ Deployment Successful!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# معلومات ما بعد الـ deployment
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. 🔄 Wait for Railway/Vercel to deploy (2-5 minutes)" -ForegroundColor White
Write-Host "2. 🏥 Check API health: https://your-api.railway.app/api/health" -ForegroundColor White
Write-Host "3. 📱 Test the profile in the app" -ForegroundColor White
Write-Host "4. 📊 Monitor console logs for any errors" -ForegroundColor White
Write-Host ""

Write-Host "🔍 Deployment Status:" -ForegroundColor Cyan
Write-Host "- Railway: https://railway.app/dashboard" -ForegroundColor White
Write-Host "- Vercel: https://vercel.com/dashboard" -ForegroundColor White
Write-Host ""

Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "- Full guide: إصلاح_مشكلة_البروفايل.md" -ForegroundColor White
Write-Host "- Quick fix: PROFILE_QUICK_FIX.md" -ForegroundColor White
Write-Host "- Summary: PROFILE_FIX_SUMMARY.md" -ForegroundColor White
Write-Host ""

Write-Host "✨ Profile fix deployed successfully!" -ForegroundColor Green
Write-Host ""

# فتح Railway dashboard (اختياري)
Write-Host "❓ Open Railway dashboard? (y/n): " -ForegroundColor Yellow -NoNewline
$response = Read-Host
if ($response -eq "y") {
    Start-Process "https://railway.app/dashboard"
}

Write-Host ""
Write-Host "🎉 Done! Your profile fix is now live!" -ForegroundColor Green
Write-Host ""
