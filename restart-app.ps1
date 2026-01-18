# Restart App with Clean Cache
# This script clears all caches and restarts the app

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Restarting App with Clean Cache" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to front directory
Set-Location -Path "front"

Write-Host "Step 1: Stopping Metro bundler..." -ForegroundColor Yellow
# Kill any running Metro processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {$_.Path -like "*node*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "  Metro stopped" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Clearing caches..." -ForegroundColor Yellow

# Clear Metro cache
if (Test-Path ".expo") {
    Remove-Item -Recurse -Force ".expo" -ErrorAction SilentlyContinue
    Write-Host "  .expo cache cleared" -ForegroundColor Green
}

# Clear node_modules/.cache
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
    Write-Host "  node_modules cache cleared" -ForegroundColor Green
}

# Clear temp files
$env:TMPDIR = $env:TEMP
Write-Host "  Temp directory set" -ForegroundColor Green

Write-Host ""
Write-Host "Step 3: Starting app with clean cache..." -ForegroundColor Yellow
Write-Host ""

# Start with clean cache
npx expo start --clear

# Return to root directory
Set-Location -Path ".."
