#!/bin/bash

# 90Plus Backend - Deploy to GitHub Script
# هذا السكريبت يرفع Backend إلى GitHub

echo "🚀 بدء رفع Backend إلى GitHub..."

# التأكد من أننا في مجلد Backend
if [ ! -f "package.json" ]; then
    echo "❌ خطأ: يجب تشغيل هذا السكريبت من مجلد Backend"
    exit 1
fi

# التحقق من وجود git
if ! command -v git &> /dev/null; then
    echo "❌ خطأ: Git غير مثبت"
    exit 1
fi

# التحقق من وجود .env وإنشاء .env.example
if [ -f ".env" ]; then
    echo "📝 إنشاء .env.example من .env..."
    # إنشاء .env.example بدون القيم الحساسة
    sed 's/=.*/=/' .env > .env.example
    echo "✅ تم إنشاء .env.example"
fi

# التأكد من وجود .gitignore
if [ ! -f ".gitignore" ]; then
    echo "📝 إنشاء .gitignore..."
    cat > .gitignore << 'EOF'
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
EOF
    echo "✅ تم إنشاء .gitignore"
fi

# إضافة جميع الملفات
echo "📦 إضافة الملفات..."
git add .

# التحقق من وجود تغييرات
if git diff --staged --quiet; then
    echo "ℹ️ لا توجد تغييرات جديدة للرفع"
    echo "🔍 التحقق من حالة الـ repository..."
    git status
else
    # إنشاء commit
    echo "💾 إنشاء commit..."
    COMMIT_MESSAGE="Backend update - $(date '+%Y-%m-%d %H:%M:%S')"
    git commit -m "$COMMIT_MESSAGE"
    echo "✅ تم إنشاء commit: $COMMIT_MESSAGE"
fi

# رفع إلى GitHub
echo "🌐 رفع إلى GitHub..."
if git push origin main; then
    echo "✅ تم رفع Backend إلى GitHub بنجاح!"
    echo "🔗 الرابط: https://github.com/merdevai477-commits/90Plus-app"
else
    echo "❌ فشل في رفع Backend إلى GitHub"
    echo "💡 تأكد من:"
    echo "   - اتصالك بالإنترنت"
    echo "   - صلاحيات GitHub"
    echo "   - أن الـ repository موجود"
    exit 1
fi

# عرض معلومات الـ repository
echo ""
echo "📊 معلومات الـ Repository:"
echo "   الاسم: 90Plus-app"
echo "   الرابط: https://github.com/merdevai477-commits/90Plus-app"
echo "   البرانش: main"

# عرض آخر commit
echo ""
echo "📝 آخر commit:"
git log --oneline -1

echo ""
echo "🎉 تم الانتهاء بنجاح!"
echo "💡 يمكنك الآن نشر Backend على Railway أو أي منصة أخرى"