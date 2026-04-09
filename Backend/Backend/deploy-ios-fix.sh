#!/bin/bash

# 🚀 iOS Login Fix - Deployment Script
# Deploys both Backend and Frontend changes

set -e  # Exit on error

echo "=================================="
echo "🚀 iOS Login Fix Deployment"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if we're in the right directory
if [ ! -d "Backend" ] || [ ! -d "front" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# ============================================
# STEP 1: Deploy Backend
# ============================================
echo ""
echo "=================================="
echo "📦 STEP 1: Deploying Backend"
echo "=================================="
echo ""

cd Backend

print_status "Checking for changes in Backend..."
if git diff --quiet src/main.ts; then
    print_warning "No changes detected in Backend/src/main.ts"
else
    print_status "Changes detected in Backend"
fi

print_status "Staging Backend changes..."
git add src/main.ts

print_status "Committing Backend changes..."
git commit -m "fix: Add iOS/mobile CORS origins for iPad/iPhone compatibility

- Added capacitor://localhost for Capacitor iOS
- Added ionic://localhost for Ionic iOS
- Added file:// for iOS file protocol
- Added exp:// regex for Expo Go
- Added com.90plus.app:// for iOS bundle ID
- Added ninetyplusapp:// for custom app scheme

This fixes the 'Operation failed' error on iOS devices by allowing
mobile app origins in CORS configuration." || print_warning "No changes to commit (already committed?)"

print_status "Pushing to Railway..."
git push origin main

print_success "Backend deployed! Railway will auto-deploy in 2-3 minutes."

cd ..

# ============================================
# STEP 2: Deploy Frontend
# ============================================
echo ""
echo "=================================="
echo "📱 STEP 2: Building Frontend"
echo "=================================="
echo ""

cd front

print_status "Checking for changes in Frontend..."
if git diff --quiet app/auth/index.tsx; then
    print_warning "No changes detected in Frontend/app/auth/index.tsx"
else
    print_status "Changes detected in Frontend"
fi

print_status "Staging Frontend changes..."
git add app/auth/index.tsx

print_status "Committing Frontend changes..."
git commit -m "fix: Add detailed logging and Sentry tracking for iOS login debugging

- Added Sentry breadcrumbs for remote debugging
- Added detailed console logging for Clerk authentication flow
- Show actual Clerk status instead of generic 'Operation failed'
- Send Clerk errors to Sentry with device info and context
- Improved error messages for better debugging

This allows debugging iOS login issues without Mac by using Sentry
remote logging and TestFlight." || print_warning "No changes to commit (already committed?)"

print_status "Pushing Frontend changes..."
git push origin main

print_success "Frontend changes committed and pushed!"

echo ""
print_status "Starting EAS Build for iOS..."
print_warning "This will take 15-20 minutes. You can close this terminal."
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    print_error "EAS CLI not found. Installing..."
    npm install -g eas-cli
fi

# Start the build
print_status "Building for iOS (Production)..."
eas build --platform ios --profile production --non-interactive

print_success "Build started! Check EAS dashboard for progress."

cd ..

# ============================================
# STEP 3: Summary
# ============================================
echo ""
echo "=================================="
echo "✅ Deployment Summary"
echo "=================================="
echo ""

print_success "Backend: Deployed to Railway"
print_status "  → CORS fix applied"
print_status "  → Auto-deployment in progress"
print_status "  → Check: https://railway.app"
echo ""

print_success "Frontend: Build started"
print_status "  → Sentry logging added"
print_status "  → Detailed error tracking enabled"
print_status "  → Build time: ~15-20 minutes"
print_status "  → Check: https://expo.dev"
echo ""

echo "=================================="
echo "📋 Next Steps"
echo "=================================="
echo ""
echo "1. ⏳ Wait for Railway deployment (2-3 minutes)"
echo "   → Check: https://railway.app/project/[your-project]"
echo ""
echo "2. ⏳ Wait for EAS build (15-20 minutes)"
echo "   → Check: https://expo.dev/accounts/[your-account]/projects/90plus/builds"
echo ""
echo "3. 📱 Download from TestFlight on iPad"
echo "   → Open TestFlight app"
echo "   → Install new build"
echo ""
echo "4. 🧪 Test login on iPad"
echo "   → Try logging in"
echo "   → Note any errors"
echo ""
echo "5. 📊 Check Sentry for logs"
echo "   → Go to: https://sentry.io"
echo "   → Look for 'Clerk login incomplete' errors"
echo "   → Check breadcrumbs and extra data"
echo ""

echo "=================================="
echo "🔍 Debugging Info"
echo "=================================="
echo ""
echo "If login still fails, check Sentry for:"
echo "  • Clerk status (needs_first_factor, needs_verification, etc.)"
echo "  • Device info (platform, width, version)"
echo "  • Breadcrumbs (login flow steps)"
echo "  • Error messages and stack traces"
echo ""

echo "=================================="
echo "✅ Deployment Complete!"
echo "=================================="
echo ""
print_success "All changes deployed successfully!"
print_status "Monitor Railway and EAS dashboards for deployment status."
echo ""
