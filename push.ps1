# Git Push Script
# Usage: .\push.ps1 "your message"

param(
    [Parameter(Mandatory=$false)]
    [string]$message = ""
)

Write-Host "================================" -ForegroundColor Cyan
Write-Host "   Git Push Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if message is provided
if ([string]::IsNullOrWhiteSpace($message)) {
    Write-Host "Enter commit message:" -ForegroundColor Yellow
    $message = Read-Host
    
    if ([string]::IsNullOrWhiteSpace($message)) {
        Write-Host "Error: Commit message is required!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Message: $message" -ForegroundColor Green
Write-Host ""

# 1. Show changed files
Write-Host "1. Changed files:" -ForegroundColor Cyan
git status --short
Write-Host ""

# 2. Add all files
Write-Host "2. Adding files..." -ForegroundColor Cyan
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error adding files!" -ForegroundColor Red
    exit 1
}
Write-Host "Files added successfully" -ForegroundColor Green
Write-Host ""

# 3. Commit
Write-Host "3. Committing changes..." -ForegroundColor Cyan
git commit -m "$message"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error committing changes!" -ForegroundColor Red
    exit 1
}
Write-Host "Changes committed successfully" -ForegroundColor Green
Write-Host ""

# 4. Push
Write-Host "4. Pushing to GitHub..." -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error pushing changes!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try:" -ForegroundColor Yellow
    Write-Host "  git pull origin main" -ForegroundColor White
    Write-Host "  Then run the script again" -ForegroundColor White
    exit 1
}
Write-Host "Changes pushed successfully" -ForegroundColor Green
Write-Host ""

# 5. Show last commit
Write-Host "5. Last commit:" -ForegroundColor Cyan
git log -1 --oneline
Write-Host ""

Write-Host "================================" -ForegroundColor Green
Write-Host "   SUCCESS!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Repository: https://github.com/merdevai477-commits/90Plus-app" -ForegroundColor Blue
Write-Host ""
