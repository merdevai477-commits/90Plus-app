# Quick Push to GitHub
# Simple script for fast commits and pushes

param(
    [string]$message = ""
)

Write-Host "Quick Push to GitHub" -ForegroundColor Cyan
Write-Host ""


# Default commit message if not provided
if ([string]::IsNullOrWhiteSpace($message)) {
    $message = @"
Fix predictions authentication and update UI

- Fixed Backend predictions routes authentication
- Updated Frontend predictions service  
- Changed terminology from tickets to coupons
- Fixed VirtualizedList warning
- Updated API configuration
"@
}

# Get current branch
$branch = git rev-parse --abbrev-ref HEAD
Write-Host "Branch: $branch" -ForegroundColor Yellow
Write-Host ""

# Stage all changes
Write-Host "Staging changes..." -ForegroundColor Cyan
git add .

# Show what will be committed
Write-Host ""
Write-Host "Files to commit:" -ForegroundColor Cyan
git status --short
Write-Host ""

# Commit
Write-Host "Committing..." -ForegroundColor Cyan
git commit -m $message

if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed or no changes to commit" -ForegroundColor Red
    exit 1
}

Write-Host "Committed successfully" -ForegroundColor Green
Write-Host ""

# Push
Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push origin $branch

if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try: git push -u origin $branch" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Successfully pushed to GitHub!" -ForegroundColor Green
Write-Host ""
Write-Host "Done!" -ForegroundColor Cyan
