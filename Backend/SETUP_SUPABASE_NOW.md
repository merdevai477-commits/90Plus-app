# 🚀 إعداد Supabase الآن

## ✅ المعلومات المتوفرة:
- ✅ Database URL: `postgresql://postgres:mrdev187@db.srzmxtqbdjsdtidxhgzq.supabase.co:5432/postgres`
- ✅ Project URL: `https://srzmxtqbdjsdtidxhgzq.supabase.co`
- ✅ Anon Key: متوفر
- ⚠️ Service Role Key: **مطلوب**

---

## 📝 الخطوة 1: الحصول على Service Role Key

1. اذهب إلى: https://srzmxtqbdjsdtidxhgzq.supabase.co
2. سجل الدخول إلى Dashboard
3. اذهب إلى **Settings** → **API**
4. انسخ **service_role key** (⚠️ لا تشاركه أبداً!)

---

## 📝 الخطوة 2: إنشاء ملف .env في Backend

أنشئ ملف `.env` في مجلد `Backend` وأضف التالي:

```env
# Database - Supabase
DATABASE_URL="postgresql://postgres:mrdev187@db.srzmxtqbdjsdtidxhgzq.supabase.co:5432/postgres"

# Supabase Configuration
SUPABASE_URL="https://srzmxtqbdjsdtidxhgzq.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyem14dHFiZGpzZHRpZHhoZ3pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDE2MDgsImV4cCI6MjA4MDA3NzYwOH0.xLIo2OukPQHWSgFy0ecCUDgdywF4KGbnYFqcoR5SOwA"
SUPABASE_SERVICE_ROLE_KEY="ضع_Service_Role_Key_هنا"

# JWT Authentication (if using JWT auth)
JWT_SECRET="your-secret-key-change-in-production"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# Server Configuration
PORT=3000
API_PREFIX="/api"
NODE_ENV="development"
CORS_ORIGIN="http://localhost:8081"

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="/api/auth/google/callback"

# Session
SESSION_SECRET="your-session-secret-change-in-production"
```

---

## 📝 الخطوة 3: إعداد Frontend

أنشئ ملف `.env` في مجلد `front` وأضف:

```env
EXPO_PUBLIC_SUPABASE_URL="https://srzmxtqbdjsdtidxhgzq.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyem14dHFiZGpzZHRpZHhoZ3pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDE2MDgsImV4cCI6MjA4MDA3NzYwOH0.xLIo2OukPQHWSgFy0ecCUDgdywF4KGbnYFqcoR5SOwA"
```

أو أضف في `front/app.json`:

```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "https://srzmxtqbdjsdtidxhgzq.supabase.co",
      "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyem14dHFiZGpzZHRpZHhoZ3pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDE2MDgsImV4cCI6MjA4MDA3NzYwOH0.xLIo2OukPQHWSgFy0ecCUDgdywF4KGbnYFqcoR5SOwA"
    }
  }
}
```

---

## 📝 الخطوة 4: تفعيل Authentication في Supabase

1. اذهب إلى: https://srzmxtqbdjsdtidxhgzq.supabase.co
2. اذهب إلى **Authentication** → **Providers**
3. فعّل **Email** provider
4. (اختياري) فعّل **Google OAuth** إذا كنت تريد استخدامه

---

## 📝 الخطوة 5: تشغيل Migrations

```powershell
cd Backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

---

## 📝 الخطوة 6: تشغيل المشروع

```powershell
# Backend
cd Backend
npm run dev

# Frontend (في terminal آخر)
cd front
npm start
```

---

## ✅ جاهز!

بعد اتباع هذه الخطوات، سيكون Supabase جاهزاً للاستخدام!

