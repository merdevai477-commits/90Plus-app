# 🚀 Quick Deploy to GitHub - PowerShell Version
# Fast deployment script for 90Plus updates

Write-Host "🚀 Quick Deploy to GitHub..." -ForegroundColor Cyan
Write-Host ""

# Add all changes
git add .

# Quick commit with timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMessage = @"
feat: profile system updates - brands & clubs optimization

- Complete profile translation to 8 languages
- Limited brands to: Nike, Adidas, Puma, New Balance  
- Limited clubs to top 10 European clubs
- Fixed all TypeScript errors
- Enhanced user experience

Deployed: $timestamp
"@

try {
    git commit -m $commitMessage
    
    # Push to current branch
    git push
    
    Write-Host ""
    Write-Host "✅ Successfully deployed to GitHub!" -ForegroundColor Green
    Write-Host "🎉 All updates are now live!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "💡 Run .\deploy-to-github.ps1 for detailed process" -ForegroundColor Yellow
    exit 1
}