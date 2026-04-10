# Cloudflare R2 Reels Bucket Test Suite

اختبار شامل لـ Cloudflare R2 Storage خصوصاً باكيت الريلز والثمبنيلز.

## المتطلبات

1. **Node.js** (v16 أو أحدث)
2. **TypeScript & ts-node**
3. **AWS SDK for JavaScript v3**
4. **ملف .env** مع بيانات الاتصال بـ R2

## التثبيت

### 1. تثبيت المكتبات المطلوبة

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner dotenv
npm install -g ts-node typescript
```

### 2. إعداد ملف .env

أضف المتغيرات التالية إلى ملف `.env`:

```env
# Cloudflare R2 Configuration
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=90plus-media
R2_PUBLIC_URL=https://media.90plus.app
```

#### كيفية الحصول على البيانات:

1. **R2_ENDPOINT**: 
   - اذهب إلى Cloudflare Dashboard > R2
   - انسخ الـ Account ID
   - الصيغة: `https://<account-id>.r2.cloudflarestorage.com`

2. **R2_ACCESS_KEY_ID & R2_SECRET_ACCESS_KEY**:
   - Cloudflare Dashboard > R2 > Manage R2 API Tokens
   - اضغط "Create API Token"
   - اختر الصلاحيات (Read & Write)
   - احفظ الـ Access Key ID و Secret Access Key

3. **R2_BUCKET_NAME**:
   - اسم الباكيت اللي أنشأته في R2 (مثلاً: `90plus-media`)

4. **R2_PUBLIC_URL** (اختياري):
   - إذا ربطت Custom Domain مع الباكيت
   - مثال: `https://media.90plus.app`

## تشغيل الاختبارات

### طريقة 1: باستخدام PowerShell Script (موصى به)

```powershell
.\test-r2.ps1
```

السكريبت سيقوم بـ:
- التحقق من وجود ملف .env
- تثبيت المكتبات المطلوبة إذا لم تكن موجودة
- تشغيل جميع الاختبارات
- عرض النتائج بشكل منظم

### طريقة 2: تشغيل مباشر

```bash
ts-node test-r2-reels.ts
```

## الاختبارات المتضمنة

السكريبت يقوم بـ 7 اختبارات:

### 1. ✓ Bucket Connection
- اختبار الاتصال بالباكيت
- التحقق من صحة البيانات (Credentials)

### 2. ✓ Upload Video to Reels Bucket
- رفع ملف فيديو تجريبي إلى `reels/` folder
- التحقق من نجاح الرفع
- عرض الـ Public URL

### 3. ✓ Upload Thumbnail
- رفع صورة ثمبنيل تجريبية إلى `thumbnails/` folder
- التحقق من نجاح الرفع

### 4. ✓ List Files
- عرض قائمة الملفات في الباكيت
- التحقق من وجود الملفات المرفوعة

### 5. ✓ Download File
- تحميل ملف من الباكيت
- التحقق من صحة المحتوى

### 6. ✓ Public URL Access
- اختبار الوصول للملفات عبر الـ Public URL
- (يتطلب إعداد Custom Domain)

### 7. ✓ Delete Files
- حذف الملفات التجريبية
- تنظيف الباكيت بعد الاختبار

## مثال على النتيجة

```
======================================================================
  Cloudflare R2 Reels Bucket Test Suite
======================================================================

Configuration:
  Endpoint: https://abc123.r2.cloudflarestorage.com
  Bucket: 90plus-media
  Public URL: https://media.90plus.app
  Access Key: ***xyz4

Running tests...

ℹ Testing bucket connection...
✓ Connected to bucket: 90plus-media

ℹ Testing video upload to reels bucket...
✓ Video uploaded successfully!
ℹ   Key: reels/test-user-1234567890/test-video-1234567890.mp4
ℹ   Size: 32 bytes
ℹ   Public URL: https://media.90plus.app/reels/test-user-1234567890/test-video-1234567890.mp4

ℹ Testing thumbnail upload...
✓ Thumbnail uploaded successfully!
ℹ   Key: thumbnails/test-user-1234567890/test-thumb-1234567890.jpg
ℹ   Size: 22 bytes
ℹ   Public URL: https://media.90plus.app/thumbnails/test-user-1234567890/test-thumb-1234567890.jpg

ℹ Testing file listing...
✓ Found 1 file(s) in reels bucket
ℹ   1. reels/test-user-1234567890/test-video-1234567890.mp4 (32 bytes)

ℹ Testing file download...
✓ File downloaded successfully!
ℹ   Size: 32 bytes
ℹ   Content-Type: video/mp4

ℹ Testing public URL access...
✓ Public URL is accessible (Status: 200)

ℹ Testing file deletion...
✓ Deleted video: reels/test-user-1234567890/test-video-1234567890.mp4
✓ Deleted thumbnail: thumbnails/test-user-1234567890/test-thumb-1234567890.jpg

======================================================================
  Test Summary
======================================================================

✓ Bucket Connection
✓ Upload Video to Reels Bucket
✓ Upload Thumbnail
✓ List Files
✓ Download File
✓ Public URL Access
✓ Delete Files

Total: 7 tests
Passed: 7

======================================================================
```

## استكشاف الأخطاء

### خطأ: "Missing R2 environment variables"
- تأكد من وجود ملف `.env` في نفس المجلد
- تأكد من إضافة جميع المتغيرات المطلوبة

### خطأ: "Failed to connect to bucket"
- تحقق من صحة الـ Endpoint
- تأكد من صحة الـ Access Key و Secret Key
- تحقق من أن الـ API Token له صلاحيات Read & Write

### خطأ: "Bucket not found"
- تأكد من أن اسم الباكيت صحيح
- تحقق من أن الباكيت موجود في حسابك على Cloudflare

### خطأ: "Public URL not accessible"
- تأكد من ربط Custom Domain مع الباكيت
- تحقق من إعدادات الـ Public Access في Cloudflare
- قد يحتاج الأمر بضع دقائق لتفعيل الـ Domain

## ملاحظات مهمة

1. **الملفات التجريبية**: السكريبت ينشئ ملفات صغيرة جداً (32-22 بايت) للاختبار فقط
2. **التنظيف التلقائي**: السكريبت يحذف الملفات التجريبية بعد الانتهاء
3. **الأمان**: لا تشارك ملف `.env` أو تضعه في Git
4. **التكلفة**: الاختبارات لا تستهلك تقريباً أي storage أو bandwidth

## دمج مع المشروع

بعد التأكد من نجاح الاختبارات، يمكنك استخدام الـ R2 Storage Service في المشروع:

```typescript
import { r2MediaStorage } from './src/services/r2-media-storage.service';

// رفع فيديو ريل
const result = await r2MediaStorage.uploadPublic(
  'reels',
  userId,
  videoBuffer,
  'my-reel.mp4',
  'video/mp4'
);

if (result.success) {
  console.log('Video URL:', result.url);
  console.log('Storage Key:', result.key);
}

// حذف فيديو
await r2MediaStorage.deleteObject(result.key);
```

## الدعم

إذا واجهت أي مشاكل:
1. تحقق من الـ Cloudflare Dashboard للتأكد من إعدادات R2
2. راجع الـ logs في الـ console
3. تأكد من أن جميع المكتبات محدثة

## الموارد

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [S3 API Compatibility](https://developers.cloudflare.com/r2/api/s3/api/)
