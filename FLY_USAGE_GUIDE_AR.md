# دليل استخدام Fly.io - 90Plus

## المشكلة التي تم حلها

كان التطبيق يحاول الاتصال بـ Railway القديم بدلاً من Fly.io الجديد، مما تسبب في:
- ❌ خطأ WebSocket: "Application not found" من Railway
- ❌ خطأ قاعدة البيانات: "Database error while loading user"
- ❌ فشل تحميل بيانات المستخدم

## الحل

### 1. تحديث ملف `.env` ✅
تم تحديث `front/.env` لاستخدام Fly.io بدلاً من Railway:
```
EXPO_PUBLIC_API_URL=https://90plus-backend.fly.dev/api
```

### 2. بدء الأجهزة (Machines) ✅
قاعدة البيانات كانت متوقفة، تم تشغيلها مرة أخرى.

## كيفية استخدام التطبيق

### قبل فتح التطبيق (مهم جداً!)

عندما تريد استخدام التطبيق، يجب عليك أولاً التأكد من أن أجهزة Fly.io تعمل:

#### الطريقة 1: استخدام السكريبت الجاهز (الأسهل)
```bash
cd Backend
.\start-fly-machines.ps1
```

هذا السكريبت سيقوم بـ:
- ✅ تشغيل قاعدة البيانات
- ✅ تشغيل الباك إند
- ✅ التحقق من صحة الاتصال
- ✅ عرض حالة النظام

#### الطريقة 2: يدوياً
```bash
# تشغيل قاعدة البيانات
flyctl machine start 68372d7cd47478 --app 90plus-db

# الانتظار 10 ثواني
Start-Sleep -Seconds 10

# تشغيل الباك إند
flyctl machine start 78197e2b4ee578 --app 90plus-backend

# الانتظار 10 ثواني
Start-Sleep -Seconds 10

# التحقق من الصحة
Invoke-RestMethod -Uri "https://90plus-backend.fly.dev/api/health"
```

### التحقق من حالة الأجهزة

```bash
# حالة الباك إند
flyctl status --app 90plus-backend

# حالة قاعدة البيانات
flyctl status --app 90plus-db
```

يجب أن ترى:
- ✅ Backend: `STATE = started`
- ✅ Database: `STATE = started`

### إذا كانت الأجهزة متوقفة

الأجهزة تتوقف تلقائياً بعد فترة من عدم النشاط (هذا طبيعي في الخطة المجانية).

ببساطة قم بتشغيل السكريبت مرة أخرى:
```bash
.\Backend\start-fly-machines.ps1
```

## للتقديم على Apple Store

### قبل المراجعة
1. قم بتشغيل الأجهزة قبل أن يبدأ Apple المراجعة
2. تأكد من أن `/api/health` يعمل بشكل صحيح
3. اختبر التطبيق للتأكد من أن كل شيء يعمل

### أثناء المراجعة
- الأجهزة يجب أن تظل تعمل طوال فترة المراجعة
- إذا توقفت، قم بتشغيلها فوراً

### بعد الموافقة
لديك خيارات:
1. **العودة إلى Railway** (الخطة المدفوعة) - الحل الأفضل
2. **ترقية Fly.io** ($5/شهر) - لمنع التوقف التلقائي
3. **استخدام خدمة Keep-Alive** - لإبقاء التطبيق نشطاً

## الملفات المحدثة

### Frontend
- ✅ `front/.env` - تحديث URL إلى Fly.io
- ✅ `front/config/api.config.ts` - يدعم Fly.io بالفعل
- ✅ `front/app.json` - يدعم Fly.io بالفعل

### Backend
- ✅ `Backend/fly.toml` - تكوين Fly.io
- ✅ `Backend/start-fly-machines.ps1` - سكريبت التشغيل
- ✅ `Backend/.github/workflows/fly-deploy.yml` - النشر التلقائي

## معلومات مهمة

### URLs
- **API**: https://90plus-backend.fly.dev/api
- **WebSocket**: wss://90plus-backend.fly.dev
- **Health Check**: https://90plus-backend.fly.dev/api/health

### Machine IDs
- **Backend**: `78197e2b4ee578`
- **Database**: `68372d7cd47478`

### Apps
- **Backend**: `90plus-backend`
- **Database**: `90plus-db`

## استكشاف الأخطاء

### خطأ: "Failed to load user data"
**السبب**: قاعدة البيانات متوقفة
**الحل**: قم بتشغيل السكريبت `.\Backend\start-fly-machines.ps1`

### خطأ: "WebSocket connection error"
**السبب**: الباك إند متوقف أو يستخدم URL خاطئ
**الحل**: 
1. تأكد من أن `.env` يستخدم Fly.io URL
2. قم بتشغيل الأجهزة
3. أعد تشغيل التطبيق

### خطأ: "Application not found" من Railway
**السبب**: التطبيق يستخدم URL قديم
**الحل**: 
1. تأكد من تحديث `front/.env`
2. أعد تشغيل Metro bundler
3. امسح الكاش: `npm start -- --clear`

## ملاحظات

- ⚠️ الخطة المجانية من Fly.io توقف الأجهزة تلقائياً بعد عدم النشاط
- ✅ هذا حل مؤقت حتى الموافقة على Apple Store
- ✅ بعد الموافقة، يُنصح بالعودة إلى Railway أو ترقية Fly.io
- ✅ جميع متغيرات البيئة محفوظة في Railway للعودة السريعة

## الخطوات التالية

1. **الآن**: استخدم Fly.io مع التشغيل اليدوي
2. **بعد موافقة Apple**: قرر بين Railway أو Fly.io المدفوع
3. **للإنتاج**: استخدم حل مدفوع لتجنب التوقف التلقائي

---

تم التحديث: 7 مارس 2026
الحالة: ✅ يعمل بشكل صحيح
