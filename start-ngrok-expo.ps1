# 🚀 تشغيل Backend مع ngrok للعمل مع Expo Go

Write-Host "🔧 إعداد ngrok للعمل مع Expo Go..." -ForegroundColor Cyan
Write-Host ""

# التحقق من تثبيت ngrok
if (!(Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ngrok غير مثبت!" -ForegroundColor Red
    Write-Host "📥 قم بتحميله من: https://ngrok.com/download" -ForegroundColor Yellow
    Write-Host "   أو استخدم: choco install ngrok" -ForegroundColor Yellow
    exit 1
}

# التحقق من أن البورت 3000 غير مستخدم
$portInUse = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "⚠️  البورت 3000 مستخدم بالفعل!" -ForegroundColor Yellow
    Write-Host "   تأكد من إيقاف أي سيرفر يعمل على البورت 3000" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "هل تريد المتابعة؟ (y/n)"
    if ($continue -ne "y") {
        exit 0
    }
}

Write-Host "🚀 تشغيل ngrok tunnel..." -ForegroundColor Green
Write-Host ""

# تشغيل ngrok في نافذة منفصلة
Start-Process -FilePath "ngrok" -ArgumentList "http", "3000" -WindowStyle Normal

# انتظار ngrok للبدء
Write-Host "⏳ انتظار ngrok للبدء..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# الحصول على ngrok URL
Try {
    $ngrokApi = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -Method Get
    $publicUrl = $ngrokApi.tunnels[0].public_url
    
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "✅ ngrok يعمل بنجاح!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "📡 Public URL: $publicUrl" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "📝 الخطوات التالية:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1️⃣  تحديث Frontend (app.json):" -ForegroundColor White
    Write-Host "   افتح: front/app.json" -ForegroundColor Gray
    Write-Host "   غيّر apiUrl إلى:" -ForegroundColor Gray
    Write-Host "   `"apiUrl`": `"$publicUrl/api`"" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "2️⃣  (إذا كنت تستخدم Google OAuth) تحديث Google Cloud Console:" -ForegroundColor White
    Write-Host "   اذهب إلى: https://console.cloud.google.com/" -ForegroundColor Gray
    Write-Host "   APIs & Services → Credentials" -ForegroundColor Gray
    Write-Host "   أضف Authorized redirect URI:" -ForegroundColor Gray
    Write-Host "   $publicUrl/api/auth/google/callback" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "3️⃣  تحديث .env (إذا كنت تستخدم Google OAuth):" -ForegroundColor White
    Write-Host "   GOOGLE_CALLBACK_URL=$publicUrl/api/auth/google/callback" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host "📊 مراقبة الطلبات: http://localhost:4040" -ForegroundColor Magenta
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "⏸️  بعد تحديث app.json، اضغط Enter لبدء تشغيل Backend..." -ForegroundColor Cyan
    Write-Host ""
    
    # انتظار المستخدم
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
    Write-Host ""
    Write-Host "🚀 بدء تشغيل Backend server..." -ForegroundColor Green
    Write-Host ""
    Write-Host "📍 Backend URL: $publicUrl" -ForegroundColor Yellow
    Write-Host "📍 API URL: $publicUrl/api" -ForegroundColor Yellow
    Write-Host ""
    
    # تشغيل Backend
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
}

