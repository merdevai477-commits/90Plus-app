# 🚀 تشغيل Backend بعد تنظيف البورت

Write-Host "🧹 تنظيف البورت 3000..." -ForegroundColor Cyan

# إيقاف جميع عمليات node على البورت 3000
$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($connections) {
    foreach ($conn in $connections) {
        try {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "✅ تم إيقاف العملية PID: $($conn.OwningProcess)" -ForegroundColor Green
        } catch {
            # Ignore errors
        }
    }
    Start-Sleep -Seconds 2
}

# التحقق
$check = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($check) {
    Write-Host "⚠️ البورت 3000 لا يزال مستخدم. حاول يدوياً:" -ForegroundColor Yellow
    Write-Host "   Get-Process node | Stop-Process -Force" -ForegroundColor Gray
} else {
    Write-Host "✅ البورت 3000 متاح!" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 بدء تشغيل Backend..." -ForegroundColor Cyan
Write-Host ""

# تشغيل Backend
npm run dev

