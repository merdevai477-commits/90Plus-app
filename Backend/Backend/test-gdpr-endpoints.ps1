# GDPR Endpoints Testing Script (PowerShell)
# Tests all 7 GDPR endpoints locally

$API_URL = "http://localhost:3000/api"
$TOKEN = "YOUR_CLERK_TOKEN_HERE"

Write-Host "🧪 Testing GDPR Endpoints..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Test 1: Get Consent
Write-Host "`n1. GET /gdpr/consent" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$API_URL/gdpr/consent" `
    -Method GET `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "application/json"
    }
Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor Green

# Test 2: Update Consent
Write-Host "`n2. POST /gdpr/consent" -ForegroundColor Yellow
$body = @{
    consentType = "ANALYTICS"
    granted = $false
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$API_URL/gdpr/consent" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "application/json"
    } `
    -Body $body
Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor Green

# Test 3: Request Data Export
Write-Host "`n3. POST /gdpr/export-data" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$API_URL/gdpr/export-data" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "application/json"
    }
Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor Green
$requestId = $response.requestId

# Test 4: Get Export Status
if ($requestId) {
    Write-Host "`n4. GET /gdpr/export-status/$requestId" -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "$API_URL/gdpr/export-status/$requestId" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $TOKEN"
            "Content-Type" = "application/json"
        }
    Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor Green
}

# Test 5: Get Deletion Status
Write-Host "`n5. GET /gdpr/deletion-status" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$API_URL/gdpr/deletion-status" `
    -Method GET `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "application/json"
    }
Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor Green

# Test 6: Request Account Deletion
Write-Host "`n6. POST /gdpr/delete-account" -ForegroundColor Yellow
$body = @{
    reason = "Testing GDPR compliance"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$API_URL/gdpr/delete-account" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "application/json"
    } `
    -Body $body
Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor Green

# Test 7: Cancel Account Deletion
Write-Host "`n7. POST /gdpr/cancel-deletion" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$API_URL/gdpr/cancel-deletion" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "application/json"
    }
Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor Green

Write-Host "`n✅ All tests completed!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
