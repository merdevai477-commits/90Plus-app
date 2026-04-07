# Script to push Backend to GitHub
# يقوم برفع الـ Backend على GitHub

Write-Host "🚀 Pushing Backend to GitHub" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is initialized
if (-not (Test-Path ".git")) {
    Write-Host "❌ Git not initialized in this directory" -ForegroundColor Red
    Write-Host "Run this script from Backend folder" -ForegroundColor Yellow
    exit 1
}

# Check remote
Write-Host "📡 Checking remote..." -ForegroundColor Yellow
$remote = git remote get-url origin 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ No remote found, adding origin..." -ForegroundColor Yellow
    git remote add origin https://github.com/mrdev7479-sys/90-plus.git
    Write-Host "✅ Remote added" -ForegroundColor Green
} else {
    Write-Host "✅ Remote: $remote" -ForegroundColor Green
}

Write-Host ""

# Check status
Write-Host "📊 Git status:" -ForegroundColor Yellow
git status --short

Write-Host ""

# Push
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️ You will be prompted to login to GitHub" -ForegroundColor Yellow
Write-Host "   Use your GitHub username and Personal Access Token" -ForegroundColor White
Write-Host ""
Write-Host "   To create a token:" -ForegroundColor Cyan
Write-Host "   1. Go to: https://github.com/settings/tokens" -ForegroundColor White
Write-Host "   2. Click 'Generate new token (classic)'" -ForegroundColor White
Write-Host "   3. Select 'repo' permissions" -ForegroundColor White
Write-Host "   4. Copy the token and use it as password" -ForegroundColor White
Write-Host ""

$continue = Read-Host "Ready to push? (y/n)"
if ($continue -ne "y") {
    Write-Host "❌ Push cancelled" -ForegroundColor Red
    exit 1
}

Write-Host ""
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Go to Railway Dashboard: https://railway.app/dashboard" -ForegroundColor White
    Write-Host "   2. Your project should auto-deploy from GitHub" -ForegroundColor White
    Write-Host "   3. Check deployment logs in Railway" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Push failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Try these solutions:" -ForegroundColor Yellow
    Write-Host "   1. Use VS Code: Open Source Control → Publish Branch" -ForegroundColor White
    Write-Host "   2. Use GitHub Desktop: File → Add Local Repository" -ForegroundColor White
    Write-Host "   3. Create Personal Access Token and try again" -ForegroundColor White
}
