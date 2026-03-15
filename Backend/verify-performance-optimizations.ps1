# Performance Optimizations Verification Script
# Counts usage of performance optimization patterns

Write-Host "=== PERFORMANCE OPTIMIZATIONS VERIFICATION ===" -ForegroundColor Cyan
Write-Host ""

# Change to front directory
Set-Location -Path "front"

Write-Host "📊 Counting optimization patterns..." -ForegroundColor Yellow
Write-Host ""

# 1. FlatList remaining (target: 0)
Write-Host "1️⃣  FlatList Usage (Target: 0)" -ForegroundColor Magenta
$flatListFiles = Get-ChildItem -Path . -Recurse -Filter "*.tsx" | Select-String -Pattern "from 'react-native'" | Select-String -Pattern "FlatList"
$flatListCount = ($flatListFiles | Select-Object -ExpandProperty Path -Unique).Count
Write-Host "   Found: $flatListCount files" -ForegroundColor $(if ($flatListCount -eq 0) { "Green" } else { "Red" })
if ($flatListCount -gt 0) {
    Write-Host "   Files with FlatList:" -ForegroundColor Yellow
    $flatListFiles | Select-Object -ExpandProperty Path -Unique | ForEach-Object { Write-Host "     - $_" -ForegroundColor Gray }
}
Write-Host ""

# 2. FlashList usage (target: >12)
Write-Host "2️⃣  FlashList Usage (Target: >12)" -ForegroundColor Magenta
$flashListFiles = Get-ChildItem -Path . -Recurse -Filter "*.tsx" | Select-String -Pattern "@shopify/flash-list"
$flashListCount = ($flashListFiles | Select-Object -ExpandProperty Path -Unique).Count
Write-Host "   Found: $flashListCount files" -ForegroundColor $(if ($flashListCount -gt 12) { "Green" } elseif ($flashListCount -eq 12) { "Yellow" } else { "Red" })
Write-Host ""

# 3. React.memo usage (target: >15)
Write-Host "3️⃣  React.memo Usage (Target: >15)" -ForegroundColor Magenta
$memoFiles = Get-ChildItem -Path . -Recurse -Filter "*.tsx" | Select-String -Pattern "React.memo|= memo\("
$memoCount = ($memoFiles | Measure-Object).Count
Write-Host "   Found: $memoCount instances" -ForegroundColor $(if ($memoCount -gt 15) { "Green" } elseif ($memoCount -eq 15) { "Yellow" } else { "Red" })
Write-Host ""

# 4. useCallback usage (target: >20)
Write-Host "4️⃣  useCallback Usage (Target: >20)" -ForegroundColor Magenta
$callbackFiles = Get-ChildItem -Path . -Recurse -Filter "*.tsx" | Select-String -Pattern "useCallback"
$callbackCount = ($callbackFiles | Measure-Object).Count
Write-Host "   Found: $callbackCount instances" -ForegroundColor $(if ($callbackCount -gt 20) { "Green" } elseif ($callbackCount -eq 20) { "Yellow" } else { "Red" })
Write-Host ""

# 5. useMemo usage (target: >10)
Write-Host "5️⃣  useMemo Usage (Target: >10)" -ForegroundColor Magenta
$memoHookFiles = Get-ChildItem -Path . -Recurse -Filter "*.tsx" | Select-String -Pattern "useMemo"
$memoHookCount = ($memoHookFiles | Measure-Object).Count
Write-Host "   Found: $memoHookCount instances" -ForegroundColor $(if ($memoHookCount -gt 10) { "Green" } elseif ($memoHookCount -eq 10) { "Yellow" } else { "Red" })
Write-Host ""

# 6. Image compression usage (target: >3)
Write-Host "6️⃣  Image Compression Usage (Target: >3)" -ForegroundColor Magenta
$compressionFiles = Get-ChildItem -Path . -Recurse -Filter "*.tsx" | Select-String -Pattern "compressImage"
$compressionCount = ($compressionFiles | Select-Object -ExpandProperty Path -Unique).Count
Write-Host "   Found: $compressionCount files" -ForegroundColor $(if ($compressionCount -gt 3) { "Green" } elseif ($compressionCount -eq 3) { "Yellow" } else { "Red" })
Write-Host ""

# 7. expo-image usage (target: >10)
Write-Host "7️⃣  expo-image Usage (Target: >10)" -ForegroundColor Magenta
$expoImageFiles = Get-ChildItem -Path . -Recurse -Filter "*.tsx" | Select-String -Pattern "from 'expo-image'"
$expoImageCount = ($expoImageFiles | Select-Object -ExpandProperty Path -Unique).Count
Write-Host "   Found: $expoImageCount files" -ForegroundColor $(if ($expoImageCount -gt 10) { "Green" } elseif ($expoImageCount -eq 10) { "Yellow" } else { "Red" })
Write-Host ""

# Return to root
Set-Location -Path ".."

# 8. Backend Sharp usage (target: >2)
Write-Host "8️⃣  Backend Sharp Usage (Target: >2)" -ForegroundColor Magenta
$sharpFiles = Get-ChildItem -Path "Backend" -Recurse -Filter "*.ts" -ErrorAction SilentlyContinue | Select-String -Pattern "sharp" -ErrorAction SilentlyContinue
$sharpCount = if ($sharpFiles) { ($sharpFiles | Select-Object -ExpandProperty Path -Unique).Count } else { 0 }
Write-Host "   Found: $sharpCount files" -ForegroundColor $(if ($sharpCount -gt 2) { "Green" } elseif ($sharpCount -eq 2) { "Yellow" } else { "Red" })
Write-Host ""

# Summary
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
$total = 0
$completed = 0

if ($flatListCount -eq 0) { $completed++ }
$total++

if ($flashListCount -gt 12) { $completed++ }
$total++

if ($memoCount -gt 15) { $completed++ }
$total++

if ($callbackCount -gt 20) { $completed++ }
$total++

if ($memoHookCount -gt 10) { $completed++ }
$total++

if ($compressionCount -gt 3) { $completed++ }
$total++

if ($expoImageCount -gt 10) { $completed++ }
$total++

if ($sharpCount -gt 2) { $completed++ }
$total++

$percentage = [math]::Round(($completed / $total) * 100, 1)
Write-Host "Progress: $completed/$total tasks completed ($percentage%)" -ForegroundColor $(if ($percentage -eq 100) { "Green" } elseif ($percentage -gt 50) { "Yellow" } else { "Red" })
Write-Host ""

if ($percentage -eq 100) {
    Write-Host "✅ ALL OPTIMIZATIONS COMPLETE!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some optimizations still needed" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    if ($flatListCount -gt 0) { Write-Host "  - Replace remaining $flatListCount FlatList with FlashList" }
    if ($flashListCount -le 12) { Write-Host "  - Add more FlashList usage (current: $flashListCount, target: >12)" }
    if ($memoCount -le 15) { Write-Host "  - Add React.memo to more components (current: $memoCount, target: >15)" }
    if ($callbackCount -le 20) { Write-Host "  - Add useCallback to more handlers (current: $callbackCount, target: >20)" }
    if ($memoHookCount -le 10) { Write-Host "  - Add useMemo to more computed values (current: $memoHookCount, target: >10)" }
    if ($compressionCount -le 3) { Write-Host "  - Integrate image compression in more places (current: $compressionCount, target: >3)" }
    if ($expoImageCount -le 10) { Write-Host "  - Replace more Image with expo-image (current: $expoImageCount, target: >10)" }
    if ($sharpCount -le 2) { Write-Host "  - Add Sharp to backend image processing (current: $sharpCount, target: >2)" }
}
