# 🔐 إعداد Google & Apple OAuth مع Lucia

## ✅ تم إكمال الإعداد بنجاح!

### 📋 ما تم إنجازه:

#### 1. Google OAuth مع Lucia
- ✅ تحديث `googleCallback` لاستخدام Lucia sessions بدلاً من JWT
- ✅ إنشاء session cookie تلقائياً بعد Google OAuth
- ✅ دعم Mobile deep linking
- ✅ Route: `GET /api/auth/google` و `GET /api/auth/google/callback`

#### 2. Apple OAuth مع Lucia
- ✅ إضافة `appleAuth` method في AuthController
- ✅ استقبال Apple identity token من Frontend
- ✅ إنشاء/تسجيل دخول مستخدم وإنشاء Lucia session
- ✅ Route: `POST /api/auth/apple`

#### 3. Frontend Updates
- ✅ تحديث `auth.service.ts` لاستخدام cookies بدلاً من tokens
- ✅ إضافة `appleSignIn()` method
- ✅ إضافة `handleAppleAuth()` في `auth.tsx`
- ✅ تحديث Google OAuth callback handler
- ✅ دعم session cookies مع `credentials: 'include'`

---

## 🚀 كيفية الاستخدام

### Google OAuth

**Frontend:**
```typescript
const handleGoogleAuth = async () => {
  const googleAuthUrl = authService.getGoogleAuthUrl();
  await Linking.openURL(googleAuthUrl);
  // بعد الـ redirect، session cookie يتم تعيينه تلقائياً
  // ثم يتم استدعاء handleAuthSuccess
};
```

**Backend Flow:**
1. المستخدم يضغط على Google button
2. يتم redirect إلى Google OAuth
3. بعد الموافقة، Google يعيد redirect إلى `/api/auth/google/callback`
4. Backend ينشئ/يجد المستخدم
5. Backend ينشئ Lucia session
6. Backend يعيد redirect إلى Frontend مع session cookie

---

### Apple OAuth

**Frontend:**
```typescript
import * as AppleAuthentication from 'expo-apple-authentication';

const handleAppleAuth = async () => {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const response = await authService.appleSignIn(
    credential.identityToken,
    credential.email || '',
    credential.fullName || undefined
  );
  
  // Session cookie يتم تعيينه تلقائياً
  const userData = await authService.getCurrentUser();
  await handleAuthSuccess(userData);
};
```

**Backend Flow:**
1. Frontend يطلب Apple Sign In
2. Frontend يرسل `identityToken` و `email` للـ Backend
3. Backend ينشئ/يجد المستخدم
4. Backend ينشئ Lucia session
5. Backend يعيد session cookie في response

---

## 📝 ملاحظات مهمة

### Session Cookies
- ✅ يتم إرسال session cookie تلقائياً في `Set-Cookie` header
- ✅ Frontend يجب أن يستخدم `credentials: 'include'` في fetch requests
- ✅ Cookies تعمل تلقائياً في React Native مع `credentials: 'include'`

### CSRF Protection
- ✅ Backend يتخطى CSRF check للـ mobile apps
- ✅ Frontend يرسل header `x-mobile-app: true`

### Apple Authentication
- ⚠️ يتطلب تثبيت: `npm install expo-apple-authentication`
- ⚠️ متاح فقط على iOS
- ⚠️ يجب إعداد Apple Developer account

---

## 🔧 التثبيت

### Backend
```bash
cd Backend
npm install
```

### Frontend
```bash
cd front
npm install expo-apple-authentication
```

---

## ✅ الحالة الحالية

- ✅ Google OAuth مع Lucia - جاهز
- ✅ Apple OAuth مع Lucia - جاهز
- ✅ Session cookies - تعمل تلقائياً
- ✅ Mobile deep linking - مدعوم
- ✅ CSRF protection - محسّن للـ mobile

**كل شيء جاهز للاستخدام! 🎉**

