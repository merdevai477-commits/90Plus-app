#!/bin/bash

# 90Plus - Git Deployment Script
# This script commits and pushes all Apple Review fixes to GitHub

set -e  # Exit on error

echo "🚀 90Plus - Git Deployment Script"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Not a git repository${NC}"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}📍 Current branch: ${CURRENT_BRANCH}${NC}"
echo ""

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}📝 Uncommitted changes detected${NC}"
    echo ""
    
    # Show status
    echo -e "${BLUE}📊 Git Status:${NC}"
    git status --short
    echo ""
    
    # Stage all changes
    echo -e "${BLUE}➕ Staging all changes...${NC}"
    git add .
    echo -e "${GREEN}✅ All changes staged${NC}"
    echo ""
    
    # Create commit message
    COMMIT_MSG="fix: Apple Review compliance fixes

✅ Copycat Content Removal (COMPLETE)
- Replaced all copyrighted team/league names with generic alternatives
- Removed all official logo URLs from database and seed files
- Updated all 8 language files (EN, AR, ES, FR, DE, IT, PT, TR)
- Updated frontend components and backend seed data
- Tests: 9/9 bug exploration + 21/21 preservation passing

⏳ Performance & Loading Fixes (IN PROGRESS)
- Bug exploration test written and passing
- Preservation tests in progress
- Implementation pending (17 subtasks)

📋 Documentation
- Added APPLE_REVIEW_STATUS.md with complete status tracking
- Updated all spec task files

🎯 Ready for Resubmission
- Copycat content issue: ✅ RESOLVED
- Performance issues: ⏳ IN PROGRESS
- Demo account: ❌ PENDING
- Compliance requirements: ❌ PENDING

Refs: #apple-review #guideline-4.1 #performance-fixes"
    
    # Commit changes
    echo -e "${BLUE}💾 Committing changes...${NC}"
    git commit -m "$COMMIT_MSG"
    echo -e "${GREEN}✅ Changes committed${NC}"
    echo ""
else
    echo -e "${GREEN}✅ No uncommitted changes${NC}"
    echo ""
fi

# Check if there are commits to push
UNPUSHED=$(git log origin/${CURRENT_BRANCH}..HEAD --oneline 2>/dev/null | wc -l)

if [ "$UNPUSHED" -gt 0 ]; then
    echo -e "${YELLOW}📤 ${UNPUSHED} commit(s) ready to push${NC}"
    echo ""
    
    # Show commits to be pushed
    echo -e "${BLUE}📋 Commits to push:${NC}"
    git log origin/${CURRENT_BRANCH}..HEAD --oneline --decorate
    echo ""
    
    # Push to remote
    echo -e "${BLUE}🚀 Pushing to origin/${CURRENT_BRANCH}...${NC}"
    git push origin ${CURRENT_BRANCH}
    echo -e "${GREEN}✅ Successfully pushed to GitHub${NC}"
    echo ""
else
    echo -e "${GREEN}✅ Already up to date with origin/${CURRENT_BRANCH}${NC}"
    echo ""
fi

# Summary
echo "=================================="
echo -e "${GREEN}✅ Git deployment complete!${NC}"
echo ""
echo -e "${BLUE}📊 Summary:${NC}"
echo "  - Branch: ${CURRENT_BRANCH}"
echo "  - Remote: origin"
echo "  - Status: Up to date"
echo ""
echo -e "${YELLOW}🔗 Next steps:${NC}"
echo "  1. Run ./deploy-expo.sh to build and deploy to Expo"
echo "  2. Test on TestFlight"
echo "  3. Submit to Apple Review"
echo ""
