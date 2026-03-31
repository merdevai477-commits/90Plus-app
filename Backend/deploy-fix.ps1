Write-Host "Fixing legal pages routing and deploying..." -ForegroundColor Green

# Pull latest changes
Write-Host "Pulling latest changes..." -ForegroundColor Yellow
git pull origin main --no-edit

# Add files
Write-Host "Adding files..." -ForegroundColor Cyan
git add Backend/src/main.ts
git add Backend/public/privacy-policy.html
git add Backend/public/support.html  
git add Backend/public/terms-of-service.html

# Commit
Write-Host "Committing changes..." -ForegroundColor Yellow
git commit -m "fix: Configure static file serving for legal pages - Backend routing fixed for Railway deployment"

# Push
Write-Host "Pushing to GitHub..." -ForegroundColor Green
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "Success! Legal pages should be live at:" -ForegroundColor Green
    Write-Host "https://90plus-app-production-26e9.up.railway.app/privacy-policy.html" -ForegroundColor White
    Write-Host "https://90plus-app-production-26e9.up.railway.app/terms-of-service.html" -ForegroundColor White
    Write-Host "https://90plus-app-production-26e9.up.railway.app/support.html" -ForegroundColor White
    Write-Host "Railway will deploy in 1-2 minutes..." -ForegroundColor Yellow
} else {
    Write-Host "Failed to push. Try again." -ForegroundColor Red
}

Write-Host "Done!" -ForegroundColor Green