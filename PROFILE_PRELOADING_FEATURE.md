# ميزة Preloading للبروفايل في الخلفية

## الهدف
تحميل بيانات البروفايل في الخلفية عند فتح الـ Home screen، بحيث عندما يدخل المستخدم على البروفايل يجده محمل فورًا بدون انتظار.

## كيف تعمل الميزة

### 1. التحميل في الخلفية (Background Preloading)
عند فتح الـ Home screen، يتم تحميل البيانات التالية في الخلفية بشكل غير متزامن:

- **Profile Completion Status** - حالة إكمال المهمات (للبادج)
- **Full User Profile Data** - بيانات البروفايل الكاملة (الاسم، الصورة، البيو، إلخ)

### 2. التخزين في الـ Cache
البيانات المحملة يتم حفظها في الـ cache مع TTL = 5 دقائق:

```typescript
// Profile completion status
CACHE_KEYS.PROFILE_COMPLETION → 5 minutes

// Full profile data
CACHE_KEYS.PROFILE_DATA → 5 minutes
```

### 3. الاستخدام الفوري
عندما يفتح المستخدم البروفايل:
1. الـ `useProfileCache` hook يقرأ البيانات من الـ cache فورًا
2. يعرض البيانات المحفوظة بدون انتظار
3. يحمل بيانات جديدة في الخلفية ويحدث الـ UI

## التغييرات المطبقة

### الملف: `front/app/(tabs)/Home.tsx`

#### 1. إضافة Imports
```typescript
import { ProfileCompletionService } from '../../services/profileCompletion.service';
import { cacheService, CACHE_KEYS } from '../../services/cacheService';
```

#### 2. إضافة Function للـ Preload
```typescript
const preloadProfileData = useCallback(async () => {
  try {
    const token = await getToken();
    if (!token || !isSignedIn) return;

    // Preload profile completion status (for tasks badge)
    ProfileCompletionService.getCompletionStatus(token)
      .then(status => {
        if (status) {
          cacheService.set(CACHE_KEYS.PROFILE_COMPLETION, status, 5 * 60 * 1000);
          logger.info('✅ Profile completion preloaded in background');
        }
      })
      .catch(err => {
        logger.debug('Profile completion preload failed (non-critical):', err.message);
      });

    // Preload full user profile data (for profile screen)
    fetch(`${API_URL}/clerk/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async response => {
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'SUCCESS' && data.data?.user) {
            await cacheService.set(CACHE_KEYS.PROFILE_DATA, data.data.user, 5 * 60 * 1000);
            logger.info('✅ Full profile data preloaded in background');
          }
        }
      })
      .catch(err => {
        logger.debug('Profile data preload failed (non-critical):', err.message);
      });

  } catch (error) {
    logger.debug('Profile preload error (non-critical):', error);
  }
}, [getToken, isSignedIn]);
```

#### 3. إضافة Ref للـ Preload Function
```typescript
const preloadProfileDataRef = useRef(preloadProfileData);

useEffect(() => {
  // ... other refs
  preloadProfileDataRef.current = preloadProfileData;
}, [/* ... */, preloadProfileData]);
```

#### 4. استدعاء الـ Preload في useFocusEffect
```typescript
useFocusEffect(
  useCallback(() => {
    // ... load critical and secondary data
    
    // ✅ Preload profile data in background for instant profile screen access
    preloadProfileDataRef.current().catch(() => {
      // Silent fail - preloading is not critical
    });
  }, [])
);
```

## المزايا

### 1. تجربة مستخدم أفضل
- ✅ البروفايل يفتح فورًا بدون loading
- ✅ البيانات محدثة دائمًا (refresh في الخلفية)
- ✅ لا يوجد تأخير ملحوظ

### 2. أداء محسّن
- ✅ التحميل يحدث في الخلفية (non-blocking)
- ✅ لا يؤثر على سرعة الـ Home screen
- ✅ استخدام ذكي للـ cache

### 3. موثوقية عالية
- ✅ Silent fail - الأخطاء لا تؤثر على التطبيق
- ✅ Fallback للبيانات القديمة إذا فشل التحميل
- ✅ Retry mechanism في الـ useProfileCache

## سيناريوهات الاستخدام

### السيناريو 1: مستخدم جديد (أول مرة)
1. يفتح الـ Home screen
2. يتم تحميل البروفايل في الخلفية
3. يضغط على البروفايل
4. يجد البيانات محملة فورًا ✅

### السيناريو 2: مستخدم عائد (Cache موجود)
1. يفتح الـ Home screen
2. يتم تحديث الـ cache في الخلفية
3. يضغط على البروفايل
4. يجد البيانات المحدثة فورًا ✅

### السيناريو 3: مشكلة في الشبكة
1. يفتح الـ Home screen
2. فشل التحميل في الخلفية (silent fail)
3. يضغط على البروفايل
4. يجد البيانات القديمة من الـ cache ✅
5. يتم المحاولة مرة أخرى في الخلفية

## الاختبار

### خطوات الاختبار:
1. افتح التطبيق وسجل دخول
2. انتظر 2-3 ثواني على الـ Home screen
3. افتح الـ Console وشوف الـ logs:
   ```
   ✅ Profile completion preloaded in background
   ✅ Full profile data preloaded in background
   ```
4. اضغط على البروفايل
5. يجب أن يفتح فورًا بدون loading spinner

### النتيجة المتوقعة:
- ✅ البروفايل يفتح فورًا (< 100ms)
- ✅ البيانات معروضة بالكامل
- ✅ لا يوجد loading state ملحوظ
- ✅ الصورة والاسم والبيو كلها موجودة

## الملاحظات الفنية

### 1. Non-Blocking Design
الـ preloading يحدث بشكل كامل في الخلفية ولا يؤثر على:
- سرعة تحميل الـ Home screen
- استجابة الـ UI
- تجربة المستخدم

### 2. Silent Fail Strategy
جميع الأخطاء يتم التعامل معها بشكل silent:
```typescript
.catch(err => {
  logger.debug('Profile preload failed (non-critical):', err.message);
});
```

### 3. Cache Strategy
- TTL = 5 minutes (قابل للتعديل)
- Auto-refresh في الخلفية
- Fallback للبيانات القديمة

### 4. Memory Efficiency
- البيانات يتم تخزينها في AsyncStorage (persistent)
- Auto-cleanup للبيانات القديمة
- لا يوجد memory leaks

## التكامل مع الميزات الموجودة

### 1. useProfileCache Hook
الـ hook يستخدم الـ cache تلقائيًا:
```typescript
// Load from cache first
const hasCachedData = await loadFromCache();

// Then fetch fresh data in background
await fetchFreshData();
```

### 2. Profile Completion Badge
البادج يستخدم البيانات المحملة مسبقًا:
```typescript
const status = await cacheService.get(CACHE_KEYS.PROFILE_COMPLETION);
```

### 3. Profile Screen
الشاشة تعرض البيانات فورًا من الـ cache:
```typescript
const { userData, isLoading } = useProfileCache({
  getToken,
  clerkUserId,
});
// isLoading = false (data from cache)
```

## الخطوات التالية

1. ✅ تم تطبيق الميزة
2. ⏳ اختبار على بيئة التطوير
3. ⏳ مراقبة الـ performance metrics
4. ⏳ Deploy على Production

## الأوامر للـ Commit

```bash
cd front
git add app/(tabs)/Home.tsx
git commit -m "feat: add profile preloading in background for instant access"
git push origin main
```

---

**تاريخ التطبيق:** 2026-03-14  
**المطور:** Kiro AI Assistant  
**الحالة:** ✅ جاهز للاختبار
