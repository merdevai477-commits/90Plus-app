# تصميم إصلاح الأخطاء: إصلاحات الأمان والتقنية لمراجعة Apple

## نظرة عامة

يتناول هذا التصميم ثلاث مشاكل حرجة تم اكتشافها في تطبيق 90Plus والتي تمنع الموافقة على التطبيق من قبل Apple:

1. **ثغرة أمنية حرجة (E002)**: بيانات اعتماد مشفرة في `front/globalState.ts` تسمح بتجاوز نظام المصادقة Clerk
2. **مشكلة تقنية حرجة (E007)**: تعطيل اكتشاف مدة الفيديو في `front/utils/videoDuration.ts` بسبب عدم توافق Expo SDK 52
3. **مشكلة تقنية حرجة (E007)**: تعطيل إنشاء الصور المصغرة في `front/utils/videoCompressor.ts` بسبب إزالة `expo-video-thumbnails`

الاستراتيجية العامة للإصلاح:
- إزالة كامل لدالة `login()` المشفرة وتنظيف الكود المرتبط
- استخدام `expo-av` لاستخراج مدة الفيديو بطريقة متوافقة مع SDK 52
- استخدام `expo-video-thumbnails` (إعادة تثبيت) أو `expo-video` لإنشاء الصور المصغرة

## المصطلحات

- **Bug_Condition (C)**: الشرط الذي يؤدي لظهور الخطأ
- **Property (P)**: السلوك المطلوب عند حدوث شرط الخطأ
- **Preservation**: السلوكيات الموجودة التي يجب أن تبقى دون تغيير
- **globalState**: كائن الحالة العامة في `front/globalState.ts` الذي يدير حالة المستخدم
- **extractDurationFromUrl**: دالة في `front/utils/videoDuration.ts` لاستخراج مدة الفيديو
- **generateThumbnail**: دالة في `front/utils/videoCompressor.ts` لإنشاء صورة مصغرة للفيديو
- **Clerk**: نظام المصادقة الرسمي المستخدم في التطبيق
- **Expo SDK 52**: الإصدار الحالي من Expo الذي أزال بعض APIs القديمة


## تفاصيل الأخطاء

### 1. شرط الخطأ: ثغرة بيانات الاعتماد المشفرة

تظهر الثغرة الأمنية عندما يستطيع أي مستخدم تجاوز نظام المصادقة Clerk باستخدام بيانات اعتماد مشفرة في الكود.

**المواصفات الرسمية:**
```
FUNCTION isBugCondition_HardcodedCredentials(input)
  INPUT: input of type { username: string, password: string }
  OUTPUT: boolean
  
  RETURN input.username == 'mahmoud_essam' 
         AND input.password == 'password'
         AND globalState.login() exists
         AND login() bypasses Clerk authentication
END FUNCTION
```

**أمثلة:**

- **مثال 1**: مستخدم يستدعي `globalState.login('mahmoud_essam', 'password')` → يحصل على وصول كامل بنوع 'diamond' دون مصادقة Clerk
- **مثال 2**: التطبيق يحمل حالة محفوظة من تسجيل دخول سابق ببيانات مشفرة → يستعيد الوصول المميز دون التحقق من صلاحية الجلسة
- **مثال 3**: فريق مراجعة Apple يفحص `front/globalState.ts` السطر 112 → يجد بيانات الاعتماد المشفرة بوضوح
- **حالة حدية**: مستخدم يحاول `login('wrong', 'credentials')` → يفشل التسجيل لكن الثغرة لا تزال موجودة في الكود

### 2. شرط الخطأ: تعطيل اكتشاف مدة الفيديو

يظهر الخطأ عندما يحاول النظام استخراج مدة الفيديو لكن الدالة ترجع `null` دائماً بسبب عدم التوافق مع SDK 52.

**المواصفات الرسمية:**
```
FUNCTION isBugCondition_DurationDetection(input)
  INPUT: input of type { videoUri: string }
  OUTPUT: boolean
  
  RETURN input.videoUri is valid video file
         AND extractDurationFromUrl(input.videoUri) returns null
         AND Video.createAsync() is removed in expo-av 15 (SDK 52)
         AND no alternative duration extraction method exists
END FUNCTION
```

**أمثلة:**

- **مثال 1**: مستخدم يرفع فيديو مدته 3 ثوان → النظام يقبله لأن المدة غير معروفة (null)
- **مثال 2**: مستخدم يرفع فيديو مدته 120 ثانية → النظام يقبله لأن المدة غير معروفة (null)
- **مثال 3**: مستخدم يعرض فيديو في الملف الشخصي → مؤشر المدة يختفي (`shouldShowDuration()` يرجع false)
- **حالة حدية**: مستخدم يرفع فيديو مدته بالضبط 5 ثوان → يجب قبوله لكن لا يمكن التحقق


### 3. شرط الخطأ: تعطيل إنشاء الصور المصغرة

يظهر الخطأ عندما يحاول النظام إنشاء صورة مصغرة للفيديو لكن الدالة ترجع `null` دائماً بسبب إزالة المكتبة.

**المواصفات الرسمية:**
```
FUNCTION isBugCondition_ThumbnailGeneration(input)
  INPUT: input of type { videoUri: string }
  OUTPUT: boolean
  
  RETURN input.videoUri is valid video file
         AND generateThumbnail(input.videoUri) returns null
         AND expo-video-thumbnails is removed/deprecated in SDK 52
         AND no alternative thumbnail generation method exists
END FUNCTION
```

**أمثلة:**

- **مثال 1**: مستخدم يتصفح قائمة الفيديوهات → يرى معاينات سوداء أو فارغة بدلاً من صور مصغرة
- **مثال 2**: مستخدم يريد معرفة محتوى فيديو قبل تشغيله → مضطر لتحميل وتشغيل الفيديو كاملاً
- **مثال 3**: مستخدم يتصفح 50 فيديو → استهلاك بيانات عالي جداً بسبب تحميل كل الفيديوهات
- **حالة حدية**: فشل إنشاء الصورة المصغرة لسبب تقني → يجب عرض صورة افتراضية (placeholder)

## السلوك المتوقع

### متطلبات الحفاظ على السلوك الحالي

**السلوكيات غير المتغيرة:**
- وظائف المصادقة عبر Clerk يجب أن تستمر في العمل بشكل طبيعي
- دالة `logout()` يجب أن تستمر في مسح جميع البيانات المحلية
- دالة `loadState()` يجب أن تستمر في استعادة حالة المستخدم الصالحة
- وظائف `needsUsernameCompletion` و `tempAuthData` يجب أن تبقى دون تغيير
- دالة `formatDuration()` يجب أن تستمر في تنسيق المدة بصيغة MM:SS
- دالة `shouldShowDuration()` يجب أن تستمر في إخفاء المدة غير الصالحة
- جميع وظائف تشغيل الفيديو الحالية يجب أن تستمر في العمل
- دالة `prepareVideoForUpload()` يجب أن تستمر في إرجاع معلومات الفيديو
- دالة `uploadWithProgress()` يجب أن تستمر في تتبع تقدم الرفع
- دالة `shouldCompress()` يجب أن تستمر في تحديد الحاجة للضغط
- دالة `formatFileSize()` يجب أن تستمر في تنسيق حجم الملف

**النطاق:**
جميع المدخلات التي لا تتضمن استخدام دالة `login()` المشفرة أو رفع فيديوهات يجب أن تكون غير متأثرة بهذا الإصلاح. هذا يشمل:
- تسجيل الدخول عبر Clerk
- تسجيل الخروج
- إدارة الملف الشخصي
- تشغيل الفيديوهات الموجودة
- جميع الوظائف الأخرى في التطبيق


## السبب الجذري المفترض

بناءً على تحليل الكود، الأسباب الجذرية الأكثر احتمالاً هي:

### 1. ثغرة بيانات الاعتماد المشفرة

**السبب الجذري**: كود تطوير/اختبار لم يتم إزالته قبل الإنتاج

التحليل:
- دالة `login()` في السطر 112 من `front/globalState.ts` تحتوي على بيانات اعتماد مشفرة
- هذه الدالة على الأرجح كانت تستخدم للاختبار السريع أثناء التطوير
- لم يتم إزالتها قبل إرسال التطبيق لمراجعة Apple
- الدالة تتجاوز نظام Clerk بالكامل وتمنح وصول مباشر

**الدليل من الكود:**
```typescript
login: (username: string, password: string) => {
  // Mock login logic
  if (username === 'mahmoud_essam' && password === 'password') {
    globalState.userType = 'diamond';
    globalState.username = username;
    globalState.isLoggedIn = true;
    globalState.saveState();
    return true;
  }
  return false;
}
```

**التأثير الأمني:**
- أي شخص يفحص الكود يمكنه رؤية بيانات الاعتماد
- يمكن استخدامها للوصول غير المصرح به
- تنتهك معايير Apple الأمنية (App Store Review Guideline 2.3.1)
- تشكل خطر أمني حقيقي على المستخدمين

### 2. تعطيل اكتشاف مدة الفيديو

**السبب الجذري**: إزالة `Video.createAsync()` من expo-av 15 في Expo SDK 52

التحليل:
- الكود الأصلي كان يستخدم `Video.createAsync()` لتحميل الفيديو واستخراج المدة
- Expo SDK 52 أزال هذه الدالة من `expo-av` version 15
- المطور قام بتعطيل الوظيفة مؤقتاً بإرجاع `null` مع TODO comment
- لم يتم تنفيذ الحل البديل قبل إرسال التطبيق

**الدليل من الكود:**
```typescript
export async function extractDurationFromUrl(videoUrl: string): Promise<DurationResult> {
  if (!videoUrl) {
    return null;
  }

  try {
    // ✅ SDK 52: Video.createAsync removed from expo-av 15
    // Fallback: return null (duration detection disabled)
    // TODO: Re-enable with expo-video or fetch HEAD request
    const { logger } = await import('../services/logger');
    logger.warn('[videoDuration] Duration detection disabled in SDK 52');
    return null;
  } catch (error) {
    // ...
  }
}
```

**الحلول البديلة المتاحة:**
1. استخدام `expo-av` مع `Audio.Sound.createAsync()` لاستخراج المدة
2. استخدام `expo-video` الجديد (لكنه لا يزال في beta)
3. استخدام `react-native-video` مع event listener
4. استخدام FFmpeg لاستخراج metadata

**الحل الموصى به**: استخدام `expo-av` مع `Audio.Sound.createAsync()` لأنه:
- متوافق مع SDK 52
- لا يتطلب مكتبات إضافية
- يعمل مع ملفات الفيديو (لأن الفيديو يحتوي على audio track)
- خفيف الوزن وسريع


### 3. تعطيل إنشاء الصور المصغرة

**السبب الجذري**: إزالة/إهمال `expo-video-thumbnails` في Expo SDK 52

التحليل:
- الكود الأصلي كان يستخدم `expo-video-thumbnails` لإنشاء الصور المصغرة
- المكتبة تم إهمالها أو إزالتها في SDK 52
- المطور قام بتعطيل الوظيفة مؤقتاً بإرجاع `null` مع TODO comment
- لم يتم تنفيذ الحل البديل قبل إرسال التطبيق

**الدليل من الكود:**
```typescript
export async function generateThumbnail(
  videoUri: string,
  time: number = 1000
): Promise<string | null> {
  logger.warn('[videoCompressor] Thumbnail generation disabled in SDK 52');
  return null;
}
```

**الحلول البديلة المتاحة:**
1. إعادة تثبيت `expo-video-thumbnails` (قد يكون لا يزال متوافق)
2. استخدام `expo-video` الجديد مع `VideoThumbnails.getThumbnailAsync()`
3. استخدام FFmpeg لاستخراج frame من الفيديو
4. إنشاء الصور المصغرة على الخادم (Backend)

**الحل الموصى به**: إعادة تثبيت `expo-video-thumbnails` لأنه:
- قد يكون لا يزال متوافق مع SDK 52 (يحتاج للتحقق)
- بسيط وسهل الاستخدام
- لا يتطلب تغييرات كبيرة في الكود
- إذا لم يعمل، يمكن استخدام `expo-video` كبديل

**ملاحظة**: إذا لم يعمل `expo-video-thumbnails`، سنستخدم `expo-video` الذي يوفر:
```typescript
import { VideoThumbnails } from 'expo-video';

const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
  time: 1000, // milliseconds
});
```

## الخصائص الصحيحة

Property 1: شرط الخطأ - إزالة ثغرة بيانات الاعتماد المشفرة

_لأي_ محاولة تسجيل دخول في التطبيق، يجب على النظام المُصلح استخدام Clerk فقط للمصادقة ورفض أي بيانات اعتماد مشفرة، مما يضمن عدم وجود طريقة لتجاوز نظام المصادقة الرسمي.

**يتحقق من: المتطلبات 2.1, 2.2, 2.3, 2.4**

Property 2: شرط الخطأ - تفعيل اكتشاف مدة الفيديو

_لأي_ فيديو يتم رفعه، يجب على النظام المُصلح استخراج مدة الفيديو بنجاح باستخدام طريقة متوافقة مع Expo SDK 52، ورفض الفيديوهات التي مدتها أقل من 5 ثوان أو أكثر من 60 ثانية، وعرض المدة بتنسيق MM:SS للفيديوهات الصالحة.

**يتحقق من: المتطلبات 2.5, 2.6, 2.7, 2.8**

Property 3: شرط الخطأ - تفعيل إنشاء الصور المصغرة

_لأي_ فيديو يتم رفعه أو عرضه، يجب على النظام المُصلح إنشاء صورة مصغرة واضحة باستخدام طريقة متوافقة مع Expo SDK 52، وضغط الصورة لتحسين الأداء، وعرض صورة افتراضية في حالة الفشل.

**يتحقق من: المتطلبات 2.9, 2.10, 2.11, 2.12**

Property 4: الحفاظ - وظائف المصادقة الحالية

_لأي_ عملية مصادقة لا تستخدم دالة `login()` المشفرة (تسجيل دخول عبر Clerk، تسجيل خروج، استعادة الجلسة)، يجب على الكود المُصلح إنتاج نفس النتيجة تماماً كما في الكود الأصلي، مع الحفاظ على جميع وظائف Clerk وإدارة الحالة.

**يتحقق من: المتطلبات 3.1, 3.2, 3.3, 3.4**

Property 5: الحفاظ - وظائف عرض الفيديو الحالية

_لأي_ عملية عرض فيديو موجود (تنسيق المدة، إخفاء المدة غير الصالحة، تشغيل الفيديو)، يجب على الكود المُصلح إنتاج نفس النتيجة تماماً كما في الكود الأصلي، مع الحفاظ على جميع وظائف العرض والتشغيل.

**يتحقق من: المتطلبات 3.5, 3.6, 3.7**

Property 6: الحفاظ - وظائف رفع الفيديو الحالية

_لأي_ عملية رفع فيديو (تحضير الفيديو، تتبع التقدم، فحص الحجم، تنسيق الحجم)، يجب على الكود المُصلح إنتاج نفس النتيجة تماماً كما في الكود الأصلي، مع الحفاظ على جميع وظائف الرفع والضغط.

**يتحقق من: المتطلبات 3.8, 3.9, 3.10, 3.11**


## تنفيذ الإصلاح

### التغييرات المطلوبة

بافتراض أن تحليل السبب الجذري صحيح:

### 1. إصلاح ثغرة بيانات الاعتماد المشفرة

**الملف**: `front/globalState.ts`

**التغييرات المحددة**:

1. **حذف دالة `login()` بالكامل** (السطور 112-122):
   - إزالة الدالة التي تحتوي على بيانات الاعتماد المشفرة
   - إزالة أي إشارات لهذه الدالة في الكود

2. **تنظيف دالة `setUserType()`** (السطور 68-77):
   - إزالة المنطق الذي يضبط `username` إلى 'mahmoud_essam'
   - جعل الدالة تضبط فقط نوع المستخدم دون تسجيل دخول تلقائي
   - أو حذف الدالة بالكامل إذا لم تكن مستخدمة

3. **تحديث دالة `loadState()`** (السطور 30-47):
   - إضافة التحقق من صلاحية الجلسة مع Clerk
   - عدم استعادة حالة تسجيل الدخول إلا إذا كانت جلسة Clerk صالحة

4. **مراجعة استخدامات `globalState.login()`**:
   - البحث في جميع ملفات المشروع عن استدعاءات `globalState.login()`
   - إزالة أو استبدال هذه الاستدعاءات بمصادقة Clerk

**الكود المقترح للتغييرات**:

```typescript
// حذف دالة login() بالكامل
// DELETE: lines 112-122

// تحديث setUserType() لإزالة المنطق المشفر
setUserType: (type: 'guest' | 'admin' | 'diamond') => {
  globalState.userType = type;
  // إزالة: globalState.username = 'mahmoud_essam';
  // إزالة: globalState.isLoggedIn = true;
  globalState.saveState();
},

// تحديث loadState() للتحقق من Clerk
loadState: async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data: StoredState = JSON.parse(stored);
      
      // التحقق من صلاحية جلسة Clerk قبل استعادة حالة تسجيل الدخول
      // TODO: إضافة التحقق من Clerk session
      
      globalState.userType = data.userType || 'guest';
      globalState.username = data.username || '';
      globalState.userProfile = data.userProfile;
      globalState.isLoggedIn = data.isLoggedIn || false;
      globalState.localAvatar = data.localAvatar;
      globalState.localCover = data.localCover;
    }
  } catch (error) {
    console.error('Error loading global state:', error);
  } finally {
    globalState.isLoaded = true;
  }
},
```


### 2. إصلاح اكتشاف مدة الفيديو

**الملف**: `front/utils/videoDuration.ts`

**التغييرات المحددة**:

1. **تحديث دالة `extractDurationFromUrl()`** (السطور 115-133):
   - استبدال الكود المعطل بتنفيذ جديد يستخدم `expo-av`
   - استخدام `Audio.Sound.createAsync()` لتحميل الفيديو واستخراج المدة
   - معالجة الأخطاء بشكل صحيح
   - تحرير الموارد بعد الاستخدام

**الكود المقترح**:

```typescript
import { Audio } from 'expo-av';

export async function extractDurationFromUrl(videoUrl: string): Promise<DurationResult> {
  if (!videoUrl) {
    return null;
  }

  let sound: Audio.Sound | null = null;
  
  try {
    // استخدام Audio.Sound لتحميل الفيديو واستخراج المدة
    // يعمل مع ملفات الفيديو لأنها تحتوي على audio track
    const { sound: loadedSound, status } = await Audio.Sound.createAsync(
      { uri: videoUrl },
      { shouldPlay: false }, // عدم تشغيل الفيديو
      null, // no status update callback
      false // don't download to cache
    );
    
    sound = loadedSound;
    
    // التحقق من أن الحالة تحتوي على معلومات المدة
    if (status.isLoaded && status.durationMillis) {
      const durationSeconds = status.durationMillis / 1000;
      
      // تحرير الموارد
      await sound.unloadAsync();
      
      return durationSeconds;
    }
    
    // إذا لم نحصل على المدة، تحرير الموارد وإرجاع null
    await sound.unloadAsync();
    return null;
    
  } catch (error) {
    // تحرير الموارد في حالة الخطأ
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (unloadError) {
        // تجاهل أخطاء التحرير
      }
    }
    
    // تسجيل الخطأ
    try {
      const { logger } = await import('../services/logger');
      logger.warn('Failed to extract video duration:', error);
    } catch {
      // تجاهل أخطاء التسجيل في بيئة الاختبار
    }
    
    return null;
  }
}
```

**ملاحظات تقنية**:
- `Audio.Sound.createAsync()` يعمل مع ملفات الفيديو لأن الفيديو يحتوي على audio track
- يجب تحرير الموارد (`unloadAsync()`) بعد الاستخدام لتجنب تسريب الذاكرة
- المدة تُرجع بالميلي ثانية، يجب تحويلها إلى ثوان
- معالجة الأخطاء مهمة لأن بعض الفيديوهات قد لا تحتوي على audio track


### 3. إصلاح إنشاء الصور المصغرة

**الملف**: `front/utils/videoCompressor.ts`

**الاستراتيجية**: محاولة إعادة تثبيت `expo-video-thumbnails` أولاً، وإذا لم يعمل، استخدام `expo-video`

**التغييرات المحددة**:

1. **إعادة تثبيت المكتبة**:
   ```bash
   npx expo install expo-video-thumbnails
   ```

2. **تحديث دالة `generateThumbnail()`** (السطور 32-38):
   - استبدال الكود المعطل بتنفيذ جديد
   - استخدام `VideoThumbnails.getThumbnailAsync()` من `expo-video-thumbnails`
   - معالجة الأخطاء بشكل صحيح

3. **تحديث دالة `compressThumbnail()`** (السطور 40-47):
   - إعادة تفعيل ضغط الصور المصغرة
   - استخدام `expo-image-manipulator` لتقليل حجم الصورة

**الكود المقترح (الخيار 1: expo-video-thumbnails)**:

```typescript
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Generate thumbnail from video
 * SDK 52: Using expo-video-thumbnails
 */
export async function generateThumbnail(
  videoUri: string,
  time: number = 1000
): Promise<string | null> {
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(
      videoUri,
      {
        time, // milliseconds
        quality: 0.8, // 0-1, higher is better quality
      }
    );
    
    return uri;
  } catch (error) {
    logger.warn('[videoCompressor] Failed to generate thumbnail:', error);
    return null;
  }
}

/**
 * Compress thumbnail image
 * SDK 52: Using expo-image-manipulator
 */
export async function compressThumbnail(
  thumbnailUri: string,
  maxWidth: number = 720
): Promise<string> {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      thumbnailUri,
      [
        { resize: { width: maxWidth } } // الحفاظ على نسبة العرض إلى الارتفاع
      ],
      {
        compress: 0.8, // 0-1, higher is better quality
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    
    return manipResult.uri;
  } catch (error) {
    logger.warn('[videoCompressor] Failed to compress thumbnail:', error);
    // إرجاع الصورة الأصلية في حالة الفشل
    return thumbnailUri;
  }
}
```

**الكود المقترح (الخيار 2: expo-video - إذا لم يعمل الخيار 1)**:

```typescript
import { VideoThumbnails } from 'expo-video';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Generate thumbnail from video
 * SDK 52: Using expo-video (alternative)
 */
export async function generateThumbnail(
  videoUri: string,
  time: number = 1000
): Promise<string | null> {
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time, // milliseconds
    });
    
    return uri;
  } catch (error) {
    logger.warn('[videoCompressor] Failed to generate thumbnail:', error);
    return null;
  }
}
```

**المكتبات المطلوبة**:
- `expo-video-thumbnails` (الخيار 1 - الموصى به)
- `expo-image-manipulator` (لضغط الصور)
- `expo-video` (الخيار 2 - بديل)

**أوامر التثبيت**:
```bash
# الخيار 1 (الموصى به)
npx expo install expo-video-thumbnails expo-image-manipulator

# الخيار 2 (بديل)
npx expo install expo-video expo-image-manipulator
```


### 4. إضافة التحقق من مدة الفيديو عند الرفع

**الملفات المتأثرة**: 
- `front/components/reels/CreateReelScreen.tsx` (أو الملف المسؤول عن رفع الفيديو)
- `Backend/src/middleware/file-validation.middleware.ts` (التحقق من جانب الخادم)

**التغييرات المطلوبة**:

1. **في Frontend - قبل رفع الفيديو**:

```typescript
import { extractDurationFromUrl } from '../utils/videoDuration';

async function handleVideoUpload(videoUri: string) {
  // استخراج مدة الفيديو
  const duration = await extractDurationFromUrl(videoUri);
  
  // التحقق من المدة
  if (duration === null) {
    Alert.alert(
      'خطأ',
      'لا يمكن تحديد مدة الفيديو. الرجاء اختيار فيديو آخر.'
    );
    return;
  }
  
  if (duration < 5) {
    Alert.alert(
      'فيديو قصير جداً',
      'يجب أن تكون مدة الفيديو 5 ثوان على الأقل.'
    );
    return;
  }
  
  if (duration > 60) {
    Alert.alert(
      'فيديو طويل جداً',
      'يجب أن تكون مدة الفيديو 60 ثانية كحد أقصى.'
    );
    return;
  }
  
  // المتابعة برفع الفيديو
  await uploadVideo(videoUri, duration);
}
```

2. **في Backend - التحقق من جانب الخادم**:

```typescript
// في Backend/src/middleware/file-validation.middleware.ts

import { getVideoDurationInSeconds } from 'get-video-duration';

export const validateVideoDuration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const videoFile = req.file;
    
    if (!videoFile) {
      return res.status(400).json({
        error: 'E007',
        message: 'No video file provided',
      });
    }
    
    // استخراج مدة الفيديو
    const duration = await getVideoDurationInSeconds(videoFile.path);
    
    // التحقق من المدة
    if (duration < 5) {
      return res.status(400).json({
        error: 'E007',
        message: 'Video duration must be at least 5 seconds',
        details: { duration, minDuration: 5 },
      });
    }
    
    if (duration > 60) {
      return res.status(400).json({
        error: 'E007',
        message: 'Video duration must not exceed 60 seconds',
        details: { duration, maxDuration: 60 },
      });
    }
    
    // إضافة المدة إلى request للاستخدام في controller
    req.videoDuration = duration;
    
    next();
  } catch (error) {
    logger.error('Error validating video duration:', error);
    return res.status(500).json({
      error: 'E010',
      message: 'Failed to validate video duration',
    });
  }
};
```

**المكتبة المطلوبة للـ Backend**:
```bash
npm install get-video-duration
```


## استراتيجية الاختبار

### نهج التحقق

تتبع استراتيجية الاختبار نهجاً من ثلاث مراحل: أولاً، إظهار الأخطاء على الكود غير المُصلح، ثم التحقق من أن الإصلاح يعمل بشكل صحيح، وأخيراً التحقق من الحفاظ على السلوك الحالي.

### الفحص الاستكشافي لشرط الخطأ

**الهدف**: إظهار الأخطاء قبل تنفيذ الإصلاح. تأكيد أو دحض تحليل السبب الجذري. إذا دحضنا، سنحتاج لإعادة الافتراض.

**خطة الاختبار**: كتابة اختبارات تحاكي السيناريوهات التي تؤدي للأخطاء. تشغيل هذه الاختبارات على الكود غير المُصلح لمراقبة الفشل وفهم السبب الجذري.

**حالات الاختبار**:

1. **اختبار ثغرة بيانات الاعتماد**:
   - محاكاة استدعاء `globalState.login('mahmoud_essam', 'password')` (سيفشل على الكود المُصلح)
   - التحقق من أن الدالة موجودة في الكود (سيفشل على الكود المُصلح)
   - محاكاة فحص Apple للكود (سيجد بيانات الاعتماد على الكود غير المُصلح)

2. **اختبار اكتشاف مدة الفيديو**:
   - محاكاة رفع فيديو مدته 3 ثوان (سيُقبل على الكود غير المُصلح)
   - محاكاة رفع فيديو مدته 120 ثانية (سيُقبل على الكود غير المُصلح)
   - التحقق من أن `extractDurationFromUrl()` ترجع `null` (سيحدث على الكود غير المُصلح)

3. **اختبار إنشاء الصور المصغرة**:
   - محاكاة رفع فيديو وطلب صورة مصغرة (سيرجع `null` على الكود غير المُصلح)
   - التحقق من أن `generateThumbnail()` ترجع `null` (سيحدث على الكود غير المُصلح)

**الأمثلة المضادة المتوقعة**:
- دالة `login()` موجودة وتقبل بيانات الاعتماد المشفرة
- دالة `extractDurationFromUrl()` ترجع `null` دائماً
- دالة `generateThumbnail()` ترجع `null` دائماً
- الأسباب المحتملة: كود تطوير لم يُحذف، عدم توافق SDK 52، مكتبات مفقودة

### فحص الإصلاح

**الهدف**: التحقق من أن جميع المدخلات التي تحقق شرط الخطأ، تنتج السلوك المتوقع بعد الإصلاح.

**الكود الزائف:**
```
FOR ALL input WHERE isBugCondition_HardcodedCredentials(input) DO
  result := globalState_fixed.login(input.username, input.password)
  ASSERT result == undefined OR result == error
  ASSERT globalState.isLoggedIn == false
END FOR

FOR ALL input WHERE isBugCondition_DurationDetection(input) DO
  result := extractDurationFromUrl_fixed(input.videoUri)
  ASSERT result != null
  ASSERT result > 0
  IF result < 5 OR result > 60 THEN
    ASSERT uploadRejected(input.videoUri)
  END IF
END FOR

FOR ALL input WHERE isBugCondition_ThumbnailGeneration(input) DO
  result := generateThumbnail_fixed(input.videoUri)
  ASSERT result != null OR result == placeholderImage
  ASSERT thumbnailDisplayed(result)
END FOR
```

**حالات الاختبار**:

1. **اختبار إزالة ثغرة بيانات الاعتماد**:
   - التحقق من أن دالة `login()` محذوفة أو معطلة
   - محاولة البحث عن بيانات الاعتماد المشفرة في الكود (يجب ألا توجد)
   - التحقق من أن جميع عمليات تسجيل الدخول تستخدم Clerk

2. **اختبار اكتشاف مدة الفيديو**:
   - رفع فيديو مدته 10 ثوان → يجب قبوله وعرض المدة "0:10"
   - رفع فيديو مدته 3 ثوان → يجب رفضه مع رسالة خطأ
   - رفع فيديو مدته 120 ثانية → يجب رفضه مع رسالة خطأ
   - رفع فيديو مدته بالضبط 5 ثوان → يجب قبوله
   - رفع فيديو مدته بالضبط 60 ثانية → يجب قبوله

3. **اختبار إنشاء الصور المصغرة**:
   - رفع فيديو صالح → يجب إنشاء صورة مصغرة
   - عرض قائمة فيديوهات → يجب عرض صور مصغرة لجميع الفيديوهات
   - فشل إنشاء صورة مصغرة → يجب عرض صورة افتراضية
   - التحقق من ضغط الصورة المصغرة (عرض أقصى 720px)


### فحص الحفاظ على السلوك

**الهدف**: التحقق من أن جميع المدخلات التي لا تحقق شرط الخطأ، تنتج نفس النتيجة في الكود المُصلح كما في الكود الأصلي.

**الكود الزائف:**
```
FOR ALL input WHERE NOT isBugCondition_HardcodedCredentials(input) DO
  ASSERT clerkAuthentication_original(input) = clerkAuthentication_fixed(input)
  ASSERT logout_original() = logout_fixed()
  ASSERT loadState_original() = loadState_fixed()
END FOR

FOR ALL input WHERE NOT isBugCondition_DurationDetection(input) DO
  ASSERT formatDuration_original(input) = formatDuration_fixed(input)
  ASSERT shouldShowDuration_original(input) = shouldShowDuration_fixed(input)
  ASSERT videoPlayback_original(input) = videoPlayback_fixed(input)
END FOR

FOR ALL input WHERE NOT isBugCondition_ThumbnailGeneration(input) DO
  ASSERT prepareVideoForUpload_original(input) = prepareVideoForUpload_fixed(input)
  ASSERT uploadWithProgress_original(input) = uploadWithProgress_fixed(input)
  ASSERT shouldCompress_original(input) = shouldCompress_fixed(input)
END FOR
```

**نهج الاختبار**: يُوصى باختبار قائم على الخصائص (Property-Based Testing) للحفاظ على السلوك لأنه:
- يولد العديد من حالات الاختبار تلقائياً عبر نطاق المدخلات
- يكتشف الحالات الحدية التي قد تفوتها اختبارات الوحدة اليدوية
- يوفر ضمانات قوية بأن السلوك لم يتغير لجميع المدخلات غير المتأثرة بالخطأ

**خطة الاختبار**: مراقبة السلوك على الكود غير المُصلح أولاً للعمليات غير المتأثرة، ثم كتابة اختبارات قائمة على الخصائص تلتقط هذا السلوك.

**حالات الاختبار**:

1. **الحفاظ على وظائف المصادقة**:
   - مراقبة أن تسجيل الدخول عبر Clerk يعمل بشكل صحيح على الكود غير المُصلح
   - كتابة اختبار للتحقق من أن هذا يستمر بعد الإصلاح
   - مراقبة أن تسجيل الخروج يمسح جميع البيانات على الكود غير المُصلح
   - كتابة اختبار للتحقق من أن هذا يستمر بعد الإصلاح
   - مراقبة أن `loadState()` يستعيد الحالة الصالحة على الكود غير المُصلح
   - كتابة اختبار للتحقق من أن هذا يستمر بعد الإصلاح

2. **الحفاظ على وظائف عرض الفيديو**:
   - مراقبة أن `formatDuration(30)` يرجع "0:30" على الكود غير المُصلح
   - كتابة اختبار للتحقق من أن هذا يستمر بعد الإصلاح
   - مراقبة أن `shouldShowDuration(0)` يرجع `false` على الكود غير المُصلح
   - كتابة اختبار للتحقق من أن هذا يستمر بعد الإصلاح
   - مراقبة أن تشغيل الفيديو يعمل بشكل صحيح على الكود غير المُصلح
   - كتابة اختبار للتحقق من أن هذا يستمر بعد الإصلاح

3. **الحفاظ على وظائف رفع الفيديو**:
   - مراقبة أن `prepareVideoForUpload()` يرجع معلومات الفيديو على الكود غير المُصلح
   - كتابة اختبار للتحقق من أن هذا يستمر بعد الإصلاح
   - مراقبة أن `uploadWithProgress()` يتتبع التقدم على الكود غير المُصلح
   - كتابة اختبار للتحقق من أن هذا يستمر بعد الإصلاح
   - مراقبة أن `shouldCompress(3000000)` يرجع `true` على الكود غير المُصلح
   - كتابة اختبار للتحقق من أن هذا يستمر بعد الإصلاح

### اختبارات الوحدة

**اختبارات ثغرة بيانات الاعتماد**:
- اختبار أن دالة `login()` غير موجودة في الكود المُصلح
- اختبار أن البحث عن 'mahmoud_essam' و 'password' لا يجد نتائج
- اختبار أن `setUserType()` لا تضبط username تلقائياً
- اختبار أن `loadState()` تتحقق من صلاحية جلسة Clerk

**اختبارات اكتشاف مدة الفيديو**:
- اختبار `extractDurationFromUrl()` مع فيديو صالح → يجب إرجاع مدة صحيحة
- اختبار `extractDurationFromUrl()` مع URL غير صالح → يجب إرجاع `null`
- اختبار `formatDuration(30)` → يجب إرجاع "0:30"
- اختبار `formatDuration(125)` → يجب إرجاع "2:05"
- اختبار `shouldShowDuration(null)` → يجب إرجاع `false`
- اختبار `shouldShowDuration(0)` → يجب إرجاع `false`
- اختبار `shouldShowDuration(30)` → يجب إرجاع `true`

**اختبارات إنشاء الصور المصغرة**:
- اختبار `generateThumbnail()` مع فيديو صالح → يجب إرجاع URI صورة
- اختبار `generateThumbnail()` مع فيديو غير صالح → يجب إرجاع `null`
- اختبار `compressThumbnail()` → يجب تقليل حجم الصورة
- اختبار أن عرض الصورة المضغوطة لا يتجاوز 720px


### اختبارات قائمة على الخصائص (Property-Based Tests)

**اختبار الخاصية 1: عدم وجود بيانات اعتماد مشفرة**
```typescript
import fc from 'fast-check';

test('Property 1: No hardcoded credentials in codebase', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('mahmoud_essam', 'password', 'login'),
      (searchTerm) => {
        // البحث في جميع ملفات الكود
        const codeFiles = getAllCodeFiles();
        const results = searchInFiles(codeFiles, searchTerm);
        
        // يجب ألا توجد بيانات الاعتماد المشفرة
        // (باستثناء ملفات الاختبار التي تختبر عدم وجودها)
        const nonTestResults = results.filter(r => !r.path.includes('__tests__'));
        return nonTestResults.length === 0;
      }
    )
  );
});
```

**اختبار الخاصية 2: اكتشاف مدة الفيديو يعمل**
```typescript
test('Property 2: Video duration detection works for valid videos', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 5, max: 60 }), // مدة صالحة بالثواني
      async (expectedDuration) => {
        // إنشاء فيديو اختبار بالمدة المحددة
        const videoUri = await createTestVideo(expectedDuration);
        
        // استخراج المدة
        const detectedDuration = await extractDurationFromUrl(videoUri);
        
        // يجب أن تكون المدة المكتشفة قريبة من المدة المتوقعة (±1 ثانية)
        return detectedDuration !== null && 
               Math.abs(detectedDuration - expectedDuration) <= 1;
      }
    )
  );
});
```

**اختبار الخاصية 3: رفض الفيديوهات غير الصالحة**
```typescript
test('Property 3: Invalid duration videos are rejected', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.oneof(
        fc.integer({ min: 0, max: 4 }),    // قصير جداً
        fc.integer({ min: 61, max: 300 })  // طويل جداً
      ),
      async (invalidDuration) => {
        const videoUri = await createTestVideo(invalidDuration);
        const duration = await extractDurationFromUrl(videoUri);
        
        // يجب رفض الفيديو
        const isRejected = await validateVideoUpload(videoUri, duration);
        return isRejected === false;
      }
    )
  );
});
```

**اختبار الخاصية 4: إنشاء الصور المصغرة يعمل**
```typescript
test('Property 4: Thumbnail generation works for valid videos', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 5, max: 60 }),
      async (duration) => {
        const videoUri = await createTestVideo(duration);
        const thumbnailUri = await generateThumbnail(videoUri);
        
        // يجب إنشاء صورة مصغرة صالحة
        return thumbnailUri !== null && await fileExists(thumbnailUri);
      }
    )
  );
});
```

**اختبار الخاصية 5: الحفاظ على تنسيق المدة**
```typescript
test('Property 5: Duration formatting is preserved', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 3599 }), // أقل من ساعة
      (seconds) => {
        const formatted = formatDuration(seconds);
        
        if (seconds === 0) {
          // المدة صفر يجب أن ترجع null
          return formatted === null;
        }
        
        // يجب أن يكون التنسيق MM:SS
        const parsed = parseDuration(formatted);
        return parsed === seconds;
      }
    )
  );
});
```

**اختبار الخاصية 6: الحفاظ على وظائف الرفع**
```typescript
test('Property 6: Upload functions are preserved', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1000000, max: 10000000 }), // حجم الملف بالبايت
      async (fileSize) => {
        const videoUri = await createTestVideoWithSize(fileSize);
        
        // يجب أن تعمل وظائف الرفع كما كانت
        const shouldCompressResult = shouldCompress(fileSize);
        const expectedResult = fileSize > 2 * 1024 * 1024;
        
        return shouldCompressResult === expectedResult;
      }
    )
  );
});
```

### اختبارات التكامل

**اختبار التكامل 1: تدفق رفع الفيديو الكامل**
```typescript
test('Integration: Full video upload flow with duration validation', async () => {
  // 1. اختيار فيديو
  const videoUri = await pickVideo();
  
  // 2. استخراج المدة
  const duration = await extractDurationFromUrl(videoUri);
  expect(duration).not.toBeNull();
  
  // 3. التحقق من المدة
  expect(duration).toBeGreaterThanOrEqual(5);
  expect(duration).toBeLessThanOrEqual(60);
  
  // 4. إنشاء صورة مصغرة
  const thumbnail = await generateThumbnail(videoUri);
  expect(thumbnail).not.toBeNull();
  
  // 5. ضغط الصورة المصغرة
  const compressedThumbnail = await compressThumbnail(thumbnail);
  expect(compressedThumbnail).toBeDefined();
  
  // 6. رفع الفيديو
  const result = await uploadVideo(videoUri, duration, compressedThumbnail);
  expect(result.success).toBe(true);
});
```

**اختبار التكامل 2: تدفق المصادقة بدون ثغرات**
```typescript
test('Integration: Authentication flow without hardcoded credentials', async () => {
  // 1. محاولة تسجيل الدخول بدون Clerk (يجب أن تفشل)
  expect(globalState.login).toBeUndefined();
  
  // 2. تسجيل الدخول عبر Clerk
  await signInWithClerk('test@example.com', 'validPassword');
  
  // 3. التحقق من حالة المستخدم
  expect(globalState.isLoggedIn).toBe(true);
  expect(globalState.username).not.toBe('mahmoud_essam');
  
  // 4. تسجيل الخروج
  await globalState.logout();
  
  // 5. التحقق من مسح الحالة
  expect(globalState.isLoggedIn).toBe(false);
  expect(globalState.userProfile).toBeNull();
});
```

**اختبار التكامل 3: عرض الفيديوهات مع الصور المصغرة**
```typescript
test('Integration: Video display with thumbnails', async () => {
  // 1. تحميل قائمة الفيديوهات
  const videos = await fetchVideos();
  
  // 2. التحقق من وجود صور مصغرة
  for (const video of videos) {
    expect(video.thumbnailUri).toBeDefined();
    expect(video.thumbnailUri).not.toBeNull();
    
    // 3. التحقق من عرض المدة
    if (video.duration && video.duration > 0) {
      const formatted = formatDuration(video.duration);
      expect(formatted).toMatch(/^\d+:\d{2}$/);
    }
  }
  
  // 4. عرض الفيديوهات في الشبكة
  const rendered = renderVideoGrid(videos);
  expect(rendered).toBeDefined();
});
```


## ملخص الملفات المتأثرة

### ملفات Frontend تحتاج للتعديل

1. **`front/globalState.ts`** (أولوية عالية - أمان)
   - حذف دالة `login()` (السطور 112-122)
   - تحديث `setUserType()` لإزالة المنطق المشفر
   - تحديث `loadState()` للتحقق من Clerk
   - البحث عن استدعاءات `globalState.login()` وإزالتها

2. **`front/utils/videoDuration.ts`** (أولوية عالية - وظيفة)
   - تحديث `extractDurationFromUrl()` لاستخدام `expo-av`
   - إضافة معالجة الأخطاء وتحرير الموارد
   - الحفاظ على جميع الدوال الأخرى دون تغيير

3. **`front/utils/videoCompressor.ts`** (أولوية عالية - وظيفة)
   - تحديث `generateThumbnail()` لاستخدام `expo-video-thumbnails`
   - تحديث `compressThumbnail()` لاستخدام `expo-image-manipulator`
   - الحفاظ على جميع الدوال الأخرى دون تغيير

4. **`front/components/reels/CreateReelScreen.tsx`** (أو الملف المسؤول عن رفع الفيديو)
   - إضافة التحقق من مدة الفيديو قبل الرفع
   - عرض رسائل خطأ واضحة للمستخدم
   - التحقق من نجاح إنشاء الصورة المصغرة

### ملفات Backend تحتاج للتعديل

5. **`Backend/src/middleware/file-validation.middleware.ts`**
   - إضافة `validateVideoDuration` middleware
   - التحقق من مدة الفيديو على جانب الخادم
   - إرجاع أخطاء واضحة مع رموز E007

6. **`Backend/src/routes/upload.routes.ts`**
   - إضافة `validateVideoDuration` middleware إلى route الرفع
   - التأكد من تطبيق التحقق قبل معالجة الملف

### ملفات الاختبار الجديدة

7. **`front/__tests__/globalState.security.test.ts`** (جديد)
   - اختبارات للتحقق من عدم وجود بيانات اعتماد مشفرة
   - اختبارات للتحقق من أن المصادقة تستخدم Clerk فقط

8. **`front/__tests__/videoDuration.test.ts`** (جديد)
   - اختبارات وحدة لـ `extractDurationFromUrl()`
   - اختبارات خصائص لتنسيق المدة
   - اختبارات تكامل لتدفق رفع الفيديو

9. **`front/__tests__/videoCompressor.test.ts`** (جديد)
   - اختبارات وحدة لـ `generateThumbnail()`
   - اختبارات لضغط الصور المصغرة
   - اختبارات تكامل لعرض الفيديوهات

10. **`Backend/__tests__/file-validation.test.ts`** (جديد)
    - اختبارات للتحقق من مدة الفيديو على الخادم
    - اختبارات لرفض الفيديوهات غير الصالحة

## المكتبات والتبعيات الجديدة

### Frontend Dependencies

```json
{
  "expo-video-thumbnails": "^8.0.0",
  "expo-image-manipulator": "^12.0.0"
}
```

**أوامر التثبيت**:
```bash
cd front
npx expo install expo-video-thumbnails expo-image-manipulator
```

**ملاحظة**: إذا لم يعمل `expo-video-thumbnails` مع SDK 52، استخدم البديل:
```bash
npx expo install expo-video
```

### Backend Dependencies

```json
{
  "get-video-duration": "^4.1.0"
}
```

**أوامر التثبيت**:
```bash
cd Backend
npm install get-video-duration
```

## خطة التنفيذ المقترحة

### المرحلة 1: إصلاح الثغرة الأمنية (أولوية قصوى)
1. حذف دالة `login()` من `globalState.ts`
2. البحث عن جميع استدعاءات `globalState.login()` وإزالتها
3. تحديث `setUserType()` و `loadState()`
4. كتابة اختبارات للتحقق من عدم وجود بيانات مشفرة
5. مراجعة الكود للتأكد من عدم وجود ثغرات أخرى

### المرحلة 2: إصلاح اكتشاف مدة الفيديو
1. تحديث `extractDurationFromUrl()` لاستخدام `expo-av`
2. إضافة التحقق من المدة في Frontend
3. إضافة التحقق من المدة في Backend
4. كتابة اختبارات وحدة وتكامل
5. اختبار على أجهزة حقيقية (iOS و Android)

### المرحلة 3: إصلاح إنشاء الصور المصغرة
1. تثبيت `expo-video-thumbnails` و `expo-image-manipulator`
2. تحديث `generateThumbnail()` و `compressThumbnail()`
3. اختبار إنشاء الصور المصغرة على أجهزة حقيقية
4. إضافة معالجة الأخطاء وصورة افتراضية
5. كتابة اختبارات وحدة وتكامل

### المرحلة 4: الاختبار الشامل
1. تشغيل جميع اختبارات الوحدة
2. تشغيل اختبارات الخصائص (Property-Based Tests)
3. تشغيل اختبارات التكامل
4. اختبار يدوي على iOS و Android
5. مراجعة الكود النهائي

### المرحلة 5: التوثيق والنشر
1. تحديث التوثيق
2. إنشاء changelog
3. إرسال التطبيق لمراجعة Apple
4. مراقبة الأخطاء بعد النشر

## معايير النجاح

### معايير الأمان
- ✅ لا توجد بيانات اعتماد مشفرة في الكود
- ✅ جميع عمليات المصادقة تستخدم Clerk
- ✅ لا توجد طرق لتجاوز نظام المصادقة

### معايير الوظيفة
- ✅ اكتشاف مدة الفيديو يعمل بنسبة 100% للفيديوهات الصالحة
- ✅ رفض الفيديوهات أقل من 5 ثوان أو أكثر من 60 ثانية
- ✅ إنشاء صور مصغرة يعمل بنسبة 95%+ (مع صورة افتراضية للفشل)
- ✅ عرض المدة بتنسيق MM:SS صحيح

### معايير الحفاظ على السلوك
- ✅ جميع وظائف المصادقة الحالية تعمل بشكل طبيعي
- ✅ جميع وظائف عرض الفيديو تعمل بشكل طبيعي
- ✅ جميع وظائف رفع الفيديو تعمل بشكل طبيعي
- ✅ لا توجد انحدارات في الأداء

### معايير الاختبار
- ✅ تغطية اختبارات 90%+ للكود المُعدل
- ✅ جميع اختبارات الوحدة تنجح
- ✅ جميع اختبارات الخصائص تنجح
- ✅ جميع اختبارات التكامل تنجح

### معايير مراجعة Apple
- ✅ لا توجد ثغرات أمنية
- ✅ جميع الوظائف تعمل كما هو متوقع
- ✅ تجربة المستخدم ممتازة
- ✅ الامتثال لجميع إرشادات App Store

## المخاطر والتخفيف

### خطر 1: expo-video-thumbnails لا يعمل مع SDK 52
**التخفيف**: استخدام `expo-video` كبديل، أو إنشاء الصور المصغرة على الخادم

### خطر 2: expo-av لا يستخرج المدة من بعض الفيديوهات
**التخفيف**: استخدام `react-native-video` أو FFmpeg كبديل

### خطر 3: وجود استدعاءات لـ login() في أماكن غير متوقعة
**التخفيف**: البحث الشامل في جميع الملفات قبل الحذف

### خطر 4: انحدار في وظائف موجودة
**التخفيف**: اختبارات شاملة للحفاظ على السلوك

### خطر 5: مشاكل في الأداء بسبب استخراج المدة
**التخفيف**: تخزين المدة مؤقتاً، معالجة غير متزامنة

## الخلاصة

هذا التصميم يوفر حلاً شاملاً لثلاث مشاكل حرجة تمنع الموافقة على التطبيق من قبل Apple:

1. **الأمان**: إزالة كاملة لثغرة بيانات الاعتماد المشفرة
2. **الوظيفة**: تفعيل اكتشاف مدة الفيديو باستخدام `expo-av`
3. **تجربة المستخدم**: تفعيل إنشاء الصور المصغرة باستخدام `expo-video-thumbnails`

الحل مصمم ليكون:
- **آمن**: لا توجد ثغرات أمنية
- **موثوق**: اختبارات شاملة تضمن الجودة
- **قابل للصيانة**: كود نظيف وموثق جيداً
- **متوافق**: يعمل مع Expo SDK 52
- **محافظ**: لا يؤثر على الوظائف الموجودة

بعد تنفيذ هذا التصميم، يجب أن يكون التطبيق جاهزاً للموافقة من قبل Apple.
