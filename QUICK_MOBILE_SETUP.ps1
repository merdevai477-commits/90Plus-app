# 🚀 إعداد سريع للاختبار على الموبايل

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🚀 إعداد التطبيق للاختبار على الموبايل" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# التحقق من تثبيت ngrok
if (!(Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ngrok غير مثبت!" -ForegroundColor Red
    Write-Host ""
    Write-Host "📥 قم بتحميله من: https://ngrok.com/download" -ForegroundColor Yellow
    Write-Host "   أو استخدم: choco install ngrok" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "✅ ngrok مثبت" -ForegroundColor Green
Write-Host ""

# التحقق من أن البورت 3000 غير مستخدم
$portInUse = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "⚠️  البورت 3000 مستخدم!" -ForegroundColor Yellow
    Write-Host "   سيتم إيقاف العملية القديمة..." -ForegroundColor Yellow
    
    # Kill process on port 3000
    $processId = (Get-NetTCPConnection -LocalPort 3000).OwningProcess
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "✅ تم إيقاف العملية القديمة" -ForegroundColor Green
    Write-Host ""
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "📡 الخطوة 1: تشغيل ngrok" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host ""

# تشغيل ngrok في نافذة منفصلة
Start-Process -FilePath "ngrok" -ArgumentList "http", "3000" -WindowStyle Normal

Write-Host "⏳ انتظار ngrok للبدء..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# الحصول على ngrok URL
Try {
    $ngrokApi = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -Method Get
    $publicUrl = $ngrokApi.tunnels[0].public_url
    
    Write-Host "✅ ngrok يعمل!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📡 Public URL: $publicUrl" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host "📝 الخطوة 2: تحديث الملفات" -ForegroundColor Magenta
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host ""
    
    # تحديث Backend/.env
    Write-Host "🔧 تحديث Backend/.env..." -ForegroundColor Cyan
    $envPath = "Backend\.env"
    if (Test-Path $envPath) {
        $envContent = Get-Content $envPath -Raw
        
        # Update GOOGLE_CALLBACK_URL
        $newCallbackUrl = "$publicUrl/api/auth/google/callback"
        if ($envContent -match 'GOOGLE_CALLBACK_URL=.*') {
            $envContent = $envContent -replace 'GOOGLE_CALLBACK_URL=.*', "GOOGLE_CALLBACK_URL=$newCallbackUrl"
        } else {
            $envContent += "`nGOOGLE_CALLBACK_URL=$newCallbackUrl"
        }
        
        Set-Content -Path $envPath -Value $envContent -NoNewline
        Write-Host "   ✅ تم تحديث GOOGLE_CALLBACK_URL" -ForegroundColor Green
    }
    
    # تحديث front/app.json
    Write-Host "🔧 تحديث front/app.json..." -ForegroundColor Cyan
    $appJsonPath = "front\app.json"
    if (Test-Path $appJsonPath) {
        $appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
        
        # Update ngrokUrl
        if (-not $appJson.expo.extra) {
            $appJson.expo | Add-Member -MemberType NoteProperty -Name "extra" -Value @{}
        }
        $appJson.expo.extra.ngrokUrl = $publicUrl
        
        $appJson | ConvertTo-Json -Depth 10 | Set-Content -Path $appJsonPath
        Write-Host "   ✅ تم تحديث ngrokUrl" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host "⚠️  الخطوة 3: تحديث Google Cloud Console (مرة واحدة فقط)" -ForegroundColor Red
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host ""
    Write-Host "1. افتح: https://console.cloud.google.com/" -ForegroundColor White
    Write-Host "2. اذهب إلى: APIs & Services → Credentials" -ForegroundColor White
    Write-Host "3. أضف Authorized redirect URI:" -ForegroundColor White
    Write-Host ""
    Write-Host "   $publicUrl/api/auth/google/callback" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host "📊 مراقبة الطلبات: http://localhost:4040" -ForegroundColor Magenta
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "⏸️  بعد تحديث Google Console، اضغط Enter لبدء Backend..." -ForegroundColor Cyan
    Write-Host ""
    
    # انتظار المستخدم
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "🚀 الخطوة 4: تشغيل Backend" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "📍 Backend URL: $publicUrl" -ForegroundColor Yellow
    Write-Host "📍 API URL: $publicUrl/api" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "📱 الخطوة 5: في نافذة أخرى، شغّل Frontend:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   cd front" -ForegroundColor White
    Write-Host "   npm start" -ForegroundColor White
    Write-Host "   # ثم اضغط 'r' لإعادة التحميل" -ForegroundColor Gray
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "✅ جاهز للاختبار على الموبايل!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    
    # تشغيل Backend
    Set-Location Backend
    npm run dev
    
} Catch {
    Write-Host ""
    Write-Host "❌ خطأ في الحصول على ngrok URL!" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 تحقق يدوياً من:" -ForegroundColor Yellow
    Write-Host "   1. أن ngrok يعمل: http://localhost:4040" -ForegroundColor White
    Write-Host "   2. أن البورت 3000 غير مستخدم" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 نصيحة: افتح http://localhost:4040 في المتصفح لرؤية ngrok URL" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}
