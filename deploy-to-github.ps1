# 90Plus Backend - Deploy to GitHub Script (PowerShell)
# هذا السكريبت يرفع Backend إلى GitHub

Write-Host "🚀 بدء رفع Backend إلى GitHub..." -ForegroundColor Green

# التأكد من أننا في مجلد Backend
if (-not (Test-Path "package.json")) {
    Write-Host "❌ خطأ: يجب تشغيل هذا السكريبت من مجلد Backend" -ForegroundColor Red
    exit 1
}

# التحقق من وجود git
try {
    $null = git --version
    Write-Host "✅ Git متوفر" -ForegroundColor Green
} catch {
    Write-Host "❌ خطأ: Git غير مثبت" -ForegroundColor Red
    exit 1
}

# التحقق من وجود .env وإنشاء .env.example
if (Test-Path ".env") {
    Write-Host "📝 إنشاء .env.example من .env..." -ForegroundColor Yellow
    # قراءة .env وإنشاء .env.example بدون القيم الحساسة
    $envContent = Get-Content ".env"
    $exampleContent = $envContent | ForEach-Object { 
        if ($_ -match "^([^=]+)=(.*)$") {
            "$($matches[1])="
        } else {
            $_
        }
    }
    $exampleContent | Out-File ".env.example" -Encoding UTF8
    Write-Host "✅ تم إنشاء .env.example" -ForegroundColor Green
}

# التأكد من وجود .gitignore
if (-not (Test-Path ".gitignore")) {
    Write-Host "📝 إنشاء .gitignore..." -ForegroundColor Yellow
    @"
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build output
dist/
build/

# Database
*.db
*.sqlite

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Prisma
prisma/migrations/
!prisma/migrations/.gitkeep

# Temporary files
tmp/
temp/
"@ | Out-File ".gitignore" -Encoding UTF8
    Write-Host "✅ تم إنشاء .gitignore" -ForegroundColor Green
}

# إضافة جميع الملفات
Write-Host "📦 إضافة الملفات..." -ForegroundColor Yellow
git add .

# التحقق من وجود تغييرات
$changes = git diff --staged --name-only
if (-not $changes) {
    Write-Host "ℹ️ لا توجد تغييرات جديدة للرفع" -ForegroundColor Cyan
    Write-Host "🔍 التحقق من حالة الـ repository..." -ForegroundColor Cyan
    git status
} else {
    # إنشاء commit
    Write-Host "💾 إنشاء commit..." -ForegroundColor Yellow
    $commitMessage = "Backend update - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    git commit -m $commitMessage
    Write-Host "✅ تم إنشاء commit: $commitMessage" -ForegroundColor Green
}

# رفع إلى GitHub
Write-Host "🌐 رفع إلى GitHub..." -ForegroundColor Yellow
try {
    git push origin main
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ تم رفع Backend إلى GitHub بنجاح!" -ForegroundColor Green
        Write-Host "🔗 الرابط: https://github.com/merdevai477-commits/90Plus-app" -ForegroundColor Cyan
    } else {
        throw "Git push failed"
    }
} catch {
    Write-Host "❌ فشل في رفع Backend إلى GitHub" -ForegroundColor Red
    Write-Host "💡 تأكد من:" -ForegroundColor Yellow
    Write-Host "   - اتصالك بالإنترنت" -ForegroundColor Yellow
    Write-Host "   - صلاحيات GitHub" -ForegroundColor Yellow
    Write-Host "   - أن الـ repository موجود" -ForegroundColor Yellow
    exit 1
}

# عرض معلومات الـ repository
Write-Host ""
Write-Host "📊 معلومات الـ Repository:" -ForegroundColor Cyan
Write-Host "   الاسم: 90Plus-app" -ForegroundColor White
Write-Host "   الرابط: https://github.com/merdevai477-commits/90Plus-app" -ForegroundColor White
Write-Host "   البرانش: main" -ForegroundColor White

# عرض آخر commit
Write-Host ""
Write-Host "📝 آخر commit:" -ForegroundColor Cyan
git log --oneline -1

Write-Host ""
Write-Host "🎉 تم الانتهاء بنجاح!" -ForegroundColor Green
Write-Host "💡 يمكنك الآن نشر Backend على Railway أو أي منصة أخرى" -ForegroundColor Yellow