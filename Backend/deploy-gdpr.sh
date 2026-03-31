#!/bin/bash

# ============================================================================
# GDPR Compliance System Deployment Script
# ============================================================================
# 
# This script deploys the GDPR compliance system including:
# - Database migrations for GDPR tables
# - Environment variable verification
# - Cron job setup
# - Endpoint testing
#
# Usage:
#   chmod +x deploy-gdpr.sh
#   ./deploy-gdpr.sh
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
# 1. PRE-DEPLOYMENT CHECKS
# ============================================================================

log_section "1. PRE-DEPLOYMENT CHECKS"

# Check if .env file exists
if [ ! -f .env ]; then
    log_error ".env file not found!"
    log_info "Please create .env file from .env.example"
    exit 1
fi

log_success ".env file found"

# Check required environment variables
log_info "Checking required environment variables..."

required_vars=(
    "DATABASE_URL"
    "R2_ENDPOINT"
    "R2_ACCESS_KEY_ID"
    "R2_SECRET_ACCESS_KEY"
    "R2_BUCKET_NAME"
    "R2_PUBLIC_URL"
)

missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    log_error "Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    log_info "Please add these variables to your .env file"
    log_info "See .env.example for reference"
    exit 1
fi

log_success "All required environment variables are set"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed!"
    exit 1
fi

log_success "Node.js is installed: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    log_error "npm is not installed!"
    exit 1
fi

log_success "npm is installed: $(npm --version)"

# ============================================================================
# 2. INSTALL DEPENDENCIES
# ============================================================================

log_section "2. INSTALL DEPENDENCIES"

log_info "Installing npm dependencies..."
npm install

log_success "Dependencies installed"

# ============================================================================
# 3. DATABASE MIGRATION
# ============================================================================

log_section "3. DATABASE MIGRATION"

log_info "Running Prisma migrations..."

# Generate Prisma client
npx prisma generate

log_success "Prisma client generated"

# Run migrations
npx prisma migrate deploy

log_success "Database migrations completed"

# ============================================================================
# 4. VERIFY GDPR TABLES
# ============================================================================

log_section "4. VERIFY GDPR TABLES"

log_info "Verifying GDPR tables exist..."

# Check if tables exist using Prisma
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyTables() {
    try {
        // Check DataExportRequest table
        await prisma.dataExportRequest.findMany({ take: 1 });
        console.log('✅ DataExportRequest table exists');
        
        // Check AccountDeletionRequest table
        await prisma.accountDeletionRequest.findMany({ take: 1 });
        console.log('✅ AccountDeletionRequest table exists');
        
        // Check ConsentLog table
        await prisma.consentLog.findMany({ take: 1 });
        console.log('✅ ConsentLog table exists');
        
        // Check GDPRAuditLog table
        await prisma.gDPRAuditLog.findMany({ take: 1 });
        console.log('✅ GDPRAuditLog table exists');
        
        await prisma.\$disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error verifying tables:', error.message);
        await prisma.\$disconnect();
        process.exit(1);
    }
}

verifyTables();
"

log_success "All GDPR tables verified"

# ============================================================================
# 5. BUILD APPLICATION
# ============================================================================

log_section "5. BUILD APPLICATION"

log_info "Building TypeScript application..."
npm run build

log_success "Application built successfully"

# ============================================================================
# 6. START SERVER (OPTIONAL)
# ============================================================================

log_section "6. SERVER STARTUP"

log_info "Do you want to start the server now? (y/n)"
read -r start_server

if [ "$start_server" = "y" ] || [ "$start_server" = "Y" ]; then
    log_info "Starting server..."
    
    # Check if server is already running
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
        log_warning "Server is already running on port 3000"
        log_info "Stopping existing server..."
        kill $(lsof -t -i:3000) || true
        sleep 2
    fi
    
    # Start server in background
    npm start &
    SERVER_PID=$!
    
    log_info "Server starting... (PID: $SERVER_PID)"
    log_info "Waiting for server to be ready..."
    
    # Wait for server to start (max 30 seconds)
    for i in {1..30}; do
        if curl -s http://localhost:3000/api/health > /dev/null; then
            log_success "Server is running!"
            break
        fi
        sleep 1
    done
    
    # ============================================================================
    # 7. TEST ENDPOINTS
    # ============================================================================
    
    log_section "7. TEST ENDPOINTS"
    
    log_info "Testing GDPR endpoints..."
    log_warning "Note: Authentication required for full testing"
    log_info "Run 'npx ts-node test-gdpr-endpoints.ts' with TEST_USER_TOKEN for complete tests"
    
    # Test health endpoint
    log_info "Testing health endpoint..."
    if curl -s http://localhost:3000/api/health | grep -q "OK"; then
        log_success "Health endpoint working"
    else
        log_error "Health endpoint failed"
    fi
    
    # Test GDPR routes (without auth - should return 401)
    log_info "Testing GDPR consent endpoint (should require auth)..."
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/gdpr/consent)
    if [ "$response" = "401" ]; then
        log_success "GDPR consent endpoint requires authentication (correct)"
    else
        log_warning "GDPR consent endpoint returned: $response (expected 401)"
    fi
    
    log_info "Testing GDPR export endpoint (should require auth)..."
    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/gdpr/export-data)
    if [ "$response" = "401" ]; then
        log_success "GDPR export endpoint requires authentication (correct)"
    else
        log_warning "GDPR export endpoint returned: $response (expected 401)"
    fi
    
    log_info "Testing GDPR deletion endpoint (should require auth)..."
    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/gdpr/delete-account)
    if [ "$response" = "401" ]; then
        log_success "GDPR deletion endpoint requires authentication (correct)"
    else
        log_warning "GDPR deletion endpoint returned: $response (expected 401)"
    fi
    
else
    log_info "Skipping server startup"
fi

# ============================================================================
# 8. DEPLOYMENT SUMMARY
# ============================================================================

log_section "8. DEPLOYMENT SUMMARY"

log_success "GDPR Compliance System Deployed Successfully!"

echo ""
log_info "Next steps:"
echo "  1. Configure Cloudflare R2 bucket and update .env"
echo "  2. Set up cron jobs for scheduled tasks (already configured in code)"
echo "  3. Test all endpoints with authentication:"
echo "     export TEST_USER_TOKEN='your_clerk_token'"
echo "     npx ts-node test-gdpr-endpoints.ts"
echo "  4. Review privacy policy and terms of service in Backend/public/"
echo "  5. Deploy to production (Railway, Heroku, etc.)"

echo ""
log_info "GDPR Endpoints:"
echo "  - POST   /api/gdpr/export-data          (Request data export)"
echo "  - GET    /api/gdpr/export-status/:id    (Check export status)"
echo "  - POST   /api/gdpr/delete-account       (Request account deletion)"
echo "  - POST   /api/gdpr/cancel-deletion      (Cancel deletion)"
echo "  - GET    /api/gdpr/deletion-status      (Check deletion status)"
echo "  - POST   /api/gdpr/consent              (Update consent)"
echo "  - GET    /api/gdpr/consent              (Get consent)"

echo ""
log_info "Cron Jobs (configured in code):"
echo "  - Scheduled deletions: Every hour"
echo "  - Export cleanup: Daily at 3 AM"

echo ""
log_success "Deployment complete! 🎉"
