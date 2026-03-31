# Script to start Fly.io machines
# Run this before using the app if machines are stopped

Write-Host "🚀 Starting Fly.io machines..." -ForegroundColor Green

# Start database
Write-Host "📦 Starting database..." -ForegroundColor Cyan
flyctl machine start 68372d7cd47478 --app 90plus-db

# Wait for database to be ready
Write-Host "⏳ Waiting for database to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Start backend
Write-Host "🔧 Starting backend..." -ForegroundColor Cyan
flyctl machine start 78197e2b4ee578 --app 90plus-backend

# Wait for backend to be ready
Write-Host "⏳ Waiting for backend to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check health
Write-Host "🏥 Checking API health..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "https://90plus-backend.fly.dev/api/health" -UseBasicParsing | ConvertFrom-Json
    if ($response.status -eq "OK" -and $response.database -eq "Connected") {
        Write-Host "✅ All systems operational!" -ForegroundColor Green
        Write-Host "   Status: $($response.status)" -ForegroundColor White
        Write-Host "   Database: $($response.database)" -ForegroundColor White
    } else {
        Write-Host "⚠️  System partially operational" -ForegroundColor Yellow
        Write-Host "   Status: $($response.status)" -ForegroundColor White
        Write-Host "   Database: $($response.database)" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Failed to check health: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Done! Your app is ready to use." -ForegroundColor Green
