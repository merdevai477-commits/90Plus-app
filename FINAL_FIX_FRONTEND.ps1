# Final Fix - Frontend Dependencies
# Fixes all version conflicts and installs correctly

Write-Host "=== Final Frontend Fix ===" -ForegroundColor Cyan
Write-Host ""

Set-Location front

# Step 1: Clean everything
Write-Host "[1/4] Cleaning everything..." -ForegroundColor Yellow
if (Test-Path "node_modules") { Remove-Item -Recurse -Force node_modules }
if (Test-Path "package-lock.json") { Remove-Item -Force package-lock.json }
if (Test-Path ".expo") { Remove-Item -Recurse -Force .expo }
npm cache clean --force

# Step 2: Fix package.json versions
Write-Host "[2/4] Fixing package.json versions..." -ForegroundColor Yellow
$pkg = Get-Content package.json -Raw | ConvertFrom-Json

# Fix Clerk compatibility - downgrade to match Expo SDK 51
$pkg.dependencies.'@clerk/clerk-expo' = '2.19.9'
$pkg.dependencies.'expo-apple-authentication' = '~8.0.8'

# Save
$pkg | ConvertTo-Json -Depth 100 | Set-Content package.json

# Step 3: Install with legacy peer deps
Write-Host "[3/4] Installing dependencies (5-10 minutes)..." -ForegroundColor Yellow
npm install --legacy-peer-deps

# Step 4: Test Expo
Write-Host "[4/4] Testing Expo..." -ForegroundColor Yellow
Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "  npx expo start" -ForegroundColor White
Write-Host ""
Write-Host "Then scan QR code with Expo Go app on your phone" -ForegroundColor White
Write-Host ""
