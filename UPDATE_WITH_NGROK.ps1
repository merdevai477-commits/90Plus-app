# 🔄 تحديث الملفات بـ ngrok URL تلقائياً

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🔄 تحديث الملفات بـ ngrok URL" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# الحصول على ngrok URL
Try {
    Write-Host "🔍 البحث عن ngrok URL..." -ForegroundColor Yellow
    $ngrokApi = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -Method Get -ErrorAction Stop
    
    if ($ngrokApi.tunnels.Count -eq 0) {
        Write-Host "❌ ngrok يعمل لكن لا توجد tunnels نشطة!" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 لتشغيل ngrok:" -ForegroundColor Yellow
        Write-Host "   ngrok http 3000" -ForegroundColor White
        Write-Host ""
        exit 1
    }
    
    # الحصول على HTTPS URL
    $publicUrl = $ngrokApi.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1 -ExpandProperty public_url
    
    if (-not $publicUrl) {
        $publicUrl = $ngrokApi.tunnels[0].public_url
    }
    
    Write-Host "✅ تم العثور على: $publicUrl" -ForegroundColor Green
    Write-Host ""
    
    # تحديث Backend/.env
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host "📝 الخطوة 1: تحديث Backend/.env" -ForegroundColor Magenta
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host ""
    
    $envPath = "Backend\.env"
    if (Test-Path $envPath) {
        $envContent = Get-Content $envPath -Raw
        
        # Update GOOGLE_CALLBACK_URL
        $newCallbackUrl = "$publicUrl/api/auth/google/callback"
        if ($envContent -match 'GOOGLE_CALLBACK_URL=.*') {
            $envContent = $envContent -replace 'GOOGLE_CALLBACK_URL=.*', "GOOGLE_CALLBACK_URL=$newCallbackUrl"
            Write-Host "   ✅ تم تحديث GOOGLE_CALLBACK_URL" -ForegroundColor Green
        } else {
            $envContent += "`nGOOGLE_CALLBACK_URL=$newCallbackUrl"
            Write-Host "   ✅ تم إضافة GOOGLE_CALLBACK_URL" -ForegroundColor Green
        }
        
        # Update MOBILE_FRONTEND_URL to use ngrok for OAuth redirect
        if ($envContent -match 'MOBILE_FRONTEND_URL=.*') {
            $envContent = $envContent -replace 'MOBILE_FRONTEND_URL=.*', "MOBILE_FRONTEND_URL=$publicUrl"
            Write-Host "   ✅ تم تحديث MOBILE_FRONTEND_URL" -ForegroundColor Green
        } else {
            $envContent += "`nMOBILE_FRONTEND_URL=$publicUrl"
            Write-Host "   ✅ تم إضافة MOBILE_FRONTEND_URL" -ForegroundColor Green
        }
        
        Set-Content -Path $envPath -Value $envContent -NoNewline
        Write-Host ""
    } else {
        Write-Host "   ⚠️  لم يتم العثور على Backend/.env" -ForegroundColor Yellow
        Write-Host ""
    }
    
    # تحديث front/app.json
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host "📝 الخطوة 2: تحديث front/app.json" -ForegroundColor Magenta
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host ""
    
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
        Write-Host ""
    } else {
        Write-Host "   ⚠️  لم يتم العثور على front/app.json" -ForegroundColor Yellow
        Write-Host ""
    }
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host "⚠️  الخطوة 3: تحديث Google Cloud Console (يدوياً)" -ForegroundColor Red
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host ""
    Write-Host "1. افتح: https://console.cloud.google.com/" -ForegroundColor White
    Write-Host "2. اذهب إلى: APIs & Services → Credentials" -ForegroundColor White
    Write-Host "3. أضف Authorized redirect URI:" -ForegroundColor White
    Write-Host ""
    Write-Host "   $publicUrl/api/auth/google/callback" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "✅ تم تحديث الملفات بنجاح!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 الخطوات التالية:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. حدّث Google Cloud Console (الرابط أعلاه)" -ForegroundColor White
    Write-Host "2. أعد تشغيل Backend:" -ForegroundColor White
    Write-Host "   cd Backend" -ForegroundColor Gray
    Write-Host "   npm run dev" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. أعد تشغيل Frontend:" -ForegroundColor White
    Write-Host "   cd front" -ForegroundColor Gray
    Write-Host "   npm start" -ForegroundColor Gray
    Write-Host "   # ثم اضغط 'r' لإعادة التحميل" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host "📊 مراقبة الطلبات: http://localhost:4040" -ForegroundColor Magenta
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host ""
    
} Catch {
    Write-Host "❌ لم يتم العثور على ngrok!" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 لتشغيل ngrok:" -ForegroundColor Cyan
    Write-Host "   ngrok http 3000" -ForegroundColor White
    Write-Host ""
    Write-Host "   أو استخدم السكريبت:" -ForegroundColor White
    Write-Host "   .\QUICK_MOBILE_SETUP.ps1" -ForegroundColor White
    Write-Host ""
    exit 1
}
