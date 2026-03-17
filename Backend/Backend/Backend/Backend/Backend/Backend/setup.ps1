# Football App Backend - Setup Script
# This script will help you setup the database and run migrations

Write-Host "🚀 Football App Backend Setup" -ForegroundColor Green
Write-Host "==============================`n" -ForegroundColor Green

# Check if .env exists
if (-Not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ .env file created!`n" -ForegroundColor Green
    Write-Host "⚠️  IMPORTANT: Please update DATABASE_URL in .env with your PostgreSQL credentials`n" -ForegroundColor Yellow
    Write-Host "Press any key to continue after updating .env..." -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

Write-Host "`n📦 Installing dependencies..." -ForegroundColor Cyan
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Dependencies installed!`n" -ForegroundColor Green

Write-Host "🔧 Generating Prisma Client..." -ForegroundColor Cyan
npm run prisma:generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Prisma Client generated!`n" -ForegroundColor Green

Write-Host "🗄️  Running database migrations..." -ForegroundColor Cyan
npm run prisma:migrate

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to run migrations" -ForegroundColor Red
    Write-Host "Please make sure PostgreSQL is running and DATABASE_URL is correct in .env" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Migrations completed!`n" -ForegroundColor Green

Write-Host "🌱 Seeding database with sample data..." -ForegroundColor Cyan
npm run prisma:seed

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to seed database" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Database seeded successfully!`n" -ForegroundColor Green

Write-Host "==============================" -ForegroundColor Green
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "==============================`n" -ForegroundColor Green

Write-Host "You can now start the development server with:" -ForegroundColor Cyan
Write-Host "  npm run dev`n" -ForegroundColor White

Write-Host "Other useful commands:" -ForegroundColor Cyan
Write-Host "  npm run prisma:studio  - Open database GUI" -ForegroundColor White
Write-Host "  npm run build          - Build for production" -ForegroundColor White
Write-Host "  npm run start          - Start production server`n" -ForegroundColor White

Write-Host "Test accounts:" -ForegroundColor Cyan
Write-Host "  Email: ahmed@football.com   Password: password123" -ForegroundColor White
Write-Host "  Email: sara@football.com    Password: password123" -ForegroundColor White
Write-Host "  Email: dev@football.com     Password: password123 (Developer)" -ForegroundColor White

Write-Host "`nHappy coding! ⚽🚀" -ForegroundColor Green
