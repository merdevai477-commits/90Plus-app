# Quick push script for Backend
Write-Host "🚀 Quick push to GitHub..." -ForegroundColor Green

# Add all changes
Write-Host "📦 Adding files..." -ForegroundColor Yellow
git add .

# Check if there are changes
$changes = git diff --staged --name-only
if ($changes.Count -eq 0) {
    Write-Host "ℹ️ No changes to commit" -ForegroundColor Cyan
    git status
} else {
    # Commit with timestamp
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "💾 Committing changes..." -ForegroundColor Yellow
    git commit -m "Backend update - $timestamp"
    Write-Host "✅ Committed changes" -ForegroundColor Green
}

# Push to GitHub
Write-Host "🌐 Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Done! Check: https://github.com/merdevai477-commits/90Plus-app" -ForegroundColor Green
} else {
    Write-Host "❌ Push failed!" -ForegroundColor Red
}