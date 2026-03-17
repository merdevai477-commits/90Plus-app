#!/bin/bash

# Git Push Script for 90Plus Application
# This script adds all changes, commits, and pushes to GitHub

echo "🚀 Starting Git Push Process..."
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not a git repository!"
    exit 1
fi

# Show current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"
echo ""

# Show git status
echo "📊 Current status:"
git status --short
echo ""

# Add all changes
echo "➕ Adding all changes..."
git add .

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "✅ No changes to commit. Everything is up to date!"
    exit 0
fi

# Show what will be committed
echo ""
echo "📝 Files to be committed:"
git diff --cached --name-status
echo ""

# Prompt for commit message
read -p "💬 Enter commit message (or press Enter for default): " COMMIT_MSG

# Use default message if none provided
if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="fix: resolve TypeScript errors across frontend components

- Fixed gradient colors type to tuple format in multiple components
- Fixed Easing.back() calls to include parameter
- Fixed Video type references to use 'any' for dynamic imports
- Fixed import paths and removed unused imports
- Fixed service exports (clubLogoService, brandLogoService)
- Fixed nested object state updates in VisualEnhancements
- Fixed displayMode comparisons to use uppercase values
- Fixed transfer data handling (removed non-existent value property)
- Added missing styles and constants across components
- Improved type safety and error handling"
fi

# Commit changes
echo ""
echo "💾 Committing changes..."
git commit -m "$COMMIT_MSG"

if [ $? -ne 0 ]; then
    echo "❌ Commit failed!"
    exit 1
fi

echo "✅ Commit successful!"
echo ""

# Push to remote
echo "🔄 Pushing to remote ($CURRENT_BRANCH)..."
git push origin $CURRENT_BRANCH

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Push failed! Trying to set upstream..."
    git push --set-upstream origin $CURRENT_BRANCH
    
    if [ $? -ne 0 ]; then
        echo "❌ Push failed! Please check your remote configuration."
        exit 1
    fi
fi

echo ""
echo "✅ Successfully pushed to GitHub!"
echo "🎉 All done!"
