# حل مشاكل الفيديو في صفحة الريلز

## المشكلة الحالية
خطأ: `Player error: Decoder failed: c2.qti.avc.decoder`
الشاشة السوداء في صفحة الريلز

## الحلول المطبقة

### 1. تحديث روابط الفيديو
تم استبدال روابط Google Cloud Storage بروابط أكثر توافقاً:
- `https://www.w3schools.com/html/mov_bbb.mp4`
- `https://www.w3schools.com/html/movie.mp4`

### 2. إضافة Error Handling
- عرض thumbnail عند فشل التحميل
- رسالة خطأ واضحة بالعربية
- زر "إعادة المحاولة"

### 3. تكوين الصوت والفيديو
تم إضافة `configureAudioVideo()` في `app/_layout.tsx`

### 4. تحسينات Video Component
- إضافة `onLoadStart` و `onReadyForDisplay`
- استخدام `volume` بدلاً من `isMuted` فقط
- إضافة `shouldCorrectPitch`
- تحسين logging للتتبع

## خطوات إضافية للحل

### الحل 1: استخدام فيديوهات محلية (الأفضل)

1. أضف فيديوهات في مجلد `assets/videos/`:
```
assets/
  videos/
    reel1.mp4
    reel2.mp4
    reel3.mp4
```

2. حدث `mockData.ts`:
```typescript
videoUrl: require('../../assets/videos/reel1.mp4'),
```

3. حدث `ReelItem.tsx`:
```typescript
source={typeof reel.videoUrl === 'string' 
  ? { uri: reel.videoUrl } 
  : reel.videoUrl
}
```

### الحل 2: استخدام روابط من API خاص بك

```typescript
// في mockData.ts
videoUrl: 'https://your-api.com/videos/reel1.mp4',
```

تأكد من:
- الفيديوهات بصيغة MP4
- Codec: H.264
- Audio: AAC
- الروابط تدعم HTTPS

### الحل 3: تحديث expo-av

```bash
npx expo install expo-av@latest
```

### الحل 4: إضافة permissions في app.json

```json
{
  "expo": {
    "android": {
      "permissions": [
        "INTERNET",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "ios": {
      "infoPlist": {
        "NSAppTransportSecurity": {
          "NSAllowsArbitraryLoads": true
        }
      }
    }
  }
}
```

### الحل 5: تنظيف Cache

```bash
# توقف عن Metro bundler
# ثم نفذ:
npx expo start -c

# أو
npm start -- --reset-cache
```

## اختبار الحل

### 1. تحقق من Logs
ابحث عن:
- ✅ `Video loaded successfully`
- 📺 `Video ready for display`
- ❌ `Video error` (إذا ظهر، اقرأ التفاصيل)

### 2. اختبر على جهاز حقيقي
المحاكي قد لا يدعم جميع codecs

### 3. جرب فيديو بسيط
استخدم فيديو قصير (< 5MB) للاختبار:
```typescript
videoUrl: 'https://www.w3schools.com/html/movie.mp4'
```

## مواصفات الفيديو الموصى بها

### للأداء الأفضل:
- **Format:** MP4
- **Video Codec:** H.264 (AVC)
- **Audio Codec:** AAC
- **Resolution:** 720p أو 1080p
- **Bitrate:** 2-5 Mbps
- **Frame Rate:** 30fps
- **Duration:** 15-60 ثانية

### أدوات التحويل:
```bash
# باستخدام FFmpeg
ffmpeg -i input.mp4 -c:v libx264 -c:a aac -b:v 3M -vf scale=720:1280 output.mp4
```

## الأخطاء الشائعة وحلولها

### خطأ: "Decoder failed"
**السبب:** codec غير مدعوم
**الحل:** استخدم H.264 codec

### خطأ: "Network error"
**السبب:** مشكلة في الاتصال أو CORS
**الحل:** تحقق من الإنترنت واستخدم روابط تدعم CORS

### خطأ: "Source not found"
**السبب:** الرابط غير صحيح
**الحل:** تحقق من الرابط في المتصفح

## الدعم

إذا استمرت المشكلة:

1. **تحقق من نوع الجهاز:**
   - بعض الأجهزة لا تدعم codecs معينة
   - جرب على جهاز آخر

2. **تحقق من إصدار expo-av:**
   ```bash
   npm list expo-av
   ```

3. **استخدم فيديوهات محلية مؤقتاً:**
   - ضع فيديو في assets
   - استخدم `require()` بدلاً من URL

4. **تحقق من app.json:**
   - تأكد من وجود permissions الصحيحة

## ملاحظات مهمة

⚠️ **لا تستخدم:**
- فيديوهات بحجم كبير (> 50MB)
- codecs غير شائعة (VP9, AV1)
- روابط لا تدعم streaming

✅ **استخدم:**
- فيديوهات محسّنة للموبايل
- H.264 codec
- روابط CDN سريعة
- فيديوهات محلية للتطوير
