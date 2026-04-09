#!/bin/bash
# Quick push script for Backend

echo "🚀 Quick push to GitHub..."

# Add all changes
git add .

# Check if there are changes
if git diff --staged --quiet; then
    echo "ℹ️ No changes to commit"
    git status
else
    # Commit with timestamp
    git commit -m "Backend update - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "✅ Committed changes"
fi

# Push to GitHub
echo "🌐 Pushing to GitHub..."
git push origin main

echo "✅ Done! Check: https://github.com/merdevai477-commits/90Plus-app"