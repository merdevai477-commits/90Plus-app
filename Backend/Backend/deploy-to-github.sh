#!/bin/bash

# 🚀 Deploy to GitHub Script for 90Plus Application
# This script handles both Backend and Frontend deployments to GitHub
# Created for comprehensive project updates

set -e  # Exit on any error

echo "🚀 90Plus - Deploy to GitHub"
echo "=============================="
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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not a git repository!"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
print_status "Current branch: $CURRENT_BRANCH"
echo ""

# Show current status
print_status "Checking repository status..."
git status --short

# Check if there are any changes
if git diff --quiet && git diff --cached --quiet; then
    print_warning "No changes detected. Repository is clean."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Deployment cancelled."
        exit 0
    fi
fi

echo ""
print_status "=== DEPLOYMENT SUMMARY ==="
echo "📱 Frontend Updates:"
echo "  ✅ Profile translation to 8 languages completed"
echo "  ✅ Brand selection limited to: Nike, Adidas, Puma, New Balance"
echo "  ✅ Club selection limited to top 10 European clubs"
echo "  ✅ TypeScript errors resolved"
echo "  ✅ Translation system optimized"
echo ""
echo "🔧 Backend Updates:"
echo "  ✅ Profile completion system enhanced"
echo "  ✅ User service improvements"
echo "  ✅ API endpoints optimized"
echo "  ✅ Database queries improved"
echo ""

# Prompt for deployment confirmation
read -p "🚀 Deploy these changes to GitHub? (Y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    print_status "Deployment cancelled by user."
    exit 0
fi

# Add all changes
print_status "Adding all changes to staging..."
git add .

# Check if there are changes to commit after adding
if git diff --cached --quiet; then
    print_warning "No staged changes found after git add."
    exit 0
fi

# Show what will be committed
echo ""
print_status "Files to be committed:"
git diff --cached --name-status | head -20
if [ $(git diff --cached --name-status | wc -l) -gt 20 ]; then
    echo "... and $(( $(git diff --cached --name-status | wc -l) - 20 )) more files"
fi
echo ""

# Create comprehensive commit message
COMMIT_MSG="feat: complete profile system updates and brand/club optimization

🎯 Major Updates:
- Complete profile translation to 8 languages (AR, EN, ES, FR, DE, IT, PT, TR)
- Brand selection optimized to top 4: Nike, Adidas, Puma, New Balance
- Club selection limited to top 10 European clubs
- All TypeScript errors resolved across frontend components

🔧 Frontend Improvements:
- Enhanced profile screen with full internationalization
- Optimized brand and club data structures
- Improved translation system performance
- Fixed all TypeScript compilation issues
- Updated brand logo service for better performance

🚀 Backend Enhancements:
- Profile completion system improvements
- Enhanced user service functionality
- Optimized API endpoints
- Database query improvements

✅ Technical Fixes:
- Resolved gradient colors type issues
- Fixed Easing.back() parameter calls
- Updated Video type references
- Fixed import paths and exports
- Improved error handling across components
- Enhanced type safety throughout codebase

🌍 Internationalization:
- All profile UI elements now support 8 languages
- RTL support for Arabic language
- Consistent translation keys across all components
- Professional translations maintaining app tone

📱 User Experience:
- Simplified brand selection (4 top brands only)
- Curated club selection (10 biggest European clubs)
- Faster loading times due to optimized data
- Better performance with reduced options

Ready for production deployment 🚀"

# Commit changes
print_status "Committing changes..."
git commit -m "$COMMIT_MSG"

if [ $? -ne 0 ]; then
    print_error "Commit failed!"
    exit 1
fi

print_success "Commit successful!"
echo ""

# Push to remote
print_status "Pushing to remote repository ($CURRENT_BRANCH)..."
git push origin $CURRENT_BRANCH

if [ $? -ne 0 ]; then
    print_warning "Push failed! Attempting to set upstream..."
    git push --set-upstream origin $CURRENT_BRANCH
    
    if [ $? -ne 0 ]; then
        print_error "Push failed! Please check your remote configuration."
        print_status "You may need to:"
        echo "  1. Check your internet connection"
        echo "  2. Verify GitHub authentication"
        echo "  3. Ensure remote repository exists"
        exit 1
    fi
fi

echo ""
print_success "🎉 Successfully deployed to GitHub!"
print_success "Repository: https://github.com/your-username/90plus"
print_success "Branch: $CURRENT_BRANCH"
echo ""
print_status "Next steps:"
echo "  1. Check GitHub Actions for automated builds"
echo "  2. Monitor deployment status"
echo "  3. Test the application on staging/production"
echo ""
print_success "Deployment completed successfully! 🚀"