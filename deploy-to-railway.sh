#!/bin/bash

# ============================================================================
# Deploy to Railway via GitHub
# ============================================================================
# 
# This script commits all changes and pushes to GitHub
# Railway will automatically deploy the changes
#
# Usage:
#   chmod +x deploy-to-railway.sh
#   ./deploy-to-railway.sh "Your commit message"
#
# @author Kiro AI Assistant
# @date 2026-03-31
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_section() {
    echo ""
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}============================================================${NC}"
}

# ============================================================================
# 1. CHECK PREREQUISITES
# ============================================================================

log_section "1. CHECKING PREREQUISITES"

# Check if git is installed
if ! command -v git &> /dev/null; then
    log_error "Git is not installed!"
    exit 1
fi

log_success "Git is installed: $(git --version)"

# Check if we're in a git repository
if [ ! -d .git ]; then
    log_error "Not a git repository!"
    log_info "Initialize git first: git init"
    exit 1
fi

log_success "Git repository detected"

# Check if there are any changes
if git diff-index --quiet HEAD --; then
    log_warning "No changes to commit"
    log_info "Everything is up to date!"
    exit 0
fi

log_success "Changes detected"

# ============================================================================
# 2. GET COMMIT MESSAGE
# ============================================================================

log_section "2. COMMIT MESSAGE"

COMMIT_MESSAGE="$1"

if [ -z "$COMMIT_MESSAGE" ]; then
    log_warning "No commit message provided"
    log_info "Using default message..."
    COMMIT_MESSAGE="🚀 Deploy: GDPR compliance system + updates"
fi

log_info "Commit message: $COMMIT_MESSAGE"

# ============================================================================
# 3. CHECK GIT STATUS
# ============================================================================

log_section "3. GIT STATUS"

log_info "Current branch: $(git branch --show-current)"
log_info "Remote: $(git remote get-url origin 2>/dev/null || echo 'No remote configured')"

echo ""
log_info "Files to be committed:"
git status --short

# ============================================================================
# 4. CONFIRM DEPLOYMENT
# ============================================================================

log_section "4. CONFIRM DEPLOYMENT"

echo ""
log_warning "This will:"
echo "  1. Add all changes to git"
echo "  2. Commit with message: '$COMMIT_MESSAGE'"
echo "  3. Push to GitHub"
echo "  4. Trigger Railway deployment"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warning "Deployment cancelled"
    exit 0
fi

# ============================================================================
# 5. ADD FILES
# ============================================================================

log_section "5. ADDING FILES"

log_info "Adding all changes..."
git add .

log_success "Files added"

# Show what will be committed
log_info "Files staged for commit:"
git diff --cached --name-status

# ============================================================================
# 6. COMMIT CHANGES
# ============================================================================

log_section "6. COMMITTING CHANGES"

log_info "Creating commit..."
git commit -m "$COMMIT_MESSAGE"

log_success "Commit created"

# ============================================================================
# 7. PUSH TO GITHUB
# ============================================================================

log_section "7. PUSHING TO GITHUB"

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

log_info "Pushing to branch: $CURRENT_BRANCH"

# Push to GitHub
if git push origin "$CURRENT_BRANCH"; then
    log_success "Successfully pushed to GitHub!"
else
    log_error "Failed to push to GitHub"
    log_info "Trying to set upstream..."
    
    if git push -u origin "$CURRENT_BRANCH"; then
        log_success "Successfully pushed to GitHub with upstream!"
    else
        log_error "Failed to push. Please check your git configuration."
        exit 1
    fi
fi

# ============================================================================
# 8. RAILWAY DEPLOYMENT
# ============================================================================

log_section "8. RAILWAY DEPLOYMENT"

log_success "Changes pushed to GitHub!"
log_info "Railway will automatically deploy your changes"

echo ""
log_info "Deployment timeline:"
echo "  1. GitHub received your changes ✅"
echo "  2. Railway detected the push 🔄"
echo "  3. Railway is building... ⏳"
echo "  4. Railway will deploy 🚀"

echo ""
log_info "Monitor deployment:"
echo "  • Railway Dashboard: https://railway.app/dashboard"
echo "  • Check logs for deployment status"
echo "  • Deployment usually takes 2-5 minutes"

# ============================================================================
# 9. SUMMARY
# ============================================================================

log_section "9. DEPLOYMENT SUMMARY"

echo ""
log_success "🎉 Deployment initiated successfully!"

echo ""
log_info "What was deployed:"
echo "  • GDPR compliance system"
echo "  • Data export endpoints"
echo "  • Account deletion system"
echo "  • Consent management"
echo "  • Admin routes"
echo "  • Cron jobs"
echo "  • All recent updates"

echo ""
log_info "Next steps:"
echo "  1. Wait for Railway deployment (2-5 minutes)"
echo "  2. Check Railway dashboard for status"
echo "  3. Test endpoints after deployment"
echo "  4. Verify GDPR features are working"

echo ""
log_info "Test commands after deployment:"
echo "  # Health check"
echo "  curl https://your-app.railway.app/api/health"
echo ""
echo "  # GDPR endpoints (requires auth)"
echo "  curl https://your-app.railway.app/api/gdpr/consent \\"
echo "    -H 'Authorization: Bearer YOUR_TOKEN'"

echo ""
log_success "Deployment complete! 🚀"
echo ""
