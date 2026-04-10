# 🚀 Quick Start: اختبار Cloudflare R2

دليل سريع لاختبار Cloudflare R2 Storage في دقائق!

## ⚡ الطريقة السريعة (3 خطوات)

### 1️⃣ تأكد من وجود بيانات R2 في ملف .env

```bash
# افتح ملف .env وتأكد من وجود:
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-domain.com  # اختياري
```

### 2️⃣ شغل التيست

اختر واحد من الطرق التالية:

#### أ) باستخدام PowerShell (موصى به):
```powershell
.\test-r2.ps1
```

#### ب) باستخدام npm:
```bash
# اختبار شامل للـ R2 API
npm run test:r2

# اختبار الـ Service المستخدم في التطبيق
npm run test:r2:service
```

#### ج) مباشرة:
```bash
ts-node test-r2-reels.ts
```

### 3️⃣ شوف النتيجة ✅

إذا كل شيء شغال، راح تشوف:
```
✓ Connected to bucket
✓ Video uploaded successfully!
✓ Thumbnail uploaded successfully!
✓ All tests passed!
```

---

## 🎯 الفرق بين التيستات

### `test-r2-reels.ts` - اختبار شامل للـ R2 API
- اختبار الاتصال المباشر بـ R2
- رفع وحذف الملفات
- اختبار الـ Public URLs
- **استخدمه**: للتأكد من إعدادات R2 الأساسية

### `test-r2-service.ts` - اختبار الـ Service
- اختبار الـ R2MediaStorageService المستخدم في التطبيق
- اختبار جميع أنواع الملفات (reels, thumbnails, avatars, covers)
- اختبار معالجة الأخطاء
- **استخدمه**: للتأكد من أن الكود في التطبيق شغال صح

---

## 🔧 حل المشاكل السريع

### ❌ "Missing R2 environment variables"
```bash
# تأكد من وجود ملف .env
ls .env

# إذا مش موجود، انسخ من المثال
cp .env.example .env

# عدل البيانات
nano .env  # أو استخدم أي محرر نصوص
```

### ❌ "Failed to connect to bucket"
1. تحقق من الـ Endpoint صحيح
2. تأكد من الـ Access Keys صحيحة
3. تأكد من أن الـ Bucket موجود في Cloudflare

### ❌ "ts-node: command not found"
```bash
npm install -g ts-node typescript
```

---

## 📊 ماذا يختبر السكريبت؟

### للريلز (Reels):
- ✅ رفع فيديو إلى `reels/` folder
- ✅ رفع ثمبنيل إلى `thumbnails/` folder
- ✅ قراءة الملفات من الباكيت
- ✅ حذف الملفات بعد الاختبار

### للـ Service:
- ✅ رفع reels
- ✅ رفع thumbnails
- ✅ رفع avatars
- ✅ رفع covers
- ✅ معالجة الأخطاء
- ✅ حذف الملفات

---

## 🎨 مثال على النتيجة

```
======================================================================
  Cloudflare R2 Reels Bucket Test Suite
======================================================================

Configuration:
  Endpoint: https://abc123.r2.cloudflarestorage.com
  Bucket: 90plus-media
  Public URL: https://media.90plus.app

Running tests...

ℹ Testing bucket connection...
✓ Connected to bucket: 90plus-media

ℹ Testing video upload to reels bucket...
✓ Video uploaded successfully!
ℹ   Key: reels/test-user-1234567890/test-video.mp4
ℹ   Public URL: https://media.90plus.app/reels/test-user-1234567890/test-video.mp4

✓ All tests passed!
```

---

## 📝 ملاحظات مهمة

1. **الملفات التجريبية صغيرة جداً** (32-22 بايت فقط)
2. **التنظيف التلقائي**: السكريبت يحذف الملفات بعد الاختبار
3. **آمن 100%**: لا يؤثر على البيانات الحقيقية
4. **بدون تكلفة**: الاختبارات لا تستهلك storage تقريباً

---

## 🔗 روابط مفيدة

- [Cloudflare R2 Dashboard](https://dash.cloudflare.com/?to=/:account/r2)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [ملف README الكامل](./TEST-R2-README.md)

---

## 💡 نصيحة

بعد ما تتأكد إن التيست شغال، جرب رفع ملف حقيقي:

```typescript
import { r2MediaStorage } from './src/services/r2-media-storage.service';

const result = await r2MediaStorage.uploadPublic(
  'reels',
  'user-123',
  videoBuffer,
  'my-reel.mp4',
  'video/mp4'
);

console.log('Video URL:', result.url);
```

---

**محتاج مساعدة؟** شوف [TEST-R2-README.md](./TEST-R2-README.md) للتفاصيل الكاملة.
