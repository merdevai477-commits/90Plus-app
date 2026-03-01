# 90Plus - Expo Deployment Script (PowerShell)
# This script builds and deploys the app to Expo/EAS

$ErrorActionPreference = "Stop"

Write-Host "🚀 90Plus - Expo Deployment Script" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the front directory
if (-not (Test-Path "front/package.json")) {
    Write-Host "❌ Error: front/package.json not found" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory"
    exit 1
}

# Navigate to front directory
Set-Location front

Write-Host "📍 Working directory: $(Get-Location)" -ForegroundColor Blue
Write-Host ""

# Check if EAS CLI is installed
$EAS_INSTALLED = Get-Command eas -ErrorAction SilentlyContinue
if (-not $EAS_INSTALLED) {
    Write-Host "⚠️  EAS CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g eas-cli
    Write-Host "✅ EAS CLI installed" -ForegroundColor Green
    Write-Host ""
}

# Check EAS login status
Write-Host "🔐 Checking EAS authentication..." -ForegroundColor Blue
$EAS_USER = eas whoami 2>$null
if (-not $EAS_USER) {
    Write-Host "⚠️  Not logged in to EAS. Please login:" -ForegroundColor Yellow
    eas login
    Write-Host ""
    $EAS_USER = eas whoami
}

Write-Host "✅ Logged in as: $EAS_USER" -ForegroundColor Green
Write-Host ""

# Get current version from app.json
$APP_JSON = Get-Content "app.json" | ConvertFrom-Json
$CURRENT_VERSION = $APP_JSON.expo.version
Write-Host "📦 Current version: $CURRENT_VERSION" -ForegroundColor Blue
Write-Host ""

# Ask user if they want to bump version
$BUMP_VERSION = Read-Host "❓ Do you want to bump the version? (y/n)"

if ($BUMP_VERSION -match "^[Yy]$") {
    Write-Host ""
    Write-Host "Select version bump type:" -ForegroundColor Blue
    Write-Host "  1) Patch (1.0.0 -> 1.0.1)"
    Write-Host "  2) Minor (1.0.0 -> 1.1.0)"
    Write-Host "  3) Major (1.0.0 -> 2.0.0)"
    Write-Host "  4) Custom"
    Write-Host ""
    $VERSION_CHOICE = Read-Host "Enter choice (1-4)"
    
    $VERSION_PARTS = $CURRENT_VERSION -split '\.'
    $MAJOR = [int]$VERSION_PARTS[0]
    $MINOR = [int]$VERSION_PARTS[1]
    $PATCH = [int]$VERSION_PARTS[2]
    
    switch ($VERSION_CHOICE) {
        "1" {
            # Patch version
            $PATCH++
            $NEW_VERSION = "$MAJOR.$MINOR.$PATCH"
        }
        "2" {
            # Minor version
            $MINOR++
            $PATCH = 0
            $NEW_VERSION = "$MAJOR.$MINOR.$PATCH"
        }
        "3" {
            # Major version
            $MAJOR++
            $MINOR = 0
            $PATCH = 0
            $NEW_VERSION = "$MAJOR.$MINOR.$PATCH"
        }
        "4" {
            # Custom version
            $NEW_VERSION = Read-Host "Enter new version"
        }
        default {
            Write-Host "❌ Invalid choice" -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host ""
    Write-Host "📝 Updating version from $CURRENT_VERSION to $NEW_VERSION..." -ForegroundColor Blue
    
    # Update version in app.json
    $APP_JSON.expo.version = $NEW_VERSION
    $APP_JSON | ConvertTo-Json -Depth 100 | Set-Content "app.json"
    
    Write-Host "✅ Version updated to $NEW_VERSION" -ForegroundColor Green
    Write-Host ""
    
    $CURRENT_VERSION = $NEW_VERSION
}

# Select build profile
Write-Host "🎯 Select build profile:" -ForegroundColor Blue
Write-Host "  1) Development (internal testing)"
Write-Host "  2) Preview (TestFlight)"
Write-Host "  3) Production (App Store)"
Write-Host ""
$BUILD_PROFILE_CHOICE = Read-Host "Enter choice (1-3)"

switch ($BUILD_PROFILE_CHOICE) {
    "1" {
        $BUILD_PROFILE = "development"
        $PLATFORM_CHOICE = "ios"
    }
    "2" {
        $BUILD_PROFILE = "preview"
        Write-Host ""
        Write-Host "📱 Select platform:" -ForegroundColor Blue
        Write-Host "  1) iOS only"
        Write-Host "  2) Android only"
        Write-Host "  3) Both platforms"
        Write-Host ""
        $PLATFORM_CHOICE_NUM = Read-Host "Enter choice (1-3)"
        
        switch ($PLATFORM_CHOICE_NUM) {
            "1" { $PLATFORM_CHOICE = "ios" }
            "2" { $PLATFORM_CHOICE = "android" }
            "3" { $PLATFORM_CHOICE = "all" }
            default {
                Write-Host "❌ Invalid choice" -ForegroundColor Red
                exit 1
            }
        }
    }
    "3" {
        $BUILD_PROFILE = "production"
        Write-Host ""
        Write-Host "📱 Select platform:" -ForegroundColor Blue
        Write-Host "  1) iOS only"
        Write-Host "  2) Android only"
        Write-Host "  3) Both platforms"
        Write-Host ""
        $PLATFORM_CHOICE_NUM = Read-Host "Enter choice (1-3)"
        
        switch ($PLATFORM_CHOICE_NUM) {
            "1" { $PLATFORM_CHOICE = "ios" }
            "2" { $PLATFORM_CHOICE = "android" }
            "3" { $PLATFORM_CHOICE = "all" }
            default {
                Write-Host "❌ Invalid choice" -ForegroundColor Red
                exit 1
            }
        }
    }
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "📋 Build Configuration:" -ForegroundColor Blue
Write-Host "  - Version: $CURRENT_VERSION"
Write-Host "  - Profile: $BUILD_PROFILE"
Write-Host "  - Platform: $PLATFORM_CHOICE"
Write-Host ""

# Confirm build
$CONFIRM_BUILD = Read-Host "❓ Proceed with build? (y/n)"

if ($CONFIRM_BUILD -notmatch "^[Yy]$") {
    Write-Host "⚠️  Build cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🔨 Starting EAS build..." -ForegroundColor Blue
Write-Host ""

# Run EAS build
if ($PLATFORM_CHOICE -eq "all") {
    Write-Host "📱 Building for iOS..." -ForegroundColor Blue
    eas build --profile $BUILD_PROFILE --platform ios --non-interactive
    Write-Host ""
    Write-Host "🤖 Building for Android..." -ForegroundColor Blue
    eas build --profile $BUILD_PROFILE --platform android --non-interactive
} else {
    eas build --profile $BUILD_PROFILE --platform $PLATFORM_CHOICE --non-interactive
}

Write-Host ""
Write-Host "✅ Build submitted successfully!" -ForegroundColor Green
Write-Host ""

# Show build status
Write-Host "📊 Checking build status..." -ForegroundColor Blue
eas build:list --limit 5
Write-Host ""

# Summary
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "✅ Expo deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Blue
Write-Host "  - Version: $CURRENT_VERSION"
Write-Host "  - Profile: $BUILD_PROFILE"
Write-Host "  - Platform: $PLATFORM_CHOICE"
Write-Host ""
Write-Host "🔗 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Monitor build progress: eas build:list"
Write-Host "  2. Download build when ready: eas build:download"
Write-Host "  3. Test on real device"
Write-Host "  4. Submit to App Store: eas submit"
Write-Host ""
Write-Host "📱 Useful commands:" -ForegroundColor Blue
Write-Host "  - Check build status: eas build:list"
Write-Host "  - View build logs: eas build:view [BUILD_ID]"
Write-Host "  - Submit to stores: eas submit -p ios"
Write-Host "  - Update OTA: eas update --branch production"
Write-Host ""

# Return to root directory
Set-Location ..
