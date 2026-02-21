#!/usr/bin/env pwsh
# 🚀 Quick Push All - Simple Version

Write-Host "🚀 Quick Push All Updates" -ForegroundColor Cyan
Write-Host ""

# Backend
Write-Host "📁 Backend..." -ForegroundColor Yellow
cd Backend
git add .
git commit -m "feat: Enterprise Security & Engineering Reliability - Complete Implementation"
git push
cd ..

# Frontend
Write-Host "📁 Frontend..." -ForegroundColor Yellow
cd front
git add .
git commit -m "feat: Security integration and stability improvements"
git push
cd ..

# Root
Write-Host "📁 Root..." -ForegroundColor Yellow
git add .
git commit -m "docs: Complete security and reliability documentation"
git push

Write-Host ""
Write-Host "✅ Done!" -ForegroundColor Green
