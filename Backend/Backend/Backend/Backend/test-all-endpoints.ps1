# ============================================================================
# Complete API Endpoints Testing Script
# ============================================================================
# 
# Tests all endpoints in the 90Plus API
# 
# Usage:
#   .\test-all-endpoints.ps1
#   .\test-all-endpoints.ps1 -ApiUrl "https://your-app.railway.app"
#   .\test-all-endpoints.ps1 -UserToken "your_token" -AdminToken "admin_token"
#
# @author Kiro AI Assistant
# @date 2026-03-31
# ============================================================================

param(
    [string]$ApiUrl = "http://localhost:3000",
    [string]$UserToken = "",
    [string]$AdminToken = ""
)

Write-Host "`n🚀 90Plus API Complete Testing Suite`n" -ForegroundColor Cyan

# Check if tokens are provided
if ([string]::IsNullOrEmpty($UserToken)) {
    Write-Host "⚠️  No user token provided. Some tests will be skipped." -ForegroundColor Yellow
    Write-Host "   Use: -UserToken 'your_clerk_token'" -ForegroundColor Gray
}

if ([string]::IsNullOrEmpty($AdminToken)) {
    Write-Host "⚠️  No admin token provided. Admin tests will be skipped." -ForegroundColor Yellow
    Write-Host "   Use: -AdminToken 'admin_clerk_token'" -ForegroundColor Gray
}

Write-Host "`n📍 API URL: $ApiUrl" -ForegroundColor Cyan
Write-Host ""

# Set environment variables
$env:API_URL = $ApiUrl
$env:TEST_USER_TOKEN = $UserToken
$env:ADMIN_TOKEN = $AdminToken

# Run the TypeScript test suite
Write-Host "🧪 Running test suite...`n" -ForegroundColor Cyan

try {
    npx ts-node test-all-endpoints.ts
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ All tests completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  Some tests failed. Review the output above." -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n❌ Error running tests: $_" -ForegroundColor Red
    exit 1
}
