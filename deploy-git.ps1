# 90Plus - Git Deployment Script (PowerShell)
# This script commits and pushes all Apple Review fixes to GitHub

$ErrorActionPreference = "Stop"

Write-Host "[*] 90Plus - Git Deployment Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "[ERROR] Not a git repository" -ForegroundColor Red
    exit 1
}

# Get current branch
$CURRENT_BRANCH = git branch --show-current
Write-Host "[INFO] Current branch: $CURRENT_BRANCH" -ForegroundColor Blue
Write-Host ""

# Check for uncommitted changes
$STATUS = git status --short
if ($STATUS) {
    Write-Host "[INFO] Uncommitted changes detected" -ForegroundColor Yellow
    Write-Host ""
    
    # Show status
    Write-Host "[INFO] Git Status:" -ForegroundColor Blue
    git status --short
    Write-Host ""
    
    # Stage all changes
    Write-Host "[*] Staging all changes..." -ForegroundColor Blue
    git add .
    Write-Host "[OK] All changes staged" -ForegroundColor Green
    Write-Host ""
    
    # Create commit message
    $COMMIT_MSG = "fix: Apple Review compliance fixes - Copycat content removed, documentation added, deployment scripts created"
    
    # Commit changes
    Write-Host "[*] Committing changes..." -ForegroundColor Blue
    git commit -m $COMMIT_MSG
    Write-Host "[OK] Changes committed" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[OK] No uncommitted changes" -ForegroundColor Green
    Write-Host ""
}

# Check if there are commits to push
$UNPUSHED = (git log "origin/$CURRENT_BRANCH..HEAD" --oneline 2>$null | Measure-Object -Line).Lines

if ($UNPUSHED -gt 0) {
    Write-Host "[INFO] $UNPUSHED commit(s) ready to push" -ForegroundColor Yellow
    Write-Host ""
    
    # Show commits to be pushed
    Write-Host "[INFO] Commits to push:" -ForegroundColor Blue
    git log "origin/$CURRENT_BRANCH..HEAD" --oneline --decorate
    Write-Host ""
    
    # Push to remote
    Write-Host "[*] Pushing to origin/$CURRENT_BRANCH..." -ForegroundColor Blue
    git push origin $CURRENT_BRANCH
    Write-Host "[OK] Successfully pushed to GitHub" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[OK] Already up to date with origin/$CURRENT_BRANCH" -ForegroundColor Green
    Write-Host ""
}

# Summary
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "[OK] Git deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "[INFO] Summary:" -ForegroundColor Blue
Write-Host "  - Branch: $CURRENT_BRANCH"
Write-Host "  - Remote: origin"
Write-Host "  - Status: Up to date"
Write-Host ""
Write-Host "[INFO] Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run .\deploy-expo.ps1 to build and deploy to Expo"
Write-Host "  2. Test on TestFlight"
Write-Host "  3. Submit to Apple Review"
Write-Host ""
