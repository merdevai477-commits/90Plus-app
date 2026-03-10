# 🚂 Railway Deployment Guide

## ⚠️ IMPORTANT: Fix Railpack Detection Issue

If Railway uses "Railpack" instead of "Nixpacks", follow these steps:

1. **Delete `railway.json`** (already done in this repo)
2. **Verify `railway.toml` exists** with `builder = "NIXPACKS"`
3. **In Railway Dashboard → Settings:**
   - Builder: Select "NIXPACKS" (not Railpack or Dockerfile)
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Start Command: `npm run start:prod`
4. **Redeploy** the service

---

## خطوات النشر على Railway

### 1. إنشاء مشروع جديد
1. افتح [Railway Dashboard](https://railway.app/dashboard)
2. اضغط على "New Project"
3. اختر "Deploy from GitHub repo"
4. اختار الـ repo بتاعك: `https://github.com/mrdev7479-sys/90-plus.git`
5. اختار الـ `Backend` folder (Root Directory: `/Backend`)

### 2. إضافة PostgreSQL Database
1. في الـ project، اضغط على "+ New"
2. اختر "Database" → "Add PostgreSQL"
3. انتظر لحد ما الـ database يتنشئ
4. **أو استخدم Neon PostgreSQL** (الموجود بالفعل):
   - اضغط على Backend service → Variables
   - أضف `DATABASE_URL` بقيمة Neon connection string

### 3. إضافة Environment Variables

اضغط على الـ Backend service → Variables → Raw Editor والصق الآتي:

```env
# Database (استخدم Neon PostgreSQL الموجود)
DATABASE_URL=postgresql://neondb_owner:your_password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

# Redis (Upstash - موجود بالفعل)
REDIS_URL=your_upstash_redis_url

# API Keys
FOOTBALL_API_KEY=your_football_api_key
SPORTMONKS_API_KEY=your_sportmonks_api_key

# Supabase Storage
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SUPABASE_BUCKET=your_bucket_name

# App Config
NODE_ENV=production
PORT=3000
FRONTEND_URL=exp://your-expo-url

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### 4. تشغيل Prisma Migrations

بعد ما الـ deployment ينجح:

```bash
# في الـ terminal المحلي
railway link
railway run npx prisma db push
railway run npx prisma db seed
```

أو من الـ Dashboard:
1. اضغط على Backend service
2. اضغط على "Settings" → "Deploy"
3. في "Build Command" ضيف:
   ```
   npm install && npx prisma generate && npx prisma db push && npm run build
   ```

### 5. الحصول على الـ URL

بعد النشر:
1. اضغط على Backend service
2. اضغط على "Settings" → "Networking"
3. اضغط على "Generate Domain"
4. هتحصل على URL زي: `https://your-app.up.railway.app`

### 6. تحديث Frontend Config

في `front/config/api.config.ts`:

```typescript
const RAILWAY_API_URL = 'https://your-app.up.railway.app/api';

export const getApiUrl = () => {
  if (__DEV__) {
    return RAILWAY_API_URL; // استخدم Railway في التطوير
  }
  return RAILWAY_API_URL; // وفي الإنتاج
};
```

## 🔧 إعدادات إضافية

### Auto-Deploy من GitHub

1. في Railway Dashboard → Settings → "Source"
2. فعّل "Auto Deploy"
3. اختار الـ branch (مثلاً `main`)
4. كل push هيعمل deploy تلقائي

### Monitoring & Logs

- **Logs**: اضغط على Backend service → "Deployments" → اختار deployment → "View Logs"
- **Metrics**: اضغط على Backend service → "Metrics"

### Database Backups

Railway بيعمل backups تلقائية للـ PostgreSQL:
- اضغط على PostgreSQL service → "Data" → "Backups"

## 💰 التكلفة

مع الـ 5$ credit:
- Backend: ~$2-3/شهر (512MB RAM)
- PostgreSQL: ~$1-2/شهر (1GB storage)
- **المجموع**: ~$3-5/شهر

الـ 5$ هتكفي شهر كامل! 🎉

## 🚨 استكشاف الأخطاء

### Build Failed
```bash
# تحقق من الـ logs
railway logs

# جرب build محلي
npm run build
```

### Database Connection Error
```bash
# تحقق من DATABASE_URL
railway variables

# جرب الاتصال
railway run npx prisma db push
```

### Port Already in Use
Railway بيستخدم `PORT` environment variable تلقائياً.
تأكد إن الكود بيستخدم `process.env.PORT`:

```typescript
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## 📚 موارد مفيدة

- [Railway Docs](https://docs.railway.app/)
- [Railway Discord](https://discord.gg/railway)
- [Railway Status](https://status.railway.app/)

---

## ✅ Checklist

- [ ] إنشاء مشروع Railway
- [ ] إضافة PostgreSQL
- [ ] إضافة Environment Variables
- [ ] Deploy Backend
- [ ] تشغيل Prisma migrations
- [ ] الحصول على URL
- [ ] تحديث Frontend config
- [ ] اختبار الـ API
- [ ] تفعيل Auto-Deploy

🎉 مبروك! السيرفر شغال على Railway
