# Simple push script for Backend
Write-Host "🚀 Pushing Backend to GitHub..." -ForegroundColor Green

# Add all changes
git add .

# Commit with timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
git commit -m "Backend update - $timestamp"

# Push to GitHub
git push origin main

Write-Host "✅ Done! Check: https://github.com/merdevai477-commits/90Plus-app" -ForegroundColor Green