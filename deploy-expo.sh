#!/bin/bash

# 90Plus - Expo Deployment Script
# This script builds and deploys the app to Expo/EAS

set -e  # Exit on error

echo "🚀 90Plus - Expo Deployment Script"
echo "==================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the front directory
if [ ! -f "front/package.json" ]; then
    echo -e "${RED}❌ Error: front/package.json not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Navigate to front directory
cd front

echo -e "${BLUE}📍 Working directory: $(pwd)${NC}"
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo -e "${YELLOW}⚠️  EAS CLI not found. Installing...${NC}"
    npm install -g eas-cli
    echo -e "${GREEN}✅ EAS CLI installed${NC}"
    echo ""
fi

# Check EAS login status
echo -e "${BLUE}🔐 Checking EAS authentication...${NC}"
if ! eas whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to EAS. Please login:${NC}"
    eas login
    echo ""
fi

EAS_USER=$(eas whoami)
echo -e "${GREEN}✅ Logged in as: ${EAS_USER}${NC}"
echo ""

# Get current version from app.json
CURRENT_VERSION=$(node -p "require('./app.json').expo.version")
echo -e "${BLUE}📦 Current version: ${CURRENT_VERSION}${NC}"
echo ""

# Ask user if they want to bump version
echo -e "${YELLOW}❓ Do you want to bump the version? (y/n)${NC}"
read -r BUMP_VERSION

if [[ "$BUMP_VERSION" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}Select version bump type:${NC}"
    echo "  1) Patch (1.0.0 -> 1.0.1)"
    echo "  2) Minor (1.0.0 -> 1.1.0)"
    echo "  3) Major (1.0.0 -> 2.0.0)"
    echo "  4) Custom"
    echo ""
    read -p "Enter choice (1-4): " VERSION_CHOICE
    
    case $VERSION_CHOICE in
        1)
            # Patch version
            NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$NF = $NF + 1;} 1' | sed 's/ /./g')
            ;;
        2)
            # Minor version
            NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$(NF-1) = $(NF-1) + 1; $NF = 0;} 1' | sed 's/ /./g')
            ;;
        3)
            # Major version
            NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$1 = $1 + 1; $2 = 0; $3 = 0;} 1' | sed 's/ /./g')
            ;;
        4)
            # Custom version
            read -p "Enter new version: " NEW_VERSION
            ;;
        *)
            echo -e "${RED}❌ Invalid choice${NC}"
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${BLUE}📝 Updating version from ${CURRENT_VERSION} to ${NEW_VERSION}...${NC}"
    
    # Update version in app.json
    node -e "
    const fs = require('fs');
    const appJson = require('./app.json');
    appJson.expo.version = '${NEW_VERSION}';
    fs.writeFileSync('./app.json', JSON.stringify(appJson, null, 2) + '\n');
    "
    
    echo -e "${GREEN}✅ Version updated to ${NEW_VERSION}${NC}"
    echo ""
    
    CURRENT_VERSION=$NEW_VERSION
fi

# Select build profile
echo -e "${BLUE}🎯 Select build profile:${NC}"
echo "  1) Development (internal testing)"
echo "  2) Preview (TestFlight)"
echo "  3) Production (App Store)"
echo ""
read -p "Enter choice (1-3): " BUILD_PROFILE_CHOICE

case $BUILD_PROFILE_CHOICE in
    1)
        BUILD_PROFILE="development"
        PLATFORM_CHOICE="ios"
        ;;
    2)
        BUILD_PROFILE="preview"
        echo ""
        echo -e "${BLUE}📱 Select platform:${NC}"
        echo "  1) iOS only"
        echo "  2) Android only"
        echo "  3) Both platforms"
        echo ""
        read -p "Enter choice (1-3): " PLATFORM_CHOICE_NUM
        
        case $PLATFORM_CHOICE_NUM in
            1) PLATFORM_CHOICE="ios" ;;
            2) PLATFORM_CHOICE="android" ;;
            3) PLATFORM_CHOICE="all" ;;
            *)
                echo -e "${RED}❌ Invalid choice${NC}"
                exit 1
                ;;
        esac
        ;;
    3)
        BUILD_PROFILE="production"
        echo ""
        echo -e "${BLUE}📱 Select platform:${NC}"
        echo "  1) iOS only"
        echo "  2) Android only"
        echo "  3) Both platforms"
        echo ""
        read -p "Enter choice (1-3): " PLATFORM_CHOICE_NUM
        
        case $PLATFORM_CHOICE_NUM in
            1) PLATFORM_CHOICE="ios" ;;
            2) PLATFORM_CHOICE="android" ;;
            3) PLATFORM_CHOICE="all" ;;
            *)
                echo -e "${RED}❌ Invalid choice${NC}"
                exit 1
                ;;
        esac
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}📋 Build Configuration:${NC}"
echo "  - Version: ${CURRENT_VERSION}"
echo "  - Profile: ${BUILD_PROFILE}"
echo "  - Platform: ${PLATFORM_CHOICE}"
echo ""

# Confirm build
echo -e "${YELLOW}❓ Proceed with build? (y/n)${NC}"
read -r CONFIRM_BUILD

if [[ ! "$CONFIRM_BUILD" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Build cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}🔨 Starting EAS build...${NC}"
echo ""

# Run EAS build
if [ "$PLATFORM_CHOICE" = "all" ]; then
    echo -e "${BLUE}📱 Building for iOS...${NC}"
    eas build --profile ${BUILD_PROFILE} --platform ios --non-interactive
    echo ""
    echo -e "${BLUE}🤖 Building for Android...${NC}"
    eas build --profile ${BUILD_PROFILE} --platform android --non-interactive
else
    eas build --profile ${BUILD_PROFILE} --platform ${PLATFORM_CHOICE} --non-interactive
fi

echo ""
echo -e "${GREEN}✅ Build submitted successfully!${NC}"
echo ""

# Show build status
echo -e "${BLUE}📊 Checking build status...${NC}"
eas build:list --limit 5
echo ""

# Summary
echo "==================================="
echo -e "${GREEN}✅ Expo deployment complete!${NC}"
echo ""
echo -e "${BLUE}📊 Summary:${NC}"
echo "  - Version: ${CURRENT_VERSION}"
echo "  - Profile: ${BUILD_PROFILE}"
echo "  - Platform: ${PLATFORM_CHOICE}"
echo ""
echo -e "${YELLOW}🔗 Next steps:${NC}"
echo "  1. Monitor build progress: eas build:list"
echo "  2. Download build when ready: eas build:download"
echo "  3. Test on real device"
echo "  4. Submit to App Store: eas submit"
echo ""
echo -e "${BLUE}📱 Useful commands:${NC}"
echo "  - Check build status: eas build:list"
echo "  - View build logs: eas build:view [BUILD_ID]"
echo "  - Submit to stores: eas submit -p ios"
echo "  - Update OTA: eas update --branch production"
echo ""
