# 🧪 Test Quiz Endpoints Script
# اختبار جميع quiz endpoints

$API_URL = "http://localhost:3000/api"
$QUIZ_BASE = "$API_URL/quiz"

Write-Host "🧪 Testing Quiz Endpoints" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check (بدون auth)
Write-Host "1️⃣ Testing /api/quiz/health (بدون auth)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$QUIZ_BASE/health" -Method GET -ErrorAction Stop
    Write-Host "   ✅ SUCCESS" -ForegroundColor Green
    Write-Host "   Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Test Daily Status (بدون auth)
Write-Host "2️⃣ Testing /api/quiz/test-daily-status (بدون auth)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$QUIZ_BASE/test-daily-status" -Method GET -ErrorAction Stop
    Write-Host "   ✅ SUCCESS" -ForegroundColor Green
    Write-Host "   Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Routes Debug (بدون auth)
Write-Host "3️⃣ Testing /api/quiz/routes (بدون auth)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$QUIZ_BASE/routes" -Method GET -ErrorAction Stop
    Write-Host "   ✅ SUCCESS" -ForegroundColor Green
    Write-Host "   Total Routes: $($response.totalRoutes)" -ForegroundColor Cyan
    Write-Host "   Routes:" -ForegroundColor Cyan
    $response.routes | ForEach-Object {
        $auth = if ($_.requiresAuth) { "(requires auth)" } else { "(no auth)" }
        Write-Host "      - $($_.method) $($_.path) $auth" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Daily Status (مع auth - سيفشل بدون token)
Write-Host "4️⃣ Testing /api/quiz/daily-status (مع auth - سيفشل بدون token)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$QUIZ_BASE/daily-status" -Method GET -ErrorAction Stop
    Write-Host "   ✅ SUCCESS (unexpected - should require auth!)" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "   ✅ EXPECTED: 401 Unauthorized (requires authentication)" -ForegroundColor Green
    } elseif ($statusCode -eq 404) {
        Write-Host "   ❌ PROBLEM: 404 Not Found - Route not registered!" -ForegroundColor Red
        Write-Host "   → Check server logs and route registration" -ForegroundColor Yellow
    } else {
        Write-Host "   ⚠️  Status: $statusCode - $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Test 5: Categories (مع auth - سيفشل بدون token)
Write-Host "5️⃣ Testing /api/quiz/categories (مع auth - سيفشل بدون token)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$QUIZ_BASE/categories" -Method GET -ErrorAction Stop
    Write-Host "   ✅ SUCCESS (unexpected - should require auth!)" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "   ✅ EXPECTED: 401 Unauthorized (requires authentication)" -ForegroundColor Green
    } elseif ($statusCode -eq 404) {
        Write-Host "   ❌ PROBLEM: 404 Not Found - Route not registered!" -ForegroundColor Red
    } else {
        Write-Host "   ⚠️  Status: $statusCode" -ForegroundColor Yellow
    }
}
Write-Host ""

# Summary
Write-Host "================================" -ForegroundColor Cyan
Write-Host "📊 Test Summary:" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Endpoints بدون auth يجب أن تعمل:" -ForegroundColor Green
Write-Host "   - GET /api/quiz/health" -ForegroundColor Gray
Write-Host "   - GET /api/quiz/test-daily-status" -ForegroundColor Gray
Write-Host "   - GET /api/quiz/routes" -ForegroundColor Gray
Write-Host ""
Write-Host "🔒 Endpoints مع auth يجب أن ترجع 401 بدون token:" -ForegroundColor Yellow
Write-Host "   - GET /api/quiz/daily-status" -ForegroundColor Gray
Write-Host "   - GET /api/quiz/categories" -ForegroundColor Gray
Write-Host ""
Write-Host "❌ إذا رأيت 404 في أي endpoint:" -ForegroundColor Red
Write-Host "   1. تأكد أن السيرفر يعمل: cd Backend && npm run dev" -ForegroundColor Yellow
Write-Host "   2. تحقق من الـ logs في السيرفر" -ForegroundColor Yellow
Write-Host "   3. جرب GET /api/quiz/routes لرؤية جميع الـ routes المسجلة" -ForegroundColor Yellow
Write-Host ""

