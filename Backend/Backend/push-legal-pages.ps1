# PowerShell script to push legal pages to GitHub
Write-Host "🚀 Starting Git push process for legal pages..." -ForegroundColor Green

try {
    # Pull latest changes first
    Write-Host "📥 Pulling latest changes from GitHub..." -ForegroundColor Yellow
    git pull origin main --no-edit
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Pull had conflicts or issues, continuing anyway..." -ForegroundColor Yellow
    }

    # Add the legal pages
    Write-Host "📄 Adding legal pages to git..." -ForegroundColor Cyan
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
    $commitMessage = @"
feat: Add professional legal pages for App Store compliance

✅ Privacy Policy - Comprehensive data protection policy
✅ Terms of Service - Complete legal terms and conditions  
✅ Support Center - Professional help and FAQ system

Features:
- Apple App Store & Google Play compliant
- Responsive design with brand colors
- Detailed third-party service disclosures
- GDPR & CCPA compliance sections
- Professional contact information
- Emergency support channels
- Complete feature coverage (videos, blocking, predictions)

Ready for app store submission 🎯
"@

    git commit -m $commitMessage

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to commit changes" -ForegroundColor Red
        exit 1
    }

    # Push to GitHub
    Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Green
    git push origin main

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Successfully pushed legal pages to GitHub!" -ForegroundColor Green
        Write-Host "🎉 Legal pages are now live and ready for App Store submission" -ForegroundColor Green
        Write-Host ""
        Write-Host "📄 Created files:" -ForegroundColor Cyan
        Write-Host "   - Backend/public/privacy-policy.html" -ForegroundColor White
        Write-Host "   - Backend/public/support.html" -ForegroundColor White  
        Write-Host "   - Backend/public/terms-of-service.html" -ForegroundColor White
    } else {
        Write-Host "❌ Failed to push to GitHub" -ForegroundColor Red
        Write-Host "💡 Try running the script again or check your internet connection" -ForegroundColor Yellow
        exit 1
    }

} catch {
    Write-Host "❌ An error occurred: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "🏁 Done!" -ForegroundColor Green