# 🚂 دليل رفع التطبيق على Railway

**تاريخ الإنشاء:** 2025-01-27  
**الخدمة:** Railway.app

---

## 📋 **المتطلبات:**

1. ✅ حساب Railway (تم الشراء)
2. ✅ GitHub repository للـ Backend
3. ✅ Database (Neon أو Railway PostgreSQL)
4. ✅ Environment variables جاهزة

---

## 🚀 **الخطوات:**

### **المرحلة 1: إعداد المشروع على Railway**

#### **1.1. إنشاء مشروع جديد:**

1. اذهب إلى [railway.app](https://railway.app)
2. اضغط **"New Project"**
3. اختر **"Deploy from GitHub repo"**
4. اختر الـ repository الخاص بالـ Backend
5. Railway سيكتشف تلقائياً أنه Node.js project

---

### **المرحلة 2: إعداد Database**

#### **2.1. خيار 1: استخدام Neon (موصى به - مجاني)**

1. اذهب إلى [neon.tech](https://neon.tech)
2. أنشئ مشروع جديد
3. انسخ **Connection String** (سيشبه):
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
4. احفظه - سنستخدمه في Environment Variables

#### **2.2. خيار 2: استخدام Railway PostgreSQL**

1. في Railway project، اضغط **"+ New"**
2. اختر **"Database"** → **"Add PostgreSQL"**
3. Railway سينشئ database تلقائياً
4. اضغط على Database → **"Variables"** → انسخ `DATABASE_URL`

---

### **المرحلة 3: إعداد Environment Variables**

#### **3.1. في Railway Dashboard:**

1. اضغط على الـ Service (Backend)
2. اضغط على **"Variables"** tab
3. أضف المتغيرات التالية:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/dbname?sslmode=require

# Server
NODE_ENV=production
PORT=3000
API_PREFIX=/api

# CORS
CORS_ORIGIN=https://api.90plus.app

# Clerk (من Clerk Dashboard)
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase Storage (إذا كنت تستخدمه)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_STORAGE_BUCKET_IMAGES=images
SUPABASE_STORAGE_BUCKET_VIDEOS=videos

# Cloudinary (إذا كنت تستخدمه)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# JWT (إذا كنت تستخدمه)
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Session
SESSION_SECRET=your-session-secret-change-in-production

# OAuth (إذا كنت تستخدمه)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://api.90plus.app/api/auth/google/callback

# API Keys
SPORTMONKS_API_TOKEN=your-sportmonks-token
API_FOOTBALL_KEY=your-api-football-key

# Expo Push Notifications
EXPO_ACCESS_TOKEN=your-expo-access-token
```

---

### **المرحلة 4: إعداد Build Configuration**

#### **4.1. إنشاء `railway.json` (اختياري):**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build && npx prisma generate"
  },
  "deploy": {
    "startCommand": "npm run start:prod",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### **4.2. أو استخدام `package.json` scripts:**

Railway سيكتشف تلقائياً:
- **Build:** `npm run build` (سيشغل `postbuild` تلقائياً)
- **Start:** `npm start` أو `npm run start:prod`

**ملاحظة:** تم إضافة `build:railway` script في `package.json` الذي يشغل:
1. TypeScript build
2. Prisma generate
3. Prisma migrate deploy

---

### **المرحلة 5: إعداد Prisma**

#### **5.1. إضافة Build Script:**

في `Backend/package.json`، تأكد من وجود:

```json
{
  "scripts": {
    "build": "tsc",
    "postbuild": "prisma generate",
    "start": "node dist/main.js",
    "start:prod": "NODE_ENV=production node dist/main.js"
  }
}
```

#### **5.2. إضافة Prisma Migrate في Build:**

يمكنك إضافة script في Railway:

```bash
# في Railway → Settings → Build Command:
npm install && npm run build && npx prisma generate && npx prisma migrate deploy
```

**أو** إضافة script في `package.json`:

```json
{
  "scripts": {
    "railway:build": "npm run build && npx prisma generate && npx prisma migrate deploy"
  }
}
```

---

### **المرحلة 6: إعداد Custom Domain (اختياري)**

#### **6.1. في Railway:**

1. اضغط على الـ Service
2. اضغط **"Settings"** → **"Networking"**
3. اضغط **"Generate Domain"** (سيحصل على domain مثل `xxx.up.railway.app`)
4. أو أضف **Custom Domain** (مثل `api.90plus.app`)

#### **6.2. إعداد DNS:**

إذا أردت custom domain:

1. اذهب إلى DNS provider (Cloudflare, GoDaddy, etc.)
2. أضف **CNAME record:**
   ```
   Type: CNAME
   Name: api
   Value: xxx.up.railway.app
   TTL: Auto
   ```

3. في Railway، أضف Custom Domain: `api.90plus.app`
4. Railway سيتحقق تلقائياً من الـ DNS

---

### **المرحلة 7: Deploy**

#### **7.1. Deploy تلقائي من GitHub:**

1. Railway سيراقب الـ repository تلقائياً
2. عند push لأي commit، سيبدأ build تلقائياً
3. يمكنك رؤية logs في **"Deployments"** tab

#### **7.2. Deploy يدوي:**

1. اضغط **"Deploy"** في Railway dashboard
2. أو استخدم Railway CLI:
   ```bash
   npm install -g @railway/cli
   railway login
   railway link
   railway up
   ```

---

### **المرحلة 8: تشغيل Database Migrations**

#### **8.1. بعد أول Deploy:**

1. اضغط على الـ Service
2. اضغط **"Deployments"** → **"View Logs"**
3. تأكد من أن migrations تمت بنجاح

#### **8.2. أو تشغيل migrations يدوياً:**

```bash
# في Railway → Service → Settings → Deploy → Run Command:
npx prisma migrate deploy
```

---

## 🔧 **إعدادات إضافية:**

### **1. Health Check:**

Railway يحتاج health check endpoint. تأكد من وجود:

```typescript
// في main.ts
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

### **2. Port Configuration:**

Railway يحدد PORT تلقائياً. تأكد من:

```typescript
const PORT = process.env.PORT || 3000;
```

### **3. WebSocket Support:**

Railway يدعم WebSocket. تأكد من:

```typescript
// في main.ts
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
});

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
```

---

## 📝 **Checklist قبل Deploy:**

- [ ] ✅ Environment variables كلها موجودة
- [ ] ✅ Database connection string صحيح
- [ ] ✅ Prisma schema محدث
- [ ] ✅ Build scripts صحيحة
- [ ] ✅ PORT يستخدم `process.env.PORT`
- [ ] ✅ CORS origins محدثة للإنتاج
- [ ] ✅ Health check endpoint موجود
- [ ] ✅ Logging يعمل
- [ ] ✅ Error handling موجود

---

## 🐛 **مشاكل شائعة وحلولها:**

### **المشكلة 1: Build فشل**

**الحل:**
```bash
# تحقق من logs في Railway
# تأكد من:
- Node.js version (Railway يستخدم 18+ تلقائياً)
- جميع dependencies موجودة
- TypeScript compilation ناجح
```

### **المشكلة 2: Database connection فشل**

**الحل:**
```bash
# تحقق من:
- DATABASE_URL صحيح
- SSL mode: ?sslmode=require
- Database accessible من Railway IPs
```

### **المشكلة 3: Prisma migrations فشلت**

**الحل:**
```bash
# في Railway → Run Command:
npx prisma migrate deploy

# أو في package.json:
"postbuild": "prisma generate && prisma migrate deploy"
```

### **المشكلة 4: Port binding error**

**الحل:**
```typescript
// تأكد من استخدام:
const PORT = process.env.PORT || 3000;
// وليس hardcoded port
```

### **المشكلة 5: CORS errors**

**الحل:**
```typescript
// في main.ts، أضف Railway domain:
origin: [
  process.env.CORS_ORIGIN,
  /^https:\/\/.*\.railway\.app$/,
  /^https:\/\/.*\.up\.railway\.app$/,
]
```

---

## 🎯 **بعد Deploy:**

### **1. اختبار API:**

```bash
# Health check
curl https://your-app.up.railway.app/health

# API test
curl https://your-app.up.railway.app/api/
```

### **2. تحديث Frontend:**

في `front/app.json` أو `front/config/api.config.ts`:

```typescript
production: {
  baseUrl: 'https://your-app.up.railway.app/api',
  // أو
  baseUrl: 'https://api.90plus.app/api', // إذا أضفت custom domain
}
```

### **3. Monitoring:**

- Railway dashboard → **"Metrics"** → رؤية CPU, Memory, Network
- Railway dashboard → **"Logs"** → رؤية application logs
- Railway dashboard → **"Deployments"** → رؤية deployment history

---

## 💰 **التكلفة:**

- **Railway Hobby Plan:** $5/شهر (500 ساعة compute)
- **Railway Pro Plan:** $20/شهر (unlimited hours)
- **Database (Neon):** مجاني حتى 512MB
- **Database (Railway PostgreSQL):** $5/شهر

---

## 📚 **موارد إضافية:**

- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)

---

## ✅ **الخلاصة:**

1. ✅ أنشئ Railway project
2. ✅ اربط GitHub repository
3. ✅ أضف Database (Neon أو Railway)
4. ✅ أضف Environment Variables
5. ✅ Deploy!
6. ✅ اختبر API
7. ✅ حدث Frontend URLs

**الوقت المتوقع:** ~30 دقيقة

---

**ملاحظة:** إذا واجهت أي مشاكل، تحقق من Railway logs أولاً - عادة ما تكون المشكلة واضحة من هناك! 🚀

