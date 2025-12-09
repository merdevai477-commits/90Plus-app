# ⚡ إعداد سريع - Supabase

## ✅ تم إعداد Frontend تلقائياً!

تم تحديث `front/app.json` بإعدادات Supabase.

---

## 📝 ما تحتاج فعله الآن:

### 1. الحصول على Service Role Key

1. اذهب إلى: https://srzmxtqbdjsdtidxhgzq.supabase.co
2. سجل الدخول
3. **Settings** → **API**
4. انسخ **service_role key** (⚠️ لا تشاركه!)

### 2. إنشاء ملف `.env` في Backend

أنشئ ملف `.env` في مجلد `Backend`:

```env
DATABASE_URL="postgresql://postgres:mrdev187@db.srzmxtqbdjsdtidxhgzq.supabase.co:5432/postgres"
SUPABASE_URL="https://srzmxtqbdjsdtidxhgzq.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyem14dHFiZGpzZHRpZHhoZ3pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDE2MDgsImV4cCI6MjA4MDA3NzYwOH0.xLIo2OukPQHWSgFy0ecCUDgdywF4KGbnYFqcoR5SOwA"
SUPABASE_SERVICE_ROLE_KEY="ضع_Service_Role_Key_هنا"
PORT=3000
API_PREFIX="/api"
NODE_ENV="development"
CORS_ORIGIN="http://localhost:8081"
SESSION_SECRET="your-session-secret-change-in-production"
```

### 3. تفعيل Email Authentication

1. اذهب إلى Supabase Dashboard
2. **Authentication** → **Providers**
3. فعّل **Email**

### 4. تشغيل Migrations

```powershell
cd Backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 5. تشغيل المشروع

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

Frontend جاهز بالفعل! فقط أضف Service Role Key في Backend/.env

