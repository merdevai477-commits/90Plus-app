# PowerShell script to fix legal pages routing and deploy
Write-Host "🔧 Fixing legal pages routing and deploying..." -ForegroundColor Green

try {
    # Pull latest changes first
    Write-Host "📥 Pulling latest changes from GitHub..." -ForegroundColor Yellow
    git pull origin main --no-edit
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️ Pull had conflicts or issues, continuing anyway..." -ForegroundColor Yellow
    }

    # Add the updated backend file and legal pages
    Write-Host "📄 Adding updated files to git..." -ForegroundColor Cyan
    git add Backend/src/main.ts
    git add Backend/public/privacy-policy.html
    git add Backend/public/support.html  
    git add Backend/public/terms-of-service.html

    # Check if there are changes to commit
    $changes = git diff --staged --name-only
    if (-not $changes) {
        Write-Host "❌ No changes to commit" -ForegroundColor Red
        exit 0
    }

    Write-Host "📋 Files to be committed:" -ForegroundColor Cyan
    $changes | ForEach-Object { Write-Host "   - $_" -ForegroundColor White }

    # Commit with descriptive message
    Write-Host "💾 Committing changes..." -ForegroundColor Yellow
    $commitMessage = "fix: Configure static file serving for legal pages

Backend Changes:
- Fixed public path configuration for Railway deployment
- Added proper error handling for legal page routes
- Added direct routes for privacy-policy.html, terms-of-service.html, support.html
- Added legacy redirect routes for backward compatibility
- Enhanced logging for debugging static file issues

Legal Pages:
- Privacy Policy: Comprehensive GDPR/CCPA compliant
- Terms of Service: App Store ready legal terms
- Support Center: Professional help and FAQ system

Now accessible at Railway URLs - Ready for App Store submission!"

    git commit -m $commitMessage

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to commit changes" -ForegroundColor Red
        exit 1
    }

    # Push to GitHub
    Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Green
    git push origin main

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Successfully pushed legal pages fix to GitHub!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 Legal pages should now be accessible at:" -ForegroundColor Green
        Write-Host "   📄 Privacy Policy: https://90plus-app-production-26e9.up.railway.app/privacy-policy.html" -ForegroundColor White
        Write-Host "   📋 Terms of Service: https://90plus-app-production-26e9.up.railway.app/terms-of-service.html" -ForegroundColor White
        Write-Host "   🆘 Support Center: https://90plus-app-production-26e9.up.railway.app/support.html" -ForegroundColor White
        Write-Host ""
        Write-Host "⏳ Railway will automatically deploy the changes in 1-2 minutes..." -ForegroundColor Yellow
        Write-Host "💡 Check Railway dashboard for deployment status" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Failed to push to GitHub" -ForegroundColor Red
        Write-Host "💡 Try running the script again or check your internet connection" -ForegroundColor Yellow
        exit 1
    }

} catch {
    Write-Host "❌ An error occurred: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "🏁 Done! Legal pages should be live shortly!" -ForegroundColor Green