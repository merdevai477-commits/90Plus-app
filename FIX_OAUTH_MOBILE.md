# 🔧 إصلاح Google OAuth للموبايل

## المشكلة:
OAuth بيرجع على `localhost:8081` بدل ما يرجع على التطبيق!

## الحل:

### 1️⃣ تحديث Backend/.env

```env
# عناوين الفرونت
FRONTEND_URL=http://localhost:8081
MOBILE_FRONTEND_URL=footballproapp://

# مسارات الرجوع بعد الأوث
OAUTH_SUCCESS_REDIRECT=auth/success
OAUTH_ERROR_REDIRECT=auth/error

# Google OAuth Callback
GOOGLE_CALLBACK_URL=http://192.168.1.7:3000/api/auth/google/callback
```

**ملاحظة:** استخدمنا `footballproapp://` (custom scheme) بدل `exp://`

---

### 2️⃣ تحديث Google Cloud Console

أضف Authorized redirect URIs:

```
http://192.168.1.7:3000/api/auth/google/callback
http://localhost:3000/api/auth/google/callback
```

---

### 3️⃣ تأكد من app.json

في `front/app.json`:

```json
{
  "expo": {
    "scheme": "footballproapp",
    "extra": {
      "apiUrl": "http://192.168.1.7:3000/api"
    }
  }
}
```

---

### 4️⃣ أعد تشغيل Backend

```powershell
cd Backend
npm run dev
```

---

### 5️⃣ أعد تشغيل Frontend

```powershell
cd front
npx expo start --tunnel
# أو
npm start
# ثم اضغط 't' للـ tunnel
```

---

## ✅ كيف يعمل الآن:

1. المستخدم يضغط "Sign in with Google"
2. يفتح Google OAuth في المتصفح
3. بعد التسجيل، Google يرجع على: `http://192.168.1.7:3000/api/auth/google/callback`
4. Backend يعمل redirect على: `footballproapp://auth/success?session=...`
5. التطبيق يفتح تلقائياً ويستقبل الـ session token
6. يتم تسجيل الدخول بنجاح! 🎉

---

## 🆘 إذا لم يعمل:

### 1. تأكد من Custom Scheme
```powershell
# في front/app.json
"scheme": "footballproapp"
```

### 2. تأكد من Backend URL
```powershell
# في Backend/.env
GOOGLE_CALLBACK_URL=http://192.168.1.7:3000/api/auth/google/callback
MOBILE_FRONTEND_URL=footballproapp://
```

### 3. تأكد من Google Console
- Authorized redirect URIs يحتوي على `192.168.1.7:3000`

### 4. أعد تشغيل كل شيء
```powershell
# Backend
cd Backend
npm run dev

# Frontend (نافذة أخرى)
cd front
npx expo start --clear --tunnel
```

---

## 💡 نصائح:

### استخدام exp:// بدلاً من custom scheme:
إذا أردت استخدام `exp://` بدلاً من `footballproapp://`:

```env
MOBILE_FRONTEND_URL=exp://192.168.1.7:8081
OAUTH_SUCCESS_REDIRECT=--/auth/success
```

لكن `footballproapp://` أفضل لأنه:
- ✅ يعمل مع Expo Go و Standalone apps
- ✅ أسهل في الـ deep linking
- ✅ لا يحتاج `--` في الـ path

---

## 📊 Debugging:

### شوف الـ logs في Backend:
```
✅ Google OAuth - Session created: xxx
✅ User ID: xxx
✅ Username: xxx
🔄 Redirecting to: footballproapp://auth/success?session=xxx
```

### شوف الـ logs في Frontend:
```
🔗 DEEP LINK RECEIVED: footballproapp://auth/success?session=xxx
✅ Session token stored
✅ User data retrieved
🔄 Navigating to Profile...
```

---

## ✅ النتيجة:

بعد الإصلاح:
- ✅ OAuth يرجع على التطبيق (مش localhost)
- ✅ Session token يتم حفظه
- ✅ المستخدم يتم تسجيل دخوله تلقائياً
- ✅ ينتقل للبروفايل بنجاح! 🎉
