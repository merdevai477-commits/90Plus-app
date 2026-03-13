# Quick PostgreSQL Installation Script
Write-Host "🚀 Installing PostgreSQL using Chocolatey..." -ForegroundColor Green

# Check if Chocolatey is installed
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Chocolatey first..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

# Install PostgreSQL
Write-Host "Installing PostgreSQL..." -ForegroundColor Yellow
choco install postgresql14 -y --params '/Password:postgres'

Write-Host ""
Write-Host "✅ PostgreSQL installed!" -ForegroundColor Green
Write-Host "Default credentials:" -ForegroundColor Cyan
Write-Host "  Username: postgres" -ForegroundColor White
Write-Host "  Password: postgres" -ForegroundColor White
Write-Host "  Port: 5432" -ForegroundColor White
Write-Host ""
Write-Host "Starting PostgreSQL service..." -ForegroundColor Yellow

# Start PostgreSQL service
Start-Service postgresql-x64-14

Write-Host "✅ Done! Now run: npm run prisma:migrate" -ForegroundColor Green
