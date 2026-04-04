# 🚀 iOS Login Fix - Deployment Script (PowerShell)
# Deploys both Backend and Frontend changes

$ErrorActionPreference = "Stop"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "🚀 iOS Login Fix Deployment" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Functions for colored output
function Print-Status {
    param($Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Print-Success {
    param($Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Print-Error {
    param($Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Print-Warning {
    param($Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

# Check if we're in the right directory
if (-not (Test-Path "Backend") -or -not (Test-Path "front")) {
    Print-Error "Please run this script from the project root directory"
    exit 1
}

# ============================================
# STEP 1: Deploy Backend
# ============================================
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "📦 STEP 1: Deploying Backend" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

Set-Location Backend

Print-Status "Checking for changes in Backend..."
$backendChanges = git diff --quiet src/main.ts
if ($LASTEXITCODE -eq 0) {
    Print-Warning "No changes detected in Backend/src/main.ts"
} else {
    Print-Status "Changes detected in Backend"
}

Print-Status "Staging Backend changes..."
git add src/main.ts

Print-Status "Committing Backend changes..."
$commitMessage = @"
fix: Add iOS/mobile CORS origins for iPad/iPhone compatibility

- Added capacitor://localhost for Capacitor iOS
- Added ionic://localhost for Ionic iOS
- Added file:// for iOS file protocol
- Added exp:// regex for Expo Go
- Added com.90plus.app:// for iOS bundle ID
- Added ninetyplusapp:// for custom app scheme

This fixes the 'Operation failed' error on iOS devices by allowing
mobile app origins in CORS configuration.
"@

try {
    git commit -m $commitMessage
} catch {
    Print-Warning "No changes to commit (already committed?)"
}

Print-Status "Pushing to Railway..."
git push origin main

Print-Success "Backend deployed! Railway will auto-deploy in 2-3 minutes."

Set-Location ..

# ============================================
# STEP 2: Deploy Frontend
# ============================================
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "📱 STEP 2: Building Frontend" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

Set-Location front

Print-Status "Checking for changes in Frontend..."
$frontendChanges = git diff --quiet app/auth/index.tsx
if ($LASTEXITCODE -eq 0) {
    Print-Warning "No changes detected in Frontend/app/auth/index.tsx"
} else {
    Print-Status "Changes detected in Frontend"
}

Print-Status "Staging Frontend changes..."
git add app/auth/index.tsx

Print-Status "Committing Frontend changes..."
$commitMessage = @"
fix: Add detailed logging and Sentry tracking for iOS login debugging

- Added Sentry breadcrumbs for remote debugging
- Added detailed console logging for Clerk authentication flow
- Show actual Clerk status instead of generic 'Operation failed'
- Send Clerk errors to Sentry with device info and context
- Improved error messages for better debugging

This allows debugging iOS login issues without Mac by using Sentry
remote logging and TestFlight.
"@

try {
    git commit -m $commitMessage
} catch {
    Print-Warning "No changes to commit (already committed?)"
}

Print-Status "Pushing Frontend changes..."
git push origin main

Print-Success "Frontend changes committed and pushed!"

Write-Host ""
Print-Status "Starting EAS Build for iOS..."
Print-Warning "This will take 15-20 minutes. You can close this terminal."
Write-Host ""

# Check if EAS CLI is installed
$easInstalled = Get-Command eas -ErrorAction SilentlyContinue
if (-not $easInstalled) {
    Print-Error "EAS CLI not found. Installing..."
    npm install -g eas-cli
}

# Start the build
Print-Status "Building for iOS (Production)..."
eas build --platform ios --profile production --non-interactive

Print-Success "Build started! Check EAS dashboard for progress."

Set-Location ..

# ============================================
# STEP 3: Summary
# ============================================
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ Deployment Summary" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

Print-Success "Backend: Deployed to Railway"
Print-Status "  → CORS fix applied"
Print-Status "  → Auto-deployment in progress"
Print-Status "  → Check: https://railway.app"
Write-Host ""

Print-Success "Frontend: Build started"
Print-Status "  → Sentry logging added"
Print-Status "  → Detailed error tracking enabled"
Print-Status "  → Build time: ~15-20 minutes"
Print-Status "  → Check: https://expo.dev"
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "📋 Next Steps" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. ⏳ Wait for Railway deployment (2-3 minutes)"
Write-Host "   → Check: https://railway.app/project/[your-project]"
Write-Host ""
Write-Host "2. ⏳ Wait for EAS build (15-20 minutes)"
Write-Host "   → Check: https://expo.dev/accounts/[your-account]/projects/90plus/builds"
Write-Host ""
Write-Host "3. 📱 Download from TestFlight on iPad"
Write-Host "   → Open TestFlight app"
Write-Host "   → Install new build"
Write-Host ""
Write-Host "4. 🧪 Test login on iPad"
Write-Host "   → Try logging in"
Write-Host "   → Note any errors"
Write-Host ""
Write-Host "5. 📊 Check Sentry for logs"
Write-Host "   → Go to: https://sentry.io"
Write-Host "   → Look for 'Clerk login incomplete' errors"
Write-Host "   → Check breadcrumbs and extra data"
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "🔍 Debugging Info" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If login still fails, check Sentry for:"
Write-Host "  • Clerk status (needs_first_factor, needs_verification, etc.)"
Write-Host "  • Device info (platform, width, version)"
Write-Host "  • Breadcrumbs (login flow steps)"
Write-Host "  • Error messages and stack traces"
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ Deployment Complete!" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Print-Success "All changes deployed successfully!"
Print-Status "Monitor Railway and EAS dashboards for deployment status."
Write-Host ""
