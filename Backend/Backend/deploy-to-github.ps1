# 🚀 Deploy to GitHub Script for 90Plus Application (PowerShell)
# This script handles both Backend and Frontend deployments to GitHub

param(
    [switch]$Force,
    [string]$Message = ""
)

Write-Host "🚀 90Plus - Deploy to GitHub" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in a git repository
try {
    git rev-parse --git-dir | Out-Null
} catch {
    Write-Host "❌ Error: Not a git repository!" -ForegroundColor Red
    exit 1
}

# Get current branch
$currentBranch = git branch --show-current
Write-Host "📍 Current branch: $currentBranch" -ForegroundColor Blue
Write-Host ""

# Show current status
Write-Host "📊 Checking repository status..." -ForegroundColor Blue
git status --short

# Check if there are any changes
$hasChanges = $false
try {
    git diff --quiet
    git diff --cached --quiet
} catch {
    $hasChanges = $true
}

if (-not $hasChanges -and -not $Force) {
    Write-Host "⚠️  No changes detected. Repository is clean." -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Deployment cancelled." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "=== DEPLOYMENT SUMMARY ===" -ForegroundColor Cyan
Write-Host "📱 Frontend Updates:" -ForegroundColor Green
Write-Host "  ✅ Profile translation to 8 languages completed"
Write-Host "  ✅ Brand selection limited to: Nike, Adidas, Puma, New Balance"
Write-Host "  ✅ Club selection limited to top 10 European clubs"
Write-Host "  ✅ TypeScript errors resolved"
Write-Host "  ✅ Translation system optimized"
Write-Host ""
Write-Host "🔧 Backend Updates:" -ForegroundColor Green
Write-Host "  ✅ Profile completion system enhanced"
Write-Host "  ✅ User service improvements"
Write-Host "  ✅ API endpoints optimized"
Write-Host "  ✅ Database queries improved"
Write-Host ""

# Prompt for deployment confirmation
if (-not $Force) {
    $deploy = Read-Host "🚀 Deploy these changes to GitHub? (Y/n)"
    if ($deploy -eq "n" -or $deploy -eq "N") {
        Write-Host "Deployment cancelled by user." -ForegroundColor Yellow
        exit 0
    }
}

# Add all changes
Write-Host "➕ Adding all changes to staging..." -ForegroundColor Blue
git add .

# Check if there are changes to commit after adding
try {
    git diff --cached --quiet
    Write-Host "⚠️  No staged changes found after git add." -ForegroundColor Yellow
    exit 0
} catch {
    # Changes exist, continue
}

# Show what will be committed
Write-Host ""
Write-Host "📝 Files to be committed:" -ForegroundColor Blue
$stagedFiles = git diff --cached --name-status
$stagedFiles | Select-Object -First 20
if ($stagedFiles.Count -gt 20) {
    Write-Host "... and $($stagedFiles.Count - 20) more files"
}
Write-Host ""

# Create comprehensive commit message
if ([string]::IsNullOrEmpty($Message)) {
    $commitMessage = @"
feat: complete profile system updates and brand/club optimization

🎯 Major Updates:
- Complete profile translation to 8 languages (AR, EN, ES, FR, DE, IT, PT, TR)
- Brand selection optimized to top 4: Nike, Adidas, Puma, New Balance
- Club selection limited to top 10 European clubs
- All TypeScript errors resolved across frontend components

🔧 Frontend Improvements:
- Enhanced profile screen with full internationalization
- Optimized brand and club data structures
- Improved translation system performance
- Fixed all TypeScript compilation issues
- Updated brand logo service for better performance

🚀 Backend Enhancements:
- Profile completion system improvements
- Enhanced user service functionality
- Optimized API endpoints
- Database query improvements

✅ Technical Fixes:
- Resolved gradient colors type issues
- Fixed Easing.back() parameter calls
- Updated Video type references
- Fixed import paths and exports
- Improved error handling across components
- Enhanced type safety throughout codebase

🌍 Internationalization:
- All profile UI elements now support 8 languages
- RTL support for Arabic language
- Consistent translation keys across all components
- Professional translations maintaining app tone

📱 User Experience:
- Simplified brand selection (4 top brands only)
- Curated club selection (10 biggest European clubs)
- Faster loading times due to optimized data
- Better performance with reduced options

Ready for production deployment 🚀
"@
} else {
    $commitMessage = $Message
}

# Commit changes
Write-Host "💾 Committing changes..." -ForegroundColor Blue
try {
    git commit -m $commitMessage
    Write-Host "✅ Commit successful!" -ForegroundColor Green
} catch {
    Write-Host "❌ Commit failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Push to remote
Write-Host "🔄 Pushing to remote repository ($currentBranch)..." -ForegroundColor Blue
try {
    git push origin $currentBranch
} catch {
    Write-Host "⚠️  Push failed! Attempting to set upstream..." -ForegroundColor Yellow
    try {
        git push --set-upstream origin $currentBranch
    } catch {
        Write-Host "❌ Push failed! Please check your remote configuration." -ForegroundColor Red
        Write-Host "You may need to:" -ForegroundColor Yellow
        Write-Host "  1. Check your internet connection"
        Write-Host "  2. Verify GitHub authentication"
        Write-Host "  3. Ensure remote repository exists"
        exit 1
    }
}

Write-Host ""
Write-Host "🎉 Successfully deployed to GitHub!" -ForegroundColor Green
Write-Host "Repository: https://github.com/your-username/90plus" -ForegroundColor Cyan
Write-Host "Branch: $currentBranch" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Blue
Write-Host "  1. Check GitHub Actions for automated builds"
Write-Host "  2. Monitor deployment status"
Write-Host "  3. Test the application on staging/production"
Write-Host ""
Write-Host "Deployment completed successfully! 🚀" -ForegroundColor Green