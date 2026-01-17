# Simple Git Push Script
# Usage: .\git-push.ps1 "Your commit message"

param(
    [string]$CommitMessage = "Update: Fix predictions and authentication"
)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Git Push Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Get current branch
$branch = git rev-parse --abbrev-ref HEAD 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Not a git repository" -ForegroundColor Red
    exit 1
}

Write-Host "Current Branch: $branch" -ForegroundColor Yellow
Write-Host ""

# Check for changes
$status = git status --porcelain

if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "No changes to commit" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Push existing commits? (y/n)"
    if ($continue -ne 'y') {
        Write-Host "Aborted" -ForegroundColor Yellow
        exit 0
    }
} else {
    # Show changes
    Write-Host "Changes detected:" -ForegroundColor Green
    git status --short
    Write-Host ""
    
    # Stage all changes
    Write-Host "Staging all changes..." -ForegroundColor Cyan
    git add .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to stage changes" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Staged successfully" -ForegroundColor Green
    Write-Host ""
    
    # Commit
    Write-Host "Committing with message:" -ForegroundColor Cyan
    Write-Host "  $CommitMessage" -ForegroundColor White
    Write-Host ""
    
    git commit -m $CommitMessage
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Commit failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Committed successfully" -ForegroundColor Green
    Write-Host ""
}

# Push to remote
Write-Host "Pushing to origin/$branch..." -ForegroundColor Cyan
git push origin $branch

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Push failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible solutions:" -ForegroundColor Yellow
    Write-Host "  1. Set upstream: git push -u origin $branch" -ForegroundColor White
    Write-Host "  2. Pull first: git pull origin $branch" -ForegroundColor White
    Write-Host "  3. Force push: git push -f origin $branch (DANGEROUS)" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "SUCCESS: Pushed to GitHub!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

# Show last commit
Write-Host "Last commit:" -ForegroundColor Cyan
git log -1 --oneline
Write-Host ""

# Show remote URL
$remoteUrl = git config --get remote.origin.url
Write-Host "Repository: $remoteUrl" -ForegroundColor Cyan
Write-Host ""
