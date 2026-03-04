# Quick Git Push - No prompts, uses default message

Write-Host "🚀 Quick Push to GitHub..." -ForegroundColor Cyan
git add .
git commit -m "fix: TypeScript errors and component updates"
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Done!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed! Run git-push.ps1 for detailed process" -ForegroundColor Red
}
