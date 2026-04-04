# Performance Optimizations Verification
Write-Host "=== PERFORMANCE OPTIMIZATIONS CHECK ===" -ForegroundColor Cyan
Write-Host ""

Set-Location "front"

# 1. FlatList (target: 0)
Write-Host "1. FlatList remaining:" -ForegroundColor Yellow
$flat = (Get-ChildItem -Recurse -Filter "*.tsx" | Select-String "FlatList" | Select-String "react-native").Count
Write-Host "   $flat files" -ForegroundColor $(if($flat -eq 0){"Green"}else{"Red"})

# 2. FlashList (target: >12)
Write-Host "2. FlashList usage:" -ForegroundColor Yellow
$flash = (Get-ChildItem -Recurse -Filter "*.tsx" | Select-String "@shopify/flash-list" | Select-Object Path -Unique).Count
Write-Host "   $flash files" -ForegroundColor $(if($flash -gt 12){"Green"}else{"Red"})

# 3. React.memo (target: >15)
Write-Host "3. React.memo usage:" -ForegroundColor Yellow
$memo = (Get-ChildItem -Recurse -Filter "*.tsx" | Select-String "React.memo").Count
Write-Host "   $memo instances" -ForegroundColor $(if($memo -gt 15){"Green"}else{"Red"})

# 4. useCallback (target: >20)
Write-Host "4. useCallback usage:" -ForegroundColor Yellow
$callback = (Get-ChildItem -Recurse -Filter "*.tsx" | Select-String "useCallback").Count
Write-Host "   $callback instances" -ForegroundColor $(if($callback -gt 20){"Green"}else{"Red"})

# 5. useMemo (target: >10)
Write-Host "5. useMemo usage:" -ForegroundColor Yellow
$usememo = (Get-ChildItem -Recurse -Filter "*.tsx" | Select-String "useMemo").Count
Write-Host "   $usememo instances" -ForegroundColor $(if($usememo -gt 10){"Green"}else{"Red"})

# 6. Image compression (target: >3)
Write-Host "6. Image compression:" -ForegroundColor Yellow
$compress = (Get-ChildItem -Recurse -Filter "*.tsx" | Select-String "compressImage" | Select-Object Path -Unique).Count
Write-Host "   $compress files" -ForegroundColor $(if($compress -gt 3){"Green"}else{"Red"})

# 7. expo-image (target: >10)
Write-Host "7. expo-image usage:" -ForegroundColor Yellow
$expoimg = (Get-ChildItem -Recurse -Filter "*.tsx" | Select-String "expo-image" | Select-Object Path -Unique).Count
Write-Host "   $expoimg files" -ForegroundColor $(if($expoimg -gt 10){"Green"}else{"Red"})

Set-Location ".."

# 8. Backend Sharp (target: >2)
Write-Host "8. Backend Sharp:" -ForegroundColor Yellow
$sharp = 0
if (Test-Path "Backend") {
    $sharp = (Get-ChildItem -Path "Backend" -Recurse -Filter "*.ts" -ErrorAction SilentlyContinue | Select-String "sharp" -ErrorAction SilentlyContinue | Select-Object Path -Unique).Count
}
Write-Host "   $sharp files" -ForegroundColor $(if($sharp -gt 2){"Green"}else{"Red"})

Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
$done = 0
if($flat -eq 0){$done++}
if($flash -gt 12){$done++}
if($memo -gt 15){$done++}
if($callback -gt 20){$done++}
if($usememo -gt 10){$done++}
if($compress -gt 3){$done++}
if($expoimg -gt 10){$done++}
if($sharp -gt 2){$done++}

Write-Host "Completed: $done/8 tasks" -ForegroundColor $(if($done -eq 8){"Green"}else{"Yellow"})
