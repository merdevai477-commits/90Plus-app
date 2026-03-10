# Script to reset daily quiz
# Usage: 
#   .\reset-daily-quiz.ps1 -ApiKey "your-secret-key"  (Recommended - no auth needed)
#   .\reset-daily-quiz.ps1 -Token "your-clerk-token"   (Alternative - requires auth)

param(
    [string]$ApiKey,
    [string]$Token,
    [string]$ApiUrl = "https://90plus-app-production.up.railway.app/api"
)

$endpoint = "$ApiUrl/quiz/reset-daily"

Write-Host "🔄 Resetting daily quiz..." -ForegroundColor Cyan
Write-Host "Endpoint: $endpoint" -ForegroundColor Gray

# بناء Headers
$headers = @{
    "Content-Type" = "application/json"
}

if ($ApiKey) {
    $headers["X-API-Key"] = $ApiKey
    Write-Host "Using API Key authentication" -ForegroundColor Green
} elseif ($Token) {
    $headers["Authorization"] = "Bearer $Token"
    Write-Host "Using Bearer token authentication" -ForegroundColor Green
} else {
    Write-Host "❌ Error: Either ApiKey or Token is required" -ForegroundColor Red
    Write-Host "Usage: .\reset-daily-quiz.ps1 -ApiKey 'your-secret-key'" -ForegroundColor Yellow
    Write-Host "   OR: .\reset-daily-quiz.ps1 -Token 'your-clerk-token'" -ForegroundColor Yellow
    exit 1
}

try {
    $response = Invoke-RestMethod -Uri $endpoint -Method POST -Headers $headers
    
    Write-Host "✅ Daily quiz reset successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Quiz Details:" -ForegroundColor Yellow
    Write-Host "  - Quiz ID: $($response.data.quizId)" -ForegroundColor White
    Write-Host "  - Category: $($response.data.categoryName) ($($response.data.categoryId))" -ForegroundColor White
    Write-Host "  - Questions: $($response.data.questionCount)" -ForegroundColor White
    Write-Host "  - Expires At: $($response.data.expiresAt)" -ForegroundColor White
    Write-Host "  - Users Reset: $($response.data.usersReset)" -ForegroundColor White
    Write-Host ""
    
    return $response
} catch {
    Write-Host "❌ Error resetting daily quiz:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
    
    exit 1
}

