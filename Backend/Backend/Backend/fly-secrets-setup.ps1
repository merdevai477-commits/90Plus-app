# PowerShell script to setup Fly.io secrets from .env file
# Run this after creating your Fly.io app

Write-Host "Setting up Fly.io secrets..." -ForegroundColor Green

# Read .env file
$envFile = Get-Content .env
$secrets = @{}

foreach ($line in $envFile) {
    if ($line -match '^([^=]+)=(.+)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim().Trim('"')
        $secrets[$key] = $value
    }
}

# Set secrets (DATABASE_URL will be set by fly postgres attach)
$secretsToSet = @(
    "NODE_ENV=production",
    "CLERK_SECRET_KEY=$($secrets['CLERK_SECRET_KEY'])",
    "CLERK_PUBLISHABLE_KEY=$($secrets['CLERK_PUBLISHABLE_KEY'])",
    "CLERK_WEBHOOK_SECRET=$($secrets['CLERK_WEBHOOK_SECRET'])",
    "SUPABASE_URL=$($secrets['SUPABASE_URL'])",
    "SUPABASE_ANON_KEY=$($secrets['SUPABASE_ANON_KEY'])",
    "SUPABASE_SERVICE_ROLE_KEY=$($secrets['SUPABASE_SERVICE_ROLE_KEY'])",
    "CLOUDINARY_CLOUD_NAME=$($secrets['CLOUDINARY_CLOUD_NAME'])",
    "CLOUDINARY_API_KEY=$($secrets['CLOUDINARY_API_KEY'])",
    "CLOUDINARY_API_SECRET=$($secrets['CLOUDINARY_API_SECRET'])",
    "FOOTBALL_API_KEY=$($secrets['FOOTBALL_API_KEY'])"
)

# Join with spaces for fly secrets set command
$secretsString = $secretsToSet -join " "

# Execute fly secrets set
Invoke-Expression "fly secrets set $secretsString"

Write-Host "✅ Secrets set successfully!" -ForegroundColor Green
Write-Host "⚠️  Note: Set REDIS_URL manually from Upstash console" -ForegroundColor Yellow
Write-Host "Example: fly secrets set REDIS_URL='redis://default:PASSWORD@endpoint.upstash.io:6379'" -ForegroundColor Cyan
