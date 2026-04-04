# Fix Prisma Generate Issue on Windows

Write-Host "Checking for Node.js processes..." -ForegroundColor Cyan

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Found Node.js processes running:" -ForegroundColor Yellow
    foreach ($proc in $nodeProcesses) {
        Write-Host "   - PID: $($proc.Id)" -ForegroundColor Gray
    }
    
    $response = Read-Host "Stop all Node.js processes? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        try {
            Stop-Process -Name "node" -Force -ErrorAction Stop
            Write-Host "Stopped all Node.js processes!" -ForegroundColor Green
            Start-Sleep -Seconds 2
        } catch {
            Write-Host "Error stopping processes: $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "No Node.js processes running" -ForegroundColor Green
}

$prismaClientPath = Join-Path $PSScriptRoot "node_modules\.prisma"
if (Test-Path $prismaClientPath) {
    Write-Host "Removing old .prisma folder..." -ForegroundColor Yellow
    try {
        Remove-Item -Path $prismaClientPath -Recurse -Force -ErrorAction Stop
        Write-Host "Removed .prisma folder!" -ForegroundColor Green
        Start-Sleep -Seconds 1
    } catch {
        Write-Host "Cannot remove folder (may be in use): $_" -ForegroundColor Yellow
        Write-Host "Try closing VS Code or other editors, then run script again" -ForegroundColor Cyan
    }
} else {
    Write-Host ".prisma folder does not exist" -ForegroundColor Gray
}

Write-Host "`nRegenerating Prisma Client..." -ForegroundColor Cyan
try {
    Set-Location $PSScriptRoot
    npx prisma generate
    Write-Host "`nPrisma Client generated successfully!" -ForegroundColor Green
} catch {
    Write-Host "`nError generating Prisma Client: $_" -ForegroundColor Red
    Write-Host "`nTry these solutions:" -ForegroundColor Yellow
    Write-Host "   1. Close VS Code or other editors" -ForegroundColor White
    Write-Host "   2. Run PowerShell as Administrator" -ForegroundColor White
    Write-Host "   3. Run script again" -ForegroundColor White
    exit 1
}

Write-Host "`nDone!" -ForegroundColor Green
