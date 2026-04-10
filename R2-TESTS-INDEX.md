# 🎯 Cloudflare R2 Tests - الدليل الشامل

## 🚀 البداية السريعة (30 ثانية)

```bash
# اختبار سريع للتأكد من أن R2 يعمل
npm run test:r2:quick
```

النتيجة المتوقعة:
```
🚀 Quick R2 Test (30 seconds)

1. Testing connection... ✓
2. Testing upload... ✓
3. Testing delete... ✓

✅ All tests passed! R2 is working correctly.
```

---

## 📚 جميع الأوامر المتاحة

| الأمر | الوقت | الوصف | متى تستخدمه |
|------|------|-------|-------------|
| `npm run test:r2:quick` | 30 ثانية | اختبار سريع | للتحقق السريع من الاتصال |
| `npm run test:r2` | 1-2 دقيقة | اختبار شامل للـ API | للتأكد من جميع الوظائف |
| `npm run test:r2:service` | 1-2 دقيقة | اختبار الـ Service | لاختبار كود التطبيق |
| `npm run check:r2` | 10 ثواني | فحص الباكيت | لعرض المحتويات والإحصائيات |
| `.\test-r2.ps1` | 1-2 دقيقة | تشغيل تلقائي | الطريقة الأسهل (Windows) |

---

## 📁 الملفات والأدوات

### 🔧 سكريبتات الاختبار

#### 1. **quick-test-r2.ts** ⚡
اختبار سريع في 30 ثانية
```bash
npm run test:r2:quick
```
- ✅ اختبار الاتصال
- ✅ اختبار الرفع
- ✅ اختبار الحذف

#### 2. **test-r2-reels.ts** 🎬
اختبار شامل للـ R2 API (7 اختبارات)
```bash
npm run test:r2
```
- ✅ الاتصال بالباكيت
- ✅ رفع فيديو
- ✅ رفع ثمبنيل
- ✅ عرض قائمة الملفات
- ✅ تحميل ملف
- ✅ اختبار Public URL
- ✅ حذف الملفات

#### 3. **test-r2-service.ts** 🔨
اختبار الـ Service المستخدم في التطبيق
```bash
npm run test:r2:service
```
- ✅ رفع reels
- ✅ رفع thumbnails
- ✅ رفع avatars
- ✅ رفع covers
- ✅ معالجة الأخطاء
- ✅ حذف الملفات

#### 4. **check-r2-bucket.ts** 📊
فحص محتويات الباكيت
```bash
npm run check:r2
```
- 📊 عدد الملفات
- 📏 حجم الملفات
- 📋 قائمة الملفات
- 🔍 حالة الاتصال

#### 5. **test-r2.ps1** 🪟
سكريبت PowerShell تلقائي
```powershell
.\test-r2.ps1
```
- ✅ التحقق من .env
- ✅ تثبيت المكتبات
- ✅ تشغيل الاختبارات

---

### 📖 ملفات التوثيق

#### 1. **QUICK-START-R2-TEST.md** 🚀
دليل البداية السريعة (3 خطوات)
- إعداد .env
- تشغيل التيست
- مشاهدة النتيجة

#### 2. **TEST-R2-README.md** 📚
الدليل الكامل والشامل
- المتطلبات والتثبيت
- شرح كل اختبار
- حل المشاكل
- أمثلة الاستخدام

#### 3. **R2-TEST-SUMMARY.md** 📋
ملخص شامل لجميع الأدوات
- وصف كل ملف
- متى تستخدم كل أداة
- Checklist للـ production

#### 4. **R2-TESTS-INDEX.md** 📑
هذا الملف - الفهرس الشامل

---

## 🎯 سيناريوهات الاستخدام

### السيناريو 1: أول مرة تختبر R2
```bash
# 1. تأكد من إعداد .env
cat .env | grep R2_

# 2. اختبار سريع
npm run test:r2:quick

# 3. إذا نجح، شغل الاختبار الشامل
npm run test:r2
```

### السيناريو 2: اختبار بعد تعديل الكود
```bash
# اختبر الـ Service مباشرة
npm run test:r2:service
```

### السيناريو 3: فحص الباكيت الحالي
```bash
# شوف المحتويات والإحصائيات
npm run check:r2
```

### السيناريو 4: مشكلة في الاتصال
```bash
# 1. اختبار سريع للتشخيص
npm run test:r2:quick

# 2. إذا فشل، تحقق من .env
cat .env | grep R2_

# 3. تحقق من Cloudflare Dashboard
```

---

## 🔧 الإعداد الأولي

### 1. إنشاء ملف .env
```bash
cp .env.example .env
nano .env
```

### 2. إضافة بيانات R2
```env
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=90plus-media
R2_PUBLIC_URL=https://media.90plus.app
```

### 3. الحصول على البيانات من Cloudflare

#### R2_ENDPOINT:
1. اذهب إلى [Cloudflare Dashboard](https://dash.cloudflare.com)
2. R2 > Overview
3. انسخ Account ID
4. الصيغة: `https://<account-id>.r2.cloudflarestorage.com`

#### R2_ACCESS_KEY_ID & R2_SECRET_ACCESS_KEY:
1. R2 > Manage R2 API Tokens
2. Create API Token
3. اختر Read & Write permissions
4. احفظ الـ Keys

#### R2_BUCKET_NAME:
1. R2 > Buckets
2. انسخ اسم الباكيت (مثلاً: `90plus-media`)

#### R2_PUBLIC_URL (اختياري):
1. R2 > Bucket > Settings
2. Custom Domains
3. Add Domain
4. استخدم الـ Domain (مثلاً: `https://media.90plus.app`)

---

## 📊 مقارنة الاختبارات

| الميزة | Quick Test | Full Test | Service Test | Check Bucket |
|--------|-----------|-----------|--------------|--------------|
| الوقت | 30 ثانية | 1-2 دقيقة | 1-2 دقيقة | 10 ثواني |
| عدد الاختبارات | 3 | 7 | 9+ | 0 (فحص فقط) |
| رفع ملفات | ✓ | ✓ | ✓ | ✗ |
| حذف ملفات | ✓ | ✓ | ✓ | ✗ |
| اختبار Service | ✗ | ✗ | ✓ | ✗ |
| عرض محتويات | ✗ | ✗ | ✗ | ✓ |
| الاستخدام | تشخيص سريع | اختبار شامل | اختبار الكود | فحص البيانات |

---

## 🎓 أمثلة على الاستخدام

### مثال 1: اختبار يومي سريع
```bash
# كل يوم قبل البدء
npm run test:r2:quick
```

### مثال 2: قبل الـ deployment
```bash
# اختبار شامل
npm run test:r2
npm run test:r2:service

# فحص الباكيت
npm run check:r2
```

### مثال 3: بعد تعديل الكود
```bash
# اختبر الـ Service فقط
npm run test:r2:service
```

### مثال 4: تشخيص مشكلة
```bash
# 1. اختبار سريع
npm run test:r2:quick

# 2. إذا فشل، اختبار شامل
npm run test:r2

# 3. فحص الباكيت
npm run check:r2
```

---

## 🔍 فهم النتائج

### نتيجة ناجحة ✅
```
✓ Connected to bucket
✓ Video uploaded successfully!
✓ All tests passed!
```
**معناها:** كل شيء يعمل بشكل صحيح

### نتيجة فاشلة ❌
```
✗ Failed to connect to bucket: InvalidAccessKeyId
```
**معناها:** مشكلة في الـ Access Keys

### تحذير ⚠️
```
⚠️ Public URL not configured
```
**معناها:** R2_PUBLIC_URL غير معد (اختياري)

---

## 🐛 حل المشاكل الشائعة

### 1. "Missing R2 environment variables"
```bash
# تحقق من .env
cat .env | grep R2_

# إذا فارغ، أضف البيانات
nano .env
```

### 2. "Failed to connect to bucket"
- تحقق من الـ Endpoint
- تأكد من الـ Access Keys
- تحقق من اسم الباكيت

### 3. "ts-node: command not found"
```bash
npm install -g ts-node typescript
```

### 4. "Bucket not found"
- تأكد من أن الباكيت موجود في Cloudflare
- تحقق من اسم الباكيت في .env

### 5. "Access Denied"
- تحقق من صلاحيات الـ API Token
- يجب أن يكون Read & Write

---

## 📈 Workflow موصى به

### للمطورين الجدد:
```bash
1. npm run test:r2:quick      # اختبار سريع
2. npm run test:r2            # اختبار شامل
3. npm run check:r2           # فحص الباكيت
4. npm run test:r2:service    # اختبار الكود
```

### للاستخدام اليومي:
```bash
npm run test:r2:quick         # كل يوم
npm run test:r2:service       # بعد تعديل الكود
npm run check:r2              # عند الحاجة
```

### قبل الـ Production:
```bash
npm run test:r2               # اختبار شامل
npm run test:r2:service       # اختبار الكود
npm run check:r2              # فحص البيانات
```

---

## ✅ Checklist للـ Production

قبل نشر التطبيق:

- [ ] `npm run test:r2:quick` يعمل بنجاح
- [ ] `npm run test:r2` يعمل بنجاح
- [ ] `npm run test:r2:service` يعمل بنجاح
- [ ] الـ Public URL يعمل
- [ ] الـ Custom Domain مربوط
- [ ] الـ CORS settings صحيحة
- [ ] الـ Lifecycle rules معدة
- [ ] الـ Access Keys آمنة
- [ ] الـ .env في .gitignore
- [ ] الـ Bucket permissions صحيحة

---

## 🎉 الخلاصة

الآن عندك مجموعة كاملة من الأدوات:

- ✅ **4 سكريبتات اختبار** (quick, full, service, check)
- ✅ **1 سكريبت PowerShell** تلقائي
- ✅ **4 ملفات توثيق** شاملة
- ✅ **5 أوامر npm** جاهزة

**ابدأ الآن:**
```bash
npm run test:r2:quick
```

---

## 📞 الدعم

إذا واجهت أي مشاكل:
1. اقرأ [QUICK-START-R2-TEST.md](./QUICK-START-R2-TEST.md)
2. راجع [TEST-R2-README.md](./TEST-R2-README.md)
3. شوف [R2-TEST-SUMMARY.md](./R2-TEST-SUMMARY.md)

---

**Happy Testing! 🚀**
