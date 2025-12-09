# 🔍 الحصول على ngrok URL من localhost

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🔍 البحث عن ngrok URL..." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# التحقق من أن ngrok يعمل
Try {
    $ngrokApi = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -Method Get -ErrorAction Stop
    
    if ($ngrokApi.tunnels.Count -eq 0) {
        Write-Host "❌ ngrok يعمل لكن لا توجد tunnels نشطة!" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 لتشغيل ngrok:" -ForegroundColor Yellow
        Write-Host "   ngrok http 3000" -ForegroundColor White
        Write-Host ""
        exit 1
    }
    
    # الحصول على HTTPS URL (أفضل من HTTP)
    $publicUrl = $ngrokApi.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1 -ExpandProperty public_url
    
    if (-not $publicUrl) {
        # إذا لم يوجد HTTPS، استخدم HTTP
        $publicUrl = $ngrokApi.tunnels[0].public_url
    }
    
    Write-Host "✅ تم العثور على ngrok URL!" -ForegroundColor Green
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "📡 ngrok URL:" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   $publicUrl" -ForegroundColor Green
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "📋 انسخ هذه القيم:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1️⃣  للـ Backend/.env:" -ForegroundColor White
    Write-Host ""
    Write-Host "   GOOGLE_CALLBACK_URL=$publicUrl/api/auth/google/callback" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "2️⃣  للـ front/app.json:" -ForegroundColor White
    Write-Host ""
    Write-Host '   "ngrokUrl": "' -NoNewline -ForegroundColor Yellow
    Write-Host "$publicUrl" -NoNewline -ForegroundColor Green
    Write-Host '"' -ForegroundColor Yellow
    Write-Host ""
    Write-Host "3️⃣  للـ Google Cloud Console:" -ForegroundColor White
    Write-Host ""
    Write-Host "   $publicUrl/api/auth/google/callback" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host "📊 معلومات إضافية:" -ForegroundColor Magenta
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "   🌐 Web Interface: http://localhost:4040" -ForegroundColor White
    Write-Host "   📡 Public URL: $publicUrl" -ForegroundColor White
    Write-Host "   🔗 API Endpoint: $publicUrl/api" -ForegroundColor White
    Write-Host ""
    
    # عرض جميع الـ tunnels
    if ($ngrokApi.tunnels.Count -gt 1) {
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
        Write-Host "📋 جميع الـ Tunnels النشطة:" -ForegroundColor DarkGray
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
        Write-Host ""
        foreach ($tunnel in $ngrokApi.tunnels) {
            Write-Host "   $($tunnel.proto): $($tunnel.public_url)" -ForegroundColor Gray
        }
        Write-Host ""
    }
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "✅ تم!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    
    # نسخ URL للـ clipboard (اختياري)
    Try {
        Set-Clipboard -Value $publicUrl
        Write-Host "📋 تم نسخ URL إلى الـ Clipboard!" -ForegroundColor Green
        Write-Host ""
    } Catch {
        # Clipboard not available, ignore
    }
    
} Catch {
    Write-Host "❌ لم يتم العثور على ngrok!" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 تأكد من:" -ForegroundColor Yellow
    Write-Host "   1. أن ngrok يعمل" -ForegroundColor White
    Write-Host "   2. أن ngrok web interface متاح على: http://localhost:4040" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 لتشغيل ngrok:" -ForegroundColor Cyan
    Write-Host "   ngrok http 3000" -ForegroundColor White
    Write-Host ""
    Write-Host "   أو استخدم السكريبت:" -ForegroundColor White
    Write-Host "   .\QUICK_MOBILE_SETUP.ps1" -ForegroundColor White
    Write-Host ""
    exit 1
}
