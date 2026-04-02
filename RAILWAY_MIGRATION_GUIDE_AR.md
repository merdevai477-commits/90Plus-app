# 🚂 دليل نقل Railway إلى حساب جديد

## 📋 الخطوات الكاملة

### المرحلة 1: تحضير الحساب الجديد (10 دقائق)

#### 1. إنشاء حساب Railway جديد
```
1. اذهب إلى: https://railway.app
2. اضغط "Sign Up"
3. سجل بحساب GitHub جديد أو بريد إلكتروني جديد
4. تأكد من تفعيل الحساب
```

#### 2. ربط GitHub (إذا لم يكن مربوط)
```
1. Settings → Connected Accounts
2. Connect GitHub
3. Authorize Railway
```

---

### المرحلة 2: إنشاء Project جديد (5 دقائق)

#### 1. إنشاء Project
```
1. Dashboard → New Project
2. اختر "Deploy from GitHub repo"
3. اختر repository: Football-app (أو اسم الريبو)
4. اختر branch: main
5. اختر root directory: Backend
```

#### 2. تكوين Environment Variables
انسخ جميع المتغيرات من الحساب القديم:

```env
# Database
DATABASE_URL=postgresql://...

# Clerk Authentication
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...

# Supabase
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Redis (إذا كنت تستخدمه)
REDIS_URL=redis://...

# API Football
API_FOOTBALL_KEY=...

# Sentry
SENTRY_DSN=https://...

# Node Environment
NODE_ENV=production
PORT=3000

# أي متغيرات أخرى موجودة في .env
```

**كيف تنسخ المتغيرات من الحساب القديم**:
```
1. افتح Railway القديم
2. اذهب إلى Project → Variables
3. انسخ كل متغير
4. الصقه في Railway الجديد
```

---

### المرحلة 3: تكوين Database (15 دقيقة)

#### الخيار 1: نقل Database الحالي (موصى به)

##### أ. Export من Database القديم
```bash
# في Railway القديم، احصل على DATABASE_URL
# ثم في terminal محلي:

pg_dump "postgresql://old-database-url" > backup.sql
```

##### ب. Import إلى Database الجديد
```bash
# في Railway الجديد:
# 1. أضف Postgres service
# 2. احصل على DATABASE_URL الجديد
# 3. Import البيانات:

psql "postgresql://new-database-url" < backup.sql
```

#### الخيار 2: Database جديد (إذا كنت تريد البداية من الصفر)
```bash
# في Railway الجديد:
1. Add Service → Database → PostgreSQL
2. انتظر حتى يتم إنشاء Database
3. انسخ DATABASE_URL
4. أضفه في Variables
5. Run migrations:

cd Backend
npx prisma migrate deploy
npx prisma db seed
```

---

### المرحلة 4: تكوين Build & Deploy (10 دقائق)

#### 1. Build Settings
```
Root Directory: Backend
Build Command: npm install && npx prisma generate && npm run build
Start Command: npm run start
```

#### 2. Health Check (مهم!)
```
Health Check Path: /health
Health Check Timeout: 300 seconds (5 minutes)
```

#### 3. Deploy Settings
```
Auto Deploy: Enabled (on push to main)
Branch: main
```

---

### المرحلة 5: تحديث الروابط (15 دقائق)

#### 1. احصل على الرابط الجديد
```
بعد Deploy الأول، ستحصل على رابط مثل:
https://90plus-app-production-XXXX.up.railway.app
```

#### 2. حدّث الروابط في التطبيق

##### أ. Frontend (Mobile App)
```typescript
// front/config/api.config.ts أو front/constants/api.ts

// قبل:
export const API_URL = 'https://90plus-app-production-26e9.up.railway.app';

// بعد:
export const API_URL = 'https://90plus-app-production-XXXX.up.railway.app';
```

##### ب. Clerk Webhooks
```
1. اذهب إلى Clerk Dashboard
2. Webhooks → Edit webhook
3. حدّث Endpoint URL:
   https://90plus-app-production-XXXX.up.railway.app/api/webhooks/clerk
```

##### ج. Supabase (إذا كنت تستخدم webhooks)
```
1. اذهب إلى Supabase Dashboard
2. Database → Webhooks
3. حدّث URLs إلى الرابط الجديد
```

---

### المرحلة 6: اختبار شامل (20 دقيقة)

#### 1. اختبر الصفحات القانونية
```bash
curl -I https://90plus-app-production-XXXX.up.railway.app/privacy-policy.html
curl -I https://90plus-app-production-XXXX.up.railway.app/terms-of-service.html
curl -I https://90plus-app-production-XXXX.up.railway.app/support.html
curl -I https://90plus-app-production-XXXX.up.railway.app/dmca.html
```
**المتوقع**: جميعها 200 OK

#### 2. اختبر API Endpoints
```bash
# Health check
curl https://90plus-app-production-XXXX.up.railway.app/health

# Auth endpoints
curl https://90plus-app-production-XXXX.up.railway.app/api/auth/status

# Public endpoints
curl https://90plus-app-production-XXXX.up.railway.app/api/quiz/categories
```

#### 3. اختبر Database
```bash
# في Railway console:
npx prisma studio

# أو اختبر من التطبيق:
# سجل دخول، جرب إنشاء محتوى، إلخ
```

---

### المرحلة 7: تحديث App Store (5 دقائق)

#### حدّث الروابط في App Store Connect
```
Privacy Policy:
https://90plus-app-production-XXXX.up.railway.app/privacy-policy.html

Terms of Service:
https://90plus-app-production-XXXX.up.railway.app/terms-of-service.html

Support URL:
https://90plus-app-production-XXXX.up.railway.app/support.html
```

---

### المرحلة 8: إيقاف الحساب القديم (بعد التأكد)

⚠️ **مهم**: لا توقف الحساب القديم إلا بعد التأكد من:
1. ✅ الحساب الجديد يعمل 100%
2. ✅ جميع الروابط محدّثة
3. ✅ Database منقول بنجاح
4. ✅ التطبيق يعمل بدون مشاكل

```
بعد التأكد (بعد 24-48 ساعة):
1. اذهب إلى Railway القديم
2. Project Settings → Danger Zone
3. Delete Project
```

---

## 📝 Checklist كامل

### قبل البدء
- [ ] حساب Railway جديد جاهز
- [ ] GitHub مربوط
- [ ] نسخة احتياطية من Database (backup.sql)
- [ ] جميع Environment Variables منسوخة

### أثناء النقل
- [ ] Project جديد تم إنشاؤه
- [ ] Environment Variables تم إضافتها
- [ ] Database تم نقله أو إنشاؤه
- [ ] Build settings صحيحة
- [ ] Deploy نجح

### بعد النقل
- [ ] الصفحات القانونية تعمل (4/4)
- [ ] API endpoints تعمل
- [ ] Database يعمل
- [ ] Authentication يعمل
- [ ] File uploads تعمل
- [ ] Webhooks محدّثة
- [ ] Frontend محدّث
- [ ] App Store URLs محدّثة

### التأكد النهائي
- [ ] اختبار شامل لمدة 24 ساعة
- [ ] لا توجد أخطاء في Logs
- [ ] Performance جيد
- [ ] Users يمكنهم استخدام التطبيق
- [ ] إيقاف الحساب القديم (اختياري)

---

## 🚨 مشاكل محتملة وحلولها

### مشكلة 1: Build يفشل
**السبب**: Environment variables ناقصة  
**الحل**:
```bash
# تأكد من وجود جميع المتغيرات:
DATABASE_URL
CLERK_SECRET_KEY
SUPABASE_URL
# إلخ...
```

### مشكلة 2: Database connection error
**السبب**: DATABASE_URL خاطئ  
**الحل**:
```bash
# تأكد من DATABASE_URL صحيح
# جرب الاتصال يدوياً:
psql "postgresql://..."
```

### مشكلة 3: 404 على الصفحات القانونية
**السبب**: Static files لم يتم deploy  
**الحل**:
```bash
# تأكد من وجود public/ في Build
# أو أضف في package.json:
"build": "tsc && cp -r public dist/"
```

### مشكلة 4: Webhooks لا تعمل
**السبب**: URLs لم تُحدّث  
**الحل**:
```bash
# حدّث في:
1. Clerk Dashboard → Webhooks
2. Supabase Dashboard → Webhooks
3. أي خدمة خارجية أخرى
```

---

## 💡 نصائح مهمة

### 1. احتفظ بالحساب القديم لمدة أسبوع
لا تحذف الحساب القديم فوراً. احتفظ به لمدة أسبوع للتأكد من أن كل شيء يعمل.

### 2. اختبر في وقت قليل الاستخدام
إذا كان لديك users، انقل في وقت قليل الاستخدام (مثلاً 3 صباحاً).

### 3. أخبر Users (إذا لزم الأمر)
إذا كان النقل سيسبب downtime، أخبر users مسبقاً.

### 4. راقب Logs
بعد النقل، راقب Logs في Railway الجديد لمدة 24 ساعة للتأكد من عدم وجود أخطاء.

---

## 📊 الوقت المتوقع

| المرحلة | الوقت |
|---------|-------|
| تحضير الحساب | 10 دقائق |
| إنشاء Project | 5 دقائق |
| تكوين Database | 15 دقيقة |
| Build & Deploy | 10 دقائق |
| تحديث الروابط | 15 دقائق |
| اختبار شامل | 20 دقائق |
| تحديث App Store | 5 دقائق |
| **الإجمالي** | **~80 دقيقة** |

---

## 🔗 روابط مفيدة

- Railway Dashboard: https://railway.app/dashboard
- Railway Docs: https://docs.railway.app
- Prisma Migrate: https://www.prisma.io/docs/concepts/components/prisma-migrate
- PostgreSQL Backup: https://www.postgresql.org/docs/current/backup-dump.html

---

## ✅ بعد الانتهاء

### حدّث المستندات
```bash
# حدّث الروابط في:
1. APP_STORE_METADATA_COMPLETE.md
2. TASK_12_LEGAL_DOCUMENTS_COMPLETE.md
3. README_SUBMISSION.md
4. أي ملف آخر يحتوي على الرابط القديم
```

### Commit التغييرات
```bash
git add .
git commit -m "chore: Update Railway URLs to new account

- Update API_URL in frontend config
- Update legal document URLs
- Update webhook URLs
- Tested all endpoints: working ✅"
git push origin main
```

---

## 🎯 الخلاصة

**الخطوات الأساسية**:
1. ✅ إنشاء حساب Railway جديد
2. ✅ إنشاء Project جديد
3. ✅ نسخ Environment Variables
4. ✅ نقل Database
5. ✅ Deploy
6. ✅ تحديث الروابط في Frontend
7. ✅ تحديث Webhooks
8. ✅ اختبار شامل
9. ✅ تحديث App Store URLs

**الوقت**: ~80 دقيقة  
**الصعوبة**: متوسطة  
**النتيجة**: استضافة جديدة تعمل 100%

---

**إذا احتجت مساعدة في أي خطوة، أخبرني!**

---

**تم الإعداد بواسطة**: Kiro AI  
**التاريخ**: 1 أبريل 2026  
**الحالة**: دليل كامل ✅
