# Check Railway Database Connection
# This script helps diagnose database connection issues on Railway

Write-Host "🔍 Checking Railway Database Connection..." -ForegroundColor Cyan
Write-Host ""

# Check if railway CLI is installed
$railwayInstalled = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railwayInstalled) {
    Write-Host "❌ Railway CLI not installed" -ForegroundColor Red
    Write-Host "   Install from: https://docs.railway.app/develop/cli" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Railway CLI installed" -ForegroundColor Green
Write-Host ""

# Check if project is linked
Write-Host "📡 Checking Railway project link..." -ForegroundColor Cyan
$linkCheck = railway status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ No Railway project linked" -ForegroundColor Red
    Write-Host "   Run: railway link" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Project linked" -ForegroundColor Green
Write-Host ""

# Get environment variables
Write-Host "🔐 Fetching environment variables..." -ForegroundColor Cyan
$envVars = railway variables 2>&1

if ($envVars -match "DATABASE_URL") {
    Write-Host "✅ DATABASE_URL is set" -ForegroundColor Green
    
    # Check if it's a reference or actual value
    if ($envVars -match '\$\{\{Postgres\.DATABASE_URL\}\}') {
        Write-Host "⚠️  DATABASE_URL is a reference: \${{Postgres.DATABASE_URL}}" -ForegroundColor Yellow
        Write-Host "   This means you need a PostgreSQL service attached" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📋 To fix:" -ForegroundColor Cyan
        Write-Host "   1. Go to Railway Dashboard" -ForegroundColor White
        Write-Host "   2. Click 'New' → 'Database' → 'Add PostgreSQL'" -ForegroundColor White
        Write-Host "   3. Wait for deployment" -ForegroundColor White
        Write-Host "   4. DATABASE_URL will be automatically populated" -ForegroundColor White
    } else {
        Write-Host "✅ DATABASE_URL has actual value" -ForegroundColor Green
    }
} else {
    Write-Host "❌ DATABASE_URL not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 To fix:" -ForegroundColor Cyan
    Write-Host "   Option 1: Add PostgreSQL service (Recommended)" -ForegroundColor White
    Write-Host "   1. Go to Railway Dashboard" -ForegroundColor White
    Write-Host "   2. Click 'New' → 'Database' → 'Add PostgreSQL'" -ForegroundColor White
    Write-Host "   3. Set DATABASE_URL=\${{Postgres.DATABASE_URL}}" -ForegroundColor White
    Write-Host ""
    Write-Host "   Option 2: Use external database (Neon)" -ForegroundColor White
    Write-Host "   1. Copy DATABASE_URL from .env file" -ForegroundColor White
    Write-Host "   2. Run: railway variables set DATABASE_URL='your-neon-url'" -ForegroundColor White
}

Write-Host ""
Write-Host "🔍 Checking other required variables..." -ForegroundColor Cyan

$requiredVars = @(
    "CLERK_SECRET_KEY",
    "CLERK_PUBLISHABLE_KEY",
    "REDIS_URL",
    "R2_ACCOUNT_ID",
    "FOOTBALL_API_KEY"
)

$missingVars = @()
foreach ($var in $requiredVars) {
    if ($envVars -match $var) {
        Write-Host "  ✅ $var" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $var" -ForegroundColor Red
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  Missing variables: $($missingVars -join ', ')" -ForegroundColor Yellow
    Write-Host "   Copy from RAILWAY_ENV_VARIABLES.txt" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📊 Current deployment status:" -ForegroundColor Cyan
railway status

Write-Host ""
Write-Host "💡 Quick fixes:" -ForegroundColor Cyan
Write-Host "   1. Add PostgreSQL: railway add" -ForegroundColor White
Write-Host "   2. Set variables: railway variables set KEY=VALUE" -ForegroundColor White
Write-Host "   3. View logs: railway logs" -ForegroundColor White
Write-Host "   4. Redeploy: railway up" -ForegroundColor White
