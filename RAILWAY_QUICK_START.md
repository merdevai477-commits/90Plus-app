# ⚡ Railway Quick Start - دليل سريع

## 🚀 **خطوات سريعة (10 دقائق):**

### **1. إنشاء Project على Railway:**
```
1. اذهب إلى railway.app
2. New Project → Deploy from GitHub
3. اختر Backend repository
```

### **2. إضافة Database:**
```
خيار 1: Neon (مجاني)
- اذهب إلى neon.tech
- أنشئ project
- انسخ Connection String

خيار 2: Railway PostgreSQL
- في Railway → + New → Database → PostgreSQL
- انسخ DATABASE_URL من Variables
```

### **3. إضافة Environment Variables في Railway:**
```
في Railway → Service → Variables → أضف:

DATABASE_URL=postgresql://...
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://api.90plus.app

# Clerk
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase Storage
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET_IMAGES=images
SUPABASE_STORAGE_BUCKET_VIDEOS=videos

# API Keys
SPORTMONKS_API_TOKEN=...
API_FOOTBALL_KEY=...

# وغيرها من المتغيرات المطلوبة
```

### **4. Deploy:**
```
Railway سيشغل تلقائياً:
- npm install
- npm run build (يشغل postbuild → prisma generate)
- npm run start:prod

راقب Logs للتأكد من النجاح
```

### **5. اختبار:**
```bash
# Health check
curl https://your-app.up.railway.app/api/health

# يجب أن ترى:
{
  "status": "OK",
  "message": "90Plus API is running",
  "database": "Connected"
}
```

### **6. تحديث Frontend:**
```typescript
// في front/config/api.config.ts
production: {
  baseUrl: 'https://your-app.up.railway.app/api',
}
```

---

## 📝 **ملفات تم إنشاؤها:**

✅ `Backend/railway.json` - إعدادات Railway
✅ `Backend/.railwayignore` - ملفات مستبعدة من deployment
✅ `Backend/package.json` - تم إضافة `build:railway` و `postbuild`

---

## ⚠️ **مشاكل شائعة:**

### **Build فشل:**
- تحقق من Node.js version (يجب أن يكون 18+)
- تحقق من TypeScript compilation
- تحقق من Prisma schema

### **Database connection فشل:**
- تأكد من `?sslmode=require` في DATABASE_URL
- تأكد من أن Database accessible

### **Migrations فشلت:**
- في Railway → Run Command:
  ```bash
  npx prisma migrate deploy
  ```

---

## 🎯 **Checklist:**

- [ ] Railway project منشأ
- [ ] Database متصل
- [ ] Environment variables كلها موجودة
- [ ] Deploy نجح
- [ ] Health check يعمل
- [ ] Frontend محدث

---

**الوقت المتوقع:** ~10-15 دقيقة

**للمزيد من التفاصيل:** راجع `RAILWAY_DEPLOYMENT_GUIDE.md`

