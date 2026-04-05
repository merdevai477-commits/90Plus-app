# Railway Deployment Script
# يقوم بنشر Backend على Railway

Write-Host "🚂 Railway Deployment Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Railway CLI is installed
Write-Host "📦 Checking Railway CLI..." -ForegroundColor Yellow
$railwayInstalled = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railwayInstalled) {
    Write-Host "❌ Railway CLI not installed" -ForegroundColor Red
    Write-Host "Installing Railway CLI..." -ForegroundColor Yellow
    npm install -g @railway/cli
    Write-Host "✅ Railway CLI installed" -ForegroundColor Green
} else {
    Write-Host "✅ Railway CLI already installed" -ForegroundColor Green
}

Write-Host ""

# Check if logged in
Write-Host "🔐 Checking Railway login..." -ForegroundColor Yellow
$loginCheck = railway whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not logged in to Railway" -ForegroundColor Red
    Write-Host "Logging in..." -ForegroundColor Yellow
    railway login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Login failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Logged in as: $loginCheck" -ForegroundColor Green
}

Write-Host ""

# Check if project is linked
Write-Host "🔗 Checking project link..." -ForegroundColor Yellow
$statusCheck = railway status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ No project linked" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please follow these steps:" -ForegroundColor Cyan
    Write-Host "1. Go to https://railway.app/dashboard" -ForegroundColor White
    Write-Host "2. Create a new project" -ForegroundColor White
    Write-Host "3. Add PostgreSQL database" -ForegroundColor White
    Write-Host "4. Deploy from GitHub or run: railway init" -ForegroundColor White
    Write-Host ""
    $continue = Read-Host "Have you created the project? (y/n)"
    if ($continue -ne "y") {
        Write-Host "❌ Deployment cancelled" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Linking to project..." -ForegroundColor Yellow
    railway link
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to link project" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Project linked" -ForegroundColor Green
}

Write-Host ""

# Build locally first
Write-Host "🔨 Building project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build successful" -ForegroundColor Green

Write-Host ""

# Deploy
Write-Host "🚀 Deploying to Railway..." -ForegroundColor Yellow
railway up
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment successful!" -ForegroundColor Green
Write-Host ""

# Get deployment URL
Write-Host "🌐 Getting deployment URL..." -ForegroundColor Yellow
$domain = railway domain 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Your API is live at: $domain" -ForegroundColor Green
} else {
    Write-Host "⚠️ No domain configured yet" -ForegroundColor Yellow
    Write-Host "Run: railway domain" -ForegroundColor White
}

Write-Host ""
Write-Host "📊 View logs: railway logs" -ForegroundColor Cyan
Write-Host "📈 View metrics: railway status" -ForegroundColor Cyan
Write-Host "🔧 Open dashboard: railway open" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 Done!" -ForegroundColor Green
