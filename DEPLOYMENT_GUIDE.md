# 🚀 دليل نشر Backend - 90Plus App

## 📋 المتطلبات الأساسية

- Node.js (v18 أو أحدث)
- Git
- حساب GitHub
- حساب Railway (للنشر)

## 🔧 إعداد البيئة المحلية

### 1. تثبيت Dependencies
```bash
npm install
```

### 2. إعداد قاعدة البيانات
```bash
# إنشاء قاعدة البيانات
npx prisma migrate dev

# إضافة البيانات الأولية
npm run prisma:seed
```

### 3. تشغيل السيرفر محلياً
```bash
npm run dev
```

## 📤 رفع إلى GitHub

### الطريقة الأولى: استخدام PowerShell Script
```powershell
# في مجلد Backend
.\deploy-to-github.ps1
```

### الطريقة الثانية: استخدام Bash Script
```bash
# في مجلد Backend
./deploy-to-github.sh
```

### الطريقة الثالثة: الأوامر اليدوية
```bash
# إضافة جميع الملفات
git add .

# إنشاء commit
git commit -m "Backend update - $(date)"

# رفع إلى GitHub
git push origin main
```

## 🌐 نشر على Railway

### 1. ربط Repository بـ Railway
1. اذهب إلى [Railway.app](https://railway.app)
2. اضغط "New Project"
3. اختر "Deploy from GitHub repo"
4. اختر repository: `90Plus-app`

### 2. إعداد متغيرات البيئة
في Railway Dashboard، أضف المتغيرات التالية:

```env
# Database
DATABASE_URL=postgresql://...

# Clerk Authentication
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...

# Redis (اختياري)
REDIS_URL=redis://...

# File Storage
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# API Keys
SPORTMONKS_API_KEY=your_api_key
```

### 3. إعداد Build Commands
في Railway:
- **Build Command**: `npm run build:railway`
- **Start Command**: `npm start`

## 🔍 التحقق من النشر

### 1. فحص الصحة
```bash
curl https://your-app.railway.app/health
```

### 2. فحص قاعدة البيانات
```bash
curl https://your-app.railway.app/api/health/db
```

## 🛠️ Scripts المتاحة

| Script | الوصف |
|--------|--------|
| `npm run dev` | تشغيل السيرفر في وضع التطوير |
| `npm run build` | بناء المشروع للإنتاج |
| `npm start` | تشغيل السيرفر في وضع الإنتاج |
| `npm test` | تشغيل الاختبارات |
| `npm run prisma:studio` | فتح Prisma Studio |

## 📁 هيكل المشروع

```
Backend/
├── src/
│   ├── main.ts              # نقطة البداية
│   ├── routes/              # API routes
│   ├── controllers/         # Business logic
│   ├── middleware/          # Express middleware
│   ├── services/            # External services
│   └── utils/               # Utility functions
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Database migrations
├── public/                  # Static files
└── dist/                    # Built files
```

## 🔧 استكشاف الأخطاء

### مشكلة في قاعدة البيانات
```bash
# إعادة تعيين قاعدة البيانات
npm run prisma:reset

# تطبيق المايجريشن
npx prisma migrate deploy
```

### مشكلة في Build
```bash
# مسح dist folder
rm -rf dist

# إعادة البناء
npm run build
```

### مشكلة في Dependencies
```bash
# مسح node_modules
rm -rf node_modules

# إعادة التثبيت
npm install
```

## 📞 الدعم

إذا واجهت أي مشاكل:
1. تحقق من logs في Railway Dashboard
2. تأكد من متغيرات البيئة
3. تحقق من اتصال قاعدة البيانات

## 🔗 روابط مهمة

- **GitHub Repository**: https://github.com/merdevai477-commits/90Plus-app
- **Railway Dashboard**: https://railway.app/dashboard
- **Prisma Studio**: `npm run prisma:studio`