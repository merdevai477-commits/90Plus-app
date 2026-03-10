#!/usr/bin/env pwsh
# Quick push script for Railway deployment

Write-Host "🚀 Pushing Backend to GitHub..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in a git repo
if (-not (Test-Path ".git")) {
    Write-Host "❌ Error: Not a git repository" -ForegroundColor Red
    Write-Host "Run this script from the Backend folder" -ForegroundColor Yellow
    exit 1
}

# Check if remote exists
$remote = git remote get-url origin 2>$null
if (-not $remote) {
    Write-Host "❌ Error: No remote 'origin' configured" -ForegroundColor Red
    Write-Host "Run: git remote add origin https://github.com/merdevai477-commits/90-plus.git" -ForegroundColor Yellow
    exit 1
}

Write-Host "📍 Remote: $remote" -ForegroundColor Green
Write-Host ""

# Show what will be pushed
Write-Host "📦 Commits to push:" -ForegroundColor Cyan
git log origin/main..HEAD --oneline 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "No previous push found, this will be the first push" -ForegroundColor Yellow
}
Write-Host ""

# Ask for confirmation
Write-Host "⚠️  This will push to: $remote" -ForegroundColor Yellow
$confirm = Read-Host "Continue? (y/n)"
if ($confirm -ne "y") {
    Write-Host "❌ Push cancelled" -ForegroundColor Red
    exit 0
}

# Push to GitHub
Write-Host ""
Write-Host "🔄 Pushing to GitHub..." -ForegroundColor Cyan
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚂 Next steps:" -ForegroundColor Cyan
    Write-Host "1. Go to Railway Dashboard: https://railway.app/dashboard" -ForegroundColor White
    Write-Host "2. Open your project: 90plus-app-production" -ForegroundColor White
    Write-Host "3. Click on Backend service → Settings" -ForegroundColor White
    Write-Host "4. Change Builder to: NIXPACKS" -ForegroundColor White
    Write-Host "5. Set Build Command: npm install && npx prisma generate && npm run build" -ForegroundColor White
    Write-Host "6. Set Start Command: npm run start:prod" -ForegroundColor White
    Write-Host "7. Go to Deployments tab and click 'Redeploy'" -ForegroundColor White
    Write-Host ""
    Write-Host "📖 Full guide: Backend/RAILWAY_FIX_AR.md" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common solutions:" -ForegroundColor Yellow
    Write-Host "1. If authentication failed:" -ForegroundColor White
    Write-Host "   - Use VS Code: Source Control → ... → Push" -ForegroundColor Gray
    Write-Host "   - Or GitHub Desktop: Add Local Repository" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. If branch doesn't exist on remote:" -ForegroundColor White
    Write-Host "   git push -u origin main --force" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. If you need to set up credentials:" -ForegroundColor White
    Write-Host "   git config user.name 'Your Name'" -ForegroundColor Gray
    Write-Host "   git config user.email 'your@email.com'" -ForegroundColor Gray
}
