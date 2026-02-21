# Fix Backend Dependencies
Write-Host "Fixing Backend Dependencies..." -ForegroundColor Cyan

# Navigate to Backend
Set-Location Backend

# Remove node_modules and package-lock.json
Write-Host "Removing old dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force node_modules
}
if (Test-Path "package-lock.json") {
    Remove-Item -Force package-lock.json
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Green
npm install

Write-Host "Backend dependencies fixed!" -ForegroundColor Green
Write-Host ""
Write-Host "Now you can run:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
