# 🧪 Test OAuth Setup Script
# This script helps you test Clerk OAuth integration

Write-Host "🔍 Checking Clerk OAuth Setup..." -ForegroundColor Cyan
Write-Host ""

# Check if Backend is running
Write-Host "1️⃣ Checking Backend..." -ForegroundColor Yellow
$backendRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend is running on port 3000" -ForegroundColor Green
        $backendRunning = $true
    }
} catch {
    Write-Host "   ❌ Backend is NOT running!" -ForegroundColor Red
    Write-Host "   → Start it with: cd Backend && npm run dev" -ForegroundColor Yellow
}
Write-Host ""

# Check Backend .env
Write-Host "2️⃣ Checking Backend Environment..." -ForegroundColor Yellow
$envPath = "Backend\.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    
    if ($envContent -match "CLERK_SECRET_KEY=sk_test_") {
        Write-Host "   ✅ CLERK_SECRET_KEY is set" -ForegroundColor Green
    } else {
        Write-Host "   ❌ CLERK_SECRET_KEY is missing or invalid!" -ForegroundColor Red
    }
    
    if ($envContent -match "DATABASE_URL=") {
        Write-Host "   ✅ DATABASE_URL is set" -ForegroundColor Green
    } else {
        Write-Host "   ❌ DATABASE_URL is missing!" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Backend/.env file not found!" -ForegroundColor Red
}
Write-Host ""

# Check Frontend app.json
Write-Host "3️⃣ Checking Frontend Configuration..." -ForegroundColor Yellow
$appJsonPath = "front\app.json"
if (Test-Path $appJsonPath) {
    $appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
    
    $clerkKey = $appJson.expo.extra.clerkPublishableKey
    if ($clerkKey -and $clerkKey.StartsWith("pk_test_")) {
        Write-Host "   ✅ Clerk Publishable Key is set" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Clerk Publishable Key is missing or invalid!" -ForegroundColor Red
    }
    
    $scheme = $appJson.expo.scheme
    if ($scheme -eq "footballproapp") {
        Write-Host "   ✅ App scheme is correct: $scheme" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  App scheme: $scheme" -ForegroundColor Yellow
    }
    
    $apiUrl = $appJson.expo.extra.apiUrl
    Write-Host "   ℹ️  API URL: $apiUrl" -ForegroundColor Cyan
} else {
    Write-Host "   ❌ front/app.json not found!" -ForegroundColor Red
}
Write-Host ""

# Check if Expo is running
Write-Host "4️⃣ Checking Expo Dev Server..." -ForegroundColor Yellow
$expoRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8081" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Expo is running on port 8081" -ForegroundColor Green
        $expoRunning = $true
    }
} catch {
    Write-Host "   ❌ Expo is NOT running!" -ForegroundColor Red
    Write-Host "   → Start it with: cd front && npm start" -ForegroundColor Yellow
}
Write-Host ""

# Get local IP
Write-Host "5️⃣ Network Information..." -ForegroundColor Yellow
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -like "192.168.*"}).IPAddress | Select-Object -First 1
if ($localIP) {
    Write-Host "   ℹ️  Local IP: $localIP" -ForegroundColor Cyan
    Write-Host "   ℹ️  Expo URL: exp://$localIP:8081" -ForegroundColor Cyan
} else {
    Write-Host "   ⚠️  Could not detect local IP" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📋 SUMMARY" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

if ($backendRunning -and $expoRunning) {
    Write-Host "✅ Everything is ready to test OAuth!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 Next Steps:" -ForegroundColor Yellow
    Write-Host "   1. Open Expo Go on your phone" -ForegroundColor White
    Write-Host "   2. Scan the QR code" -ForegroundColor White
    Write-Host "   3. Click on Google/Apple icon" -ForegroundColor White
    Write-Host "   4. Sign in and check if it redirects to Home" -ForegroundColor White
} else {
    Write-Host "⚠️  Some services are not running!" -ForegroundColor Yellow
    Write-Host ""
    if (-not $backendRunning) {
        Write-Host "   → Start Backend: cd Backend && npm run dev" -ForegroundColor Yellow
    }
    if (-not $expoRunning) {
        Write-Host "   → Start Expo: cd front && npm start" -ForegroundColor Yellow
    }
}
Write-Host ""

# Clerk Dashboard reminder
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🔑 CLERK DASHBOARD SETUP" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "Make sure you added these URLs in Clerk Dashboard:" -ForegroundColor Yellow
Write-Host "   → https://dashboard.clerk.com" -ForegroundColor Cyan
Write-Host "   → Configure → Paths → Allowed redirect URLs" -ForegroundColor White
Write-Host ""
Write-Host "Add these URLs:" -ForegroundColor Yellow
Write-Host "   footballproapp://" -ForegroundColor Green
if ($localIP) {
    Write-Host "   exp://$localIP:8081" -ForegroundColor Green
}
Write-Host ""

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
