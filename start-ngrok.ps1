# 🚀 Start Backend with ngrok

Write-Host "🔧 Starting ngrok tunnel for Backend..." -ForegroundColor Cyan
Write-Host ""

# Start ngrok in background
$ngrokProcess = Start-Process -FilePath "ngrok" -ArgumentList "http", "3000" -PassThru -WindowStyle Normal

# Wait for ngrok to start
Start-Sleep -Seconds 3

# Get ngrok URL
Try {
    $ngrokApi = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -Method Get
    $publicUrl = $ngrokApi.tunnels[0].public_url
    
    Write-Host "✅ ngrok tunnel started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📡 Public URL: $publicUrl" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host "⚠️  IMPORTANT STEPS:" -ForegroundColor Red
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "1. Update Google Cloud Console:" -ForegroundColor Cyan
    Write-Host "   Go to: https://console.cloud.google.com/" -ForegroundColor White
    Write-Host "   Navigate to: APIs & Services → Credentials" -ForegroundColor White
    Write-Host "   Add this to Authorized redirect URIs:" -ForegroundColor White
    Write-Host "   $publicUrl/api/auth/google/callback" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "2. Update your .env file:" -ForegroundColor Cyan
    Write-Host "   GOOGLE_CALLBACK_URL=$publicUrl/api/auth/google/callback" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "3. After updating, press any key to start the Backend server..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "📊 Monitor requests: http://localhost:4040" -ForegroundColor Magenta
    Write-Host ""
    
    # Wait for user
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
    Write-Host ""
    Write-Host "🚀 Starting Backend server..." -ForegroundColor Green
    Write-Host ""
    
    # Start Backend
    npm run dev
    
} Catch {
    Write-Host "❌ Error getting ngrok URL. Make sure ngrok is running." -ForegroundColor Red
    Write-Host "You can manually check the URL at: http://localhost:4040" -ForegroundColor Yellow
}
