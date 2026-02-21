#!/usr/bin/env pwsh

Write-Host "Pushing Backend..." -ForegroundColor Yellow
cd Backend
git add .
git commit -m "feat: Enterprise Security Complete"
git push
cd ..

Write-Host "Pushing Frontend..." -ForegroundColor Yellow
cd front
git add .
git commit -m "feat: Security integration"
git push
cd ..

Write-Host "Pushing Root..." -ForegroundColor Yellow
git add .
git commit -m "docs: Documentation updates"
git push

Write-Host "Done!" -ForegroundColor Green
