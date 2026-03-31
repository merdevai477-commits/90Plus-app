# Deploy Backend to Railway
Write-Host "🚀 نشر Backend على Railway..." -ForegroundColor Green

# التحقق من وجود Railway CLI
try {
    railway --version
    Write-Host "✅ Railway CLI متوفر" -ForegroundColor Green
} catch {
    Write-Host "❌ Railway CLI غير مثبت" -ForegroundColor Red
    Write-Host "💡 لتثبيت Railway CLI:" -ForegroundColor Yellow
    Write-Host "   npm install -g @railway/cli" -ForegroundColor White
    Write-Host "   أو" -ForegroundColor Yellow
    Write-Host "   curl -fsSL https://railway.app/install.sh | sh" -ForegroundColor White
    exit 1
}

# تسجيل الدخول إلى Railway
Write-Host "🔐 تسجيل الدخول إلى Railway..." -ForegroundColor Yellow
railway login

# ربط المشروع
Write-Host "🔗 ربط المشروع..." -ForegroundColor Yellow
railway link

# نشر المشروع
Write-Host "🌐 نشر المشروع..." -ForegroundColor Yellow
railway up

Write-Host "✅ تم نشر Backend على Railway بنجاح!" -ForegroundColor Green
Write-Host "🔗 يمكنك مراجعة المشروع في Railway Dashboard" -ForegroundColor Cyan