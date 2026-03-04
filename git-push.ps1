# Git Push Script for 90Plus Application (PowerShell)
# This script adds all changes, commits, and pushes to GitHub

Write-Host "🚀 Starting Git Push Process..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in a git repository
try {
    git rev-parse --git-dir 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Not a git repository"
    }
} catch {
    Write-Host "❌ Error: Not a git repository!" -ForegroundColor Red
    exit 1
}

# Show current branch
$currentBranch = git branch --show-current
Write-Host "📍 Current branch: $currentBranch" -ForegroundColor Yellow
Write-Host ""

# Show git status
Write-Host "📊 Current status:" -ForegroundColor Cyan
git status --short
Write-Host ""

# Add all changes
Write-Host "➕ Adding all changes..." -ForegroundColor Green
git add .

# Check if there are changes to commit
$diffOutput = git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ No changes to commit. Everything is up to date!" -ForegroundColor Green
    exit 0
}

# Show what will be committed
Write-Host ""
Write-Host "📝 Files to be committed:" -ForegroundColor Cyan
git diff --cached --name-status
Write-Host ""

# Prompt for commit message
$commitMsg = Read-Host "💬 Enter commit message (or press Enter for default)"

# Use default message if none provided
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $commitMsg = @"
fix: resolve TypeScript errors across frontend components

- Fixed gradient colors type to tuple format in multiple components
- Fixed Easing.back() calls to include parameter
- Fixed Video type references to use 'any' for dynamic imports
- Fixed import paths and removed unused imports
- Fixed service exports (clubLogoService, brandLogoService)
- Fixed nested object state updates in VisualEnhancements
- Fixed displayMode comparisons to use uppercase values
- Fixed transfer data handling (removed non-existent value property)
- Added missing styles and constants across components
- Improved type safety and error handling
"@
}

# Commit changes
Write-Host ""
Write-Host "💾 Committing changes..." -ForegroundColor Cyan
git commit -m $commitMsg

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Commit failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Commit successful!" -ForegroundColor Green
Write-Host ""

# Push to remote
Write-Host "🔄 Pushing to remote ($currentBranch)..." -ForegroundColor Cyan
git push origin $currentBranch

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Push failed! Trying to set upstream..." -ForegroundColor Yellow
    git push --set-upstream origin $currentBranch
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Push failed! Please check your remote configuration." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
Write-Host "🎉 All done!" -ForegroundColor Cyan
