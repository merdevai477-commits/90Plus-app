# Backend Sharp Verification Script
Write-Host "=== BACKEND SHARP VERIFICATION ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check Sharp in package.json
Write-Host "1. Sharp in package.json:" -ForegroundColor Yellow
$sharpInPackage = Select-String -Path "Backend/Backend/Backend/package.json" -Pattern '"sharp"' -Quiet
if ($sharpInPackage) {
    Write-Host "   ✅ Found in package.json" -ForegroundColor Green
    Select-String -Path "Backend/Backend/Backend/package.json" -Pattern '"sharp"' | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "   ❌ NOT found in package.json" -ForegroundColor Red
}
Write-Host ""

# 2. Check @types/sharp in package.json
Write-Host "2. @types/sharp in package.json:" -ForegroundColor Yellow
$typesSharpInPackage = Select-String -Path "Backend/Backend/Backend/package.json" -Pattern '"@types/sharp"' -Quiet
if ($typesSharpInPackage) {
    Write-Host "   ✅ Found in package.json" -ForegroundColor Green
    Select-String -Path "Backend/Backend/Backend/package.json" -Pattern '"@types/sharp"' | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "   ❌ NOT found in package.json" -ForegroundColor Red
}
Write-Host ""

# 3. Check middleware file exists
Write-Host "3. Middleware file exists:" -ForegroundColor Yellow
$middlewareExists = Test-Path "Backend/Backend/Backend/src/middleware/image-optimization.middleware.ts"
if ($middlewareExists) {
    Write-Host "   ✅ File exists" -ForegroundColor Green
} else {
    Write-Host "   ❌ File NOT found" -ForegroundColor Red
}
Write-Host ""

# 4. Check middleware imported in routes
Write-Host "4. Middleware imported in routes:" -ForegroundColor Yellow
$middlewareImports = Get-ChildItem -Path "Backend/Backend/Backend/src/routes" -Recurse -Filter "*.ts" | Select-String -Pattern "optimizeUploadedImage"
if ($middlewareImports) {
    Write-Host "   ✅ Found imports:" -ForegroundColor Green
    $middlewareImports | ForEach-Object { Write-Host "   - $($_.Path):$($_.LineNumber)" -ForegroundColor Gray }
} else {
    Write-Host "   ❌ NOT imported in any routes" -ForegroundColor Red
}
Write-Host ""

# 5. Check Sharp usage count
Write-Host "5. Sharp usage in backend:" -ForegroundColor Yellow
$sharpUsage = Get-ChildItem -Path "Backend/Backend/Backend/src" -Recurse -Filter "*.ts" | Select-String -Pattern "sharp" -CaseSensitive
$sharpCount = ($sharpUsage | Measure-Object).Count
Write-Host "   Found: $sharpCount instances" -ForegroundColor $(if ($sharpCount -gt 2) { "Green" } else { "Yellow" })
if ($sharpUsage) {
    Write-Host "   Files using sharp:" -ForegroundColor Gray
    $sharpUsage | Select-Object -ExpandProperty Path -Unique | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }
}
Write-Host ""

# 6. Check middleware usage in upload routes
Write-Host "6. Middleware usage in upload routes:" -ForegroundColor Yellow
$uploadRoutes = Select-String -Path "Backend/Backend/Backend/src/routes/upload.routes.ts" -Pattern "optimizeUploadedImage"
if ($uploadRoutes) {
    Write-Host "   ✅ Found in upload.routes.ts:" -ForegroundColor Green
    $uploadRoutes | ForEach-Object { Write-Host "   Line $($_.LineNumber): $($_.Line.Trim())" -ForegroundColor Gray }
} else {
    Write-Host "   ❌ NOT found in upload.routes.ts" -ForegroundColor Red
}
Write-Host ""

# Summary
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
$checks = 0
$passed = 0

if ($sharpInPackage) { $passed++ }
$checks++

if ($typesSharpInPackage) { $passed++ }
$checks++

if ($middlewareExists) { $passed++ }
$checks++

if ($middlewareImports) { $passed++ }
$checks++

if ($sharpCount -gt 2) { $passed++ }
$checks++

if ($uploadRoutes) { $passed++ }
$checks++

Write-Host "Passed: $passed/$checks checks" -ForegroundColor $(if ($passed -eq $checks) { "Green" } else { "Yellow" })
Write-Host ""

if ($passed -eq $checks) {
    Write-Host "✅ Backend Sharp integration COMPLETE!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some checks failed" -ForegroundColor Yellow
}
