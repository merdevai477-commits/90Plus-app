# 🚀 تشغيل التطبيق مع Expo Tunnel

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🚀 تشغيل التطبيق مع Expo Tunnel" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# الحصول على Local IP
Write-Host "🔍 البحث عن Local IP Address..." -ForegroundColor Yellow
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" }).IPAddress | Select-Object -First 1

if (-not $localIP) {
    Write-Host "❌ لم يتم العثور على Local IP!" -ForegroundColor Red
    Write-Host "   تأكد من الاتصال بالـ WiFi" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Local IP: $localIP" -ForegroundColor Green
Write-Host ""

$backendUrl = "http://${localIP}:3000"
$apiUrl = "${backendUrl}/api"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "📝 الخطوة 1: تحديث الملفات" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host ""

# تحديث Backend/.env
Write-Host "🔧 تحديث Backend/.env..." -ForegroundColor Cyan
$envPath = "Backend\.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    
    # Update GOOGLE_CALLBACK_URL
    $newCallbackUrl = "${backendUrl}/api/auth/google/callback"
    if ($envContent -match 'GOOGLE_CALLBACK_URL=.*') {
        $envContent = $envContent -replace 'GOOGLE_CALLBACK_URL=.*', "GOOGLE_CALLBACK_URL=$newCallbackUrl"
    } else {
        $envContent += "`nGOOGLE_CALLBACK_URL=$newCallbackUrl"
    }
    
    # Update CORS_ORIGIN
    if ($envContent -match 'CORS_ORIGIN=.*') {
        $envContent = $envContent -replace 'CORS_ORIGIN=.*', "CORS_ORIGIN=http://localhost:8081"
    }
    
    Set-Content -Path $envPath -Value $envContent -NoNewline
    Write-Host "   ✅ تم تحديث Backend/.env" -ForegroundColor Green
}

# تحديث front/app.json
Write-Host "🔧 تحديث front/app.json..." -ForegroundColor Cyan
$appJsonPath = "front\app.json"
if (Test-Path $appJsonPath) {
    $appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
    
    # Update apiUrl
    if (-not $appJson.expo.extra) {
        $appJson.expo | Add-Member -MemberType NoteProperty -Name "extra" -Value @{}
    }
    $appJson.expo.extra.apiUrl = $apiUrl
    
    # Remove ngrokUrl if exists
    if ($appJson.expo.extra.PSObject.Properties.Name -contains "ngrokUrl") {
        $appJson.expo.extra.PSObject.Properties.Remove("ngrokUrl")
    }
    
    $appJson | ConvertTo-Json -Depth 10 | Set-Content -Path $appJsonPath
    Write-Host "   ✅ تم تحديث front/app.json" -ForegroundColor Green
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
Write-Host "⚠️  الخطوة 2: تحديث Google Cloud Console (مرة واحدة فقط)" -ForegroundColor Red
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
Write-Host ""
Write-Host "1. افتح: https://console.cloud.google.com/" -ForegroundColor White
Write-Host "2. اذهب إلى: APIs & Services → Credentials" -ForegroundColor White
Write-Host "3. أضف Authorized redirect URIs:" -ForegroundColor White
Write-Host ""
Write-Host "   ${backendUrl}/api/auth/google/callback" -ForegroundColor Yellow
Write-Host "   http://localhost:3000/api/auth/google/callback" -ForegroundColor Yellow
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📱 الخطوة 3: تشغيل Backend و Frontend" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Backend URL: $backendUrl" -ForegroundColor Yellow
Write-Host "📍 API URL: $apiUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "⏸️  بعد تحديث Google Console، اضغط Enter لبدء Backend..." -ForegroundColor Cyan
Write-Host ""

# انتظار المستخدم
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "🚀 تشغيل Backend..." -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "📝 في نافذة PowerShell أخرى، شغّل Frontend:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   cd front" -ForegroundColor White
Write-Host "   npx expo start --tunnel" -ForegroundColor White
Write-Host ""
Write-Host "   أو:" -ForegroundColor Gray
Write-Host "   npm start" -ForegroundColor White
Write-Host "   # ثم اضغط 't' لتفعيل tunnel" -ForegroundColor Gray
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ جاهز للاختبار على الموبايل!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""

# تشغيل Backend
Set-Location Backend
npm run dev
