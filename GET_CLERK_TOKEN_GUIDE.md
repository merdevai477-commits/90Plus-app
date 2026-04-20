# 🔑 دليل الحصول على Clerk Token للاختبار في Postman

## 📱 الطريقة الأسهل: استخدام Debug Screen

### الخطوة 1: افتح Debug Screen

تم إنشاء صفحة خاصة لاستخراج الـ token في:
```
front/app/debug-token.tsx
```

**للوصول إليها:**

#### الطريقة أ: من Settings Screen
أضف هذا الكود في `front/app/(tabs)/settings.tsx`:

```typescript
import { router } from 'expo-router';

// داخل الـ component
{__DEV__ && (
  <TouchableOpacity
    onPress={() => router.push('/debug-token')}
    style={{
      padding: 15,
      backgroundColor: '#007AFF',
      borderRadius: 8,
      margin: 20,
    }}
  >
    <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
      🔑 Get API Token for Testing
    </Text>
  </TouchableOpacity>
)}
```

#### الطريقة ب: من أي مكان في التطبيق
```typescript
import { router } from 'expo-router';

// في أي event handler
router.push('/debug-token');
```

---

### الخطوة 2: استخدم Debug Screen

1. **افتح الصفحة** `/debug-token`
2. **اضغط "Get & Copy Token"**
3. **الـ token سيُنسخ تلقائياً** للـ clipboard
4. **رسالة تأكيد** ستظهر مع التعليمات

---

### الخطوة 3: استخدم Token في Postman

1. **افتح Postman**
2. **اذهب إلى Environments** (أيقونة العين في الأعلى)
3. **اختر "90Plus Production"**
4. **ابحث عن `clerk_token`**
5. **الصق الـ token** في خانة **Current Value**
6. **احفظ** (Save)
7. **ابدأ الاختبار!** 🚀

---

## 🔄 طرق بديلة

### الطريقة 1: Console Logger

أضف هذا في أي screen بعد تسجيل الدخول:

```typescript
import { useClerkTokenLogger } from '../scripts/get-clerk-token';

function MyScreen() {
  useClerkTokenLogger(); // سيطبع الـ token في console
  
  return (
    // Your screen content
  );
}
```

**ثم:**
1. افتح React Native Debugger
2. شاهد Console
3. انسخ الـ token

---

### الطريقة 2: Component مباشر

```typescript
import { ClerkTokenExtractor } from '../scripts/get-clerk-token';

function MyScreen() {
  return (
    <View>
      {/* Your content */}
      
      {__DEV__ && <ClerkTokenExtractor />}
    </View>
  );
}
```

---

### الطريقة 3: Manual من useAuth

```typescript
import { useAuth } from '@clerk/clerk-expo';
import { useEffect } from 'react';

function MyScreen() {
  const { getToken } = useAuth();
  
  useEffect(() => {
    getToken().then(token => {
      console.log('🔑 CLERK TOKEN:');
      console.log(token);
    });
  }, []);
  
  return (
    // Your screen
  );
}
```

---

## ⚡ Quick Test

بعد الحصول على الـ token، اختبر أول endpoint:

### في Postman:

1. **اختر Collection:** "90Plus Reels API"
2. **اختر Environment:** "90Plus Production"
3. **افتح Request:** "1. Get Reels Feed"
4. **اضغط Send**
5. **شاهد النتائج!** ✅

إذا حصلت على:
- ✅ **200 OK** → الـ token شغال!
- ❌ **401 Unauthorized** → الـ token خطأ أو منتهي
- ❌ **404 Not Found** → تحقق من الـ URL

---

## 🔒 ملاحظات أمان

⚠️ **مهم:**
- الـ token **ينتهي بعد ساعة** (Clerk default)
- **لا تشارك** الـ token مع أحد
- **لا تحفظه** في Git
- **استخدمه فقط** للتطبيق المحلي/Development
- **احذف الـ debug screen** قبل Production build

---

## 🐛 حل المشاكل

### المشكلة: Token لا يظهر
**الحل:**
- تأكد من تسجيل الدخول
- تأكد من `isSignedIn === true`
- جرب Sign Out ثم Sign In مرة أخرى

### المشكلة: 401 Unauthorized في Postman
**الحل:**
- الـ token منتهي (expired)
- احصل على token جديد من Debug Screen
- تأكد من نسخ الـ token كامل

### المشكلة: Copy لا يعمل
**الحل:**
- تحقق من Clipboard permissions
- استخدم Console Logger بدلاً منه
- انسخ يدوياً من Console

---

## 📊 Token Lifecycle

```
1. User Signs In
   ↓
2. Clerk Issues Token (valid for 1 hour)
   ↓
3. Token Used in API Requests
   ↓
4. Token Expires (401 error)
   ↓
5. Get New Token (repeat from step 2)
```

---

## ✅ Checklist

قبل البدء في الاختبار:

- [ ] تسجيل دخول في التطبيق
- [ ] فتح Debug Screen (`/debug-token`)
- [ ] نسخ الـ token
- [ ] فتح Postman
- [ ] اختيار Environment "90Plus Production"
- [ ] لصق الـ token في `clerk_token`
- [ ] حفظ Environment
- [ ] اختبار أول request

---

## 🎯 الخطوات التالية

بعد الحصول على الـ token:

1. ✅ اختبر "Get Reels Feed" أولاً
2. ✅ سيتم حفظ `test_reel_id` تلقائياً
3. ✅ اختبر باقي الـ endpoints
4. ✅ شغل الـ Collection كاملة
5. ✅ راجع Test Results

---

**Happy Testing! 🚀**

للمزيد من التفاصيل، راجع:
- `POSTMAN_TESTING.md` - دليل اختبار Postman الكامل
- `front/scripts/README.md` - توثيق الـ scripts
