# ============================================================================
# GDPR Endpoints Comprehensive Testing Script
# Tests each endpoint individually and provides final assessment
# ============================================================================

$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:3000/api"

# Colors for output
function Write-Success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "❌ $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "ℹ️  $msg" -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host "⚠️  $msg" -ForegroundColor Yellow }
function Write-Title { param($msg) Write-Host "`n========================================" -ForegroundColor Magenta; Write-Host $msg -ForegroundColor Magenta; Write-Host "========================================`n" -ForegroundColor Magenta }

# Test results tracking
$testResults = @()
$totalTests = 0
$passedTests = 0
$failedTests = 0

# Function to add test result
function Add-TestResult {
    param(
        [string]$endpoint,
        [string]$method,
        [string]$status,
        [string]$message,
        [int]$score
    )
    
    $script:totalTests++
    if ($status -eq "PASS") {
        $script:passedTests++
    } else {
        $script:failedTests++
    }
    
    $script:testResults += [PSCustomObject]@{
        Endpoint = $endpoint
        Method = $method
        Status = $status
        Message = $message
        Score = $score
    }
}

# ============================================================================
# AUTHENTICATION TOKEN
# ============================================================================

Write-Title "STEP 1: AUTHENTICATION CHECK"

Write-Info "To test GDPR endpoints, you need a valid Clerk authentication token."
Write-Info "Please follow these steps:"
Write-Info "1. Open your mobile app"
Write-Info "2. Login with your account"
Write-Info "3. Open Network tab in React Native Debugger"
Write-Info "4. Find any API request"
Write-Info "5. Copy the 'Authorization: Bearer <token>' header"
Write-Info ""

$token = Read-Host "Enter your Bearer token (or press Enter to skip)"

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Warning "No token provided. Testing will be limited to endpoint availability only."
    $headers = @{}
} else {
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    Write-Success "Token configured successfully"
}

# ============================================================================
# TEST 1: Server Health Check
# ============================================================================

Write-Title "TEST 1: Server Health Check"

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -ErrorAction Stop
    
    if ($response.status -eq "OK") {
        Write-Success "Server is running"
        Write-Info "Database: $($response.database)"
        Write-Info "Environment: $($response.environment)"
        Write-Info "Uptime: $($response.uptime.formatted)"
        Add-TestResult -endpoint "/health" -method "GET" -status "PASS" -message "Server is healthy" -score 10
    } else {
        Write-Warning "Server is running but database is not connected"
        Add-TestResult -endpoint "/health" -method "GET" -status "PARTIAL" -message "Database not connected" -score 5
    }
} catch {
    Write-Error "Server is not running: $_"
    Add-TestResult -endpoint "/health" -method "GET" -status "FAIL" -message "Server not running" -score 0
    Write-Error "Cannot proceed with testing. Please start the server first."
    exit 1
}

# ============================================================================
# TEST 2: GDPR Routes Registration
# ============================================================================

Write-Title "TEST 2: GDPR Routes Registration"

$gdprEndpoints = @(
    @{ Path = "/gdpr/consent"; Method = "GET" },
    @{ Path = "/gdpr/consent"; Method = "POST" },
    @{ Path = "/gdpr/export-data"; Method = "POST" },
    @{ Path = "/gdpr/export-status/test-id"; Method = "GET" },
    @{ Path = "/gdpr/deletion-status"; Method = "GET" },
    @{ Path = "/gdpr/delete-account"; Method = "POST" },
    @{ Path = "/gdpr/cancel-deletion"; Method = "POST" }
)

$registeredCount = 0

foreach ($endpoint in $gdprEndpoints) {
    try {
        $url = "$baseUrl$($endpoint.Path)"
        
        # Try to call endpoint (will fail with 401 if no token, but that means it's registered)
        try {
            $response = Invoke-RestMethod -Uri $url -Method $endpoint.Method -Headers $headers -ErrorAction Stop
            Write-Success "$($endpoint.Method) $($endpoint.Path) - Registered and accessible"
            $registeredCount++
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            
            if ($statusCode -eq 401) {
                Write-Success "$($endpoint.Method) $($endpoint.Path) - Registered (requires auth)"
                $registeredCount++
            } elseif ($statusCode -eq 404) {
                Write-Error "$($endpoint.Method) $($endpoint.Path) - NOT REGISTERED"
            } elseif ($statusCode -eq 429) {
                Write-Warning "$($endpoint.Method) $($endpoint.Path) - Rate limited (but registered)"
                $registeredCount++
            } else {
                Write-Warning "$($endpoint.Method) $($endpoint.Path) - Status: $statusCode"
                $registeredCount++
            }
        }
    } catch {
        Write-Error "$($endpoint.Method) $($endpoint.Path) - Error: $_"
    }
}

$registrationScore = [math]::Round(($registeredCount / $gdprEndpoints.Count) * 10)
Add-TestResult -endpoint "GDPR Routes" -method "ALL" -status $(if ($registeredCount -eq $gdprEndpoints.Count) { "PASS" } else { "PARTIAL" }) -message "$registeredCount/$($gdprEndpoints.Count) endpoints registered" -score $registrationScore

# ============================================================================
# TEST 3: GET /api/gdpr/consent (Get Consent Preferences)
# ============================================================================

Write-Title "TEST 3: GET /api/gdpr/consent"

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Warning "Skipped - No authentication token provided"
    Add-TestResult -endpoint "/gdpr/consent" -method "GET" -status "SKIP" -message "No auth token" -score 0
} else {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/gdpr/consent" -Method Get -Headers $headers -ErrorAction Stop
        
        if ($response.status -eq "SUCCESS") {
            Write-Success "Consent preferences retrieved successfully"
            Write-Info "Analytics: $($response.consent.analytics)"
            Write-Info "Push Notifications: $($response.consent.pushNotifications)"
            Write-Info "Email Communications: $($response.consent.emailCommunications)"
            Write-Info "Data Sharing: $($response.consent.dataSharing)"
            Add-TestResult -endpoint "/gdpr/consent" -method "GET" -status "PASS" -message "Retrieved successfully" -score 10
        } else {
            Write-Error "Unexpected response: $($response.status)"
            Add-TestResult -endpoint "/gdpr/con