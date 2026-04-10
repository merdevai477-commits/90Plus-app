# 🚀 كيف تشغل اختبارات R2

## ⚠️ مهم جداً: المجلد الصحيح

الملفات موجودة في **المجلد الرئيسي** (Backend)، وليس في مجلد `front`!

```powershell
# إذا كنت في مجلد front، ارجع للمجلد الرئيسي
PS C:\Football-app\front> cd ..

# الآن أنت في المجلد الصحيح
PS C:\Football-app>
```

---

## ✅ الطريقة الصحيحة للتشغيل

### من المجلد الرئيسي (C:\Football-app):

```powershell
# اختبار سريع (30 ثانية)
npm run test:r2:quick

# اختبار شامل
npm run test:r2

# اختبار الـ Service
npm run test:r2:service

# فحص الباكيت
npm run check:r2

# أو باستخدام PowerShell Script
.\test-r2.ps1
```

---

## 📁 البنية الصحيحة

```
C:\Football-app\                    ← المجلد الرئيسي (Backend)
├── test-r2-reels.ts               ← ملفات الاختبار هنا
├── test-r2-service.ts
├── quick-test-r2.ts
├── check-r2-bucket.ts
├── test-r2.ps1
├── package.json                    ← الأوامر مضافة هنا
├── .env                            ← بيانات R2 هنا
├── src/                            ← Backend code
│   └── services/
│       ├── r2-storage.service.ts
│       └── r2-media-storage.service.ts
└── front/                          ← Frontend (React Native)
    └── package.json                ← ملف مختلف
```

---

## 🎯 الخطوات الصحيحة

### 1. تأكد من المجلد الحالي
```powershell
# اعرض المجلد الحالي
pwd

# يجب أن يكون:
# C:\Football-app
# وليس C:\Football-app\front
```

### 2. إذا كنت في مجلد front، ارجع
```powershell
cd ..
```

### 3. تأكد من وجود ملف .env
```powershell
# اعرض محتوى .env
cat .env | Select-String "R2_"

# يجب أن تشوف:
# R2_ENDPOINT=...
# R2_ACCESS_KEY_ID=...
# R2_SECRET_ACCESS_KEY=...
# R2_BUCKET_NAME=...
```

### 4. شغل الاختبار
```powershell
npm run test:r2:quick
```

---

## 🔧 إذا واجهت مشاكل

### المشكلة: "Missing script"
**السبب:** أنت في مجلد `front` بدلاً من المجلد الرئيسي

**الحل:**
```powershell
cd ..
npm run test:r2:quick
```

### المشكلة: "test-r2.ps1 not recognized"
**السبب:** أنت في مجلد `front`

**الحل:**
```powershell
cd ..
.\test-r2.ps1
```

### المشكلة: "Cannot find module"
**السبب:** المكتبات غير مثبتة

**الحل:**
```powershell
# تأكد أنك في المجلد الرئيسي
cd C:\Football-app

# ثبت المكتبات
npm install
```

---

## 📝 ملخص سريع

```powershell
# 1. اذهب للمجلد الرئيسي
cd C:\Football-app

# 2. تأكد من .env
cat .env | Select-String "R2_"

# 3. شغل الاختبار
npm run test:r2:quick

# 4. إذا نجح، شغل الاختبار الشامل
npm run test:r2
```

---

## 🎯 الأوامر المتاحة (من المجلد الرئيسي فقط)

| الأمر | الوصف |
|------|-------|
| `npm run test:r2:quick` | اختبار سريع (30 ثانية) |
| `npm run test:r2` | اختبار شامل (دقيقتين) |
| `npm run test:r2:service` | اختبار الـ Service |
| `npm run check:r2` | فحص الباكيت |
| `.\test-r2.ps1` | PowerShell Script |

---

## ✅ مثال كامل

```powershell
# ابدأ من أي مكان
PS C:\Football-app\front> cd ..

# الآن أنت في المجلد الصحيح
PS C:\Football-app> 

# تحقق من .env
PS C:\Football-app> cat .env | Select-String "R2_"
R2_ENDPOINT=https://abc123.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_key
R2_SECRET_ACCESS_KEY=your_secret
R2_BUCKET_NAME=90plus-media

# شغل الاختبار
PS C:\Football-app> npm run test:r2:quick

# النتيجة المتوقعة:
🚀 Quick R2 Test (30 seconds)

1. Testing connection... ✓
2. Testing upload... ✓
3. Testing delete... ✓

✅ All tests passed! R2 is working correctly.
```

---

## 🚨 تذكير مهم

- ✅ **المجلد الصحيح:** `C:\Football-app` (المجلد الرئيسي)
- ❌ **المجلد الخطأ:** `C:\Football-app\front`
- ✅ **ملف .env:** في المجلد الرئيسي
- ✅ **الأوامر:** تعمل من المجلد الرئيسي فقط

---

**ابدأ الآن:**
```powershell
cd C:\Football-app
npm run test:r2:quick
```
