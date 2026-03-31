# 🔧 إيقاف العملية على البورت 3000

$port = 3000
Write-Host "🔍 البحث عن العملية على البورت $port..." -ForegroundColor Cyan

$connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($connection) {
    $pid = $connection.OwningProcess
    Write-Host "✅ وجدت العملية: PID $pid" -ForegroundColor Yellow
    
    try {
        Stop-Process -Id $pid -Force
        Write-Host "✅ تم إيقاف العملية بنجاح!" -ForegroundColor Green
    } catch {
        Write-Host "❌ فشل إيقاف العملية: $_" -ForegroundColor Red
    }
} else {
    Write-Host "ℹ️ لا توجد عملية على البورت $port" -ForegroundColor Gray
}

# التحقق
Start-Sleep -Seconds 1
$check = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($check) {
    Write-Host "⚠️ البورت $port لا يزال مستخدم" -ForegroundColor Yellow
} else {
    Write-Host "✅ البورت $port متاح الآن!" -ForegroundColor Green
}

