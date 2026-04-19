#!/bin/bash

# 90Plus Reels — Part 4: Push Script
# This script commits and pushes all Part 4 changes

set -e  # Exit on error

echo "======================================="
echo "90Plus Reels — Part 4: Git Push"
echo "======================================="
echo ""

# Step 1: Check TypeScript (Frontend)
echo "Step 1: Checking TypeScript (Frontend)..."
cd front
npx tsc --noEmit
if [ $? -ne 0 ]; then
    echo "❌ Frontend TypeScript errors found. Fix before pushing."
    exit 1
fi
echo "✅ Frontend TypeScript: OK"
cd ..

# Step 2: Check TypeScript (Backend)
echo ""
echo "Step 2: Checking TypeScript (Backend)..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
    echo "❌ Backend TypeScript errors found. Fix before pushing."
    exit 1
fi
echo "✅ Backend TypeScript: OK"

# Step 3: Stage frontend changes
echo ""
echo "Step 3: Staging frontend changes..."
cd front
git add -A
git commit -m "fix(reels): Part 4 frontend - hardcoded URL fix + expo-clipboard" || echo "No frontend changes to commit"
cd ..

# Step 4: Update frontend submodule reference
echo ""
echo "Step 4: Updating frontend submodule reference..."
git add front

# Step 5: Stage backend changes
echo ""
echo "Step 5: Staging backend changes..."
git add src/routes/daily-spin.routes.ts
git add src/routes/profile.routes.ts
git add src/routes/mux-webhook.routes.ts
git add src/routes/reels.routes.ts
git add src/main.ts
git add src/queues/notification.queue.ts

# Step 6: Stage new files
echo ""
echo "Step 6: Staging new files..."
git add AUDIT_REPORT.md
git add PRE_PUSH_CHECKLIST.md
git add COMMIT_MESSAGE_PART4.txt
git add FINAL_SUMMARY.md
git add test-reels-api.sh
git add fix-error-messages.sh
git add clear-redis-cache.ts
git add scripts/

# Step 7: Stage config changes
echo ""
echo "Step 7: Staging config changes..."
git add .gitignore
git add .kiro/

# Step 8: Commit
echo ""
echo "Step 8: Committing changes..."
git commit -F COMMIT_MESSAGE_PART4.txt

# Step 9: Show summary
echo ""
echo "======================================="
echo "Commit Summary"
echo "======================================="
git log -1 --stat

# Step 10: Push
echo ""
echo "Step 10: Pushing to origin/main..."
read -p "Push to GitHub? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin main
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "Next steps:"
    echo "1. Test production: ./test-reels-api.sh"
    echo "2. Verify Railway deployment"
    echo "3. Run Postman collection"
else
    echo "Push cancelled. Run 'git push origin main' when ready."
fi

echo ""
echo "======================================="
echo "Part 4 Complete! 🎉"
echo "======================================="
