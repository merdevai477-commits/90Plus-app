#!/usr/bin/env pwsh
# Cloudflare R2 Test Runner Script
# Usage: .\test-r2.ps1

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Cloudflare R2 Reels Bucket Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Error: .env file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file with your R2 credentials." -ForegroundColor Yellow
    Write-Host "`nRequired variables:" -ForegroundColor Yellow
    Write-Host "  R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com"
    Write-Host "  R2_ACCESS_KEY_ID=your_access_key"
    Write-Host "  R2_SECRET_ACCESS_KEY=your_secret_key"
    Write-Host "  R2_BUCKET_NAME=your_bucket_name"
    Write-Host "  R2_PUBLIC_URL=https://your-public-url.com (optional)`n"
    exit 1
}

Write-Host "Found .env file" -ForegroundColor Green

# Check if ts-node is installed
Write-Host "Checking dependencies..." -ForegroundColor Yellow

$tsNodeInstalled = Get-Command ts-node -ErrorAction SilentlyContinue
if (-not $tsNodeInstalled) {
    Write-Host "ts-node not found. Installing..." -ForegroundColor Yellow
    npm install -g ts-node typescript
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install ts-node" -ForegroundColor Red
        exit 1
    }
}

# Check if @aws-sdk/client-s3 is installed
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$hasAwsSdk = $packageJson.dependencies.'@aws-sdk/client-s3' -or $packageJson.devDependencies.'@aws-sdk/client-s3'

if (-not $hasAwsSdk) {
    Write-Host "@aws-sdk/client-s3 not found in package.json. Installing..." -ForegroundColor Yellow
    npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install AWS SDK" -ForegroundColor Red
        exit 1
    }
}

Write-Host "All dependencies ready`n" -ForegroundColor Green

# Run the test
Write-Host "Running R2 tests...`n" -ForegroundColor Cyan
ts-node test-r2-reels.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nAll tests passed! ✓" -ForegroundColor Green
} else {
    Write-Host "`nSome tests failed! ✗" -ForegroundColor Red
    exit 1
}
