# ✅ إعداد ngrok مكتمل!

تم تحديث المشروع لاستخدام ngrok تلقائياً عند تشغيل Expo (سواء tunnel أو localhost).

## 📋 ما تم تحديثه:

### 1. Frontend (`front/utils/getApiUrl.ts`)
- ✅ يدعم الآن ngrok URL تلقائياً
- ✅ يتحقق من `EXPO_PUBLIC_NGROK_URL` أولاً
- ✅ يتحقق من `app.json` → `extra.ngrokUrl`
- ✅ يعود تلقائياً إلى local IP إذا لم يتوفر ngrok

### 2. Frontend Config (`front/app.json`)
- ✅ تم إضافة `ngrokUrl` في `extra`:
  ```json
  "ngrokUrl": "https://serologically-appointed-kailey.ngrok-free.dev"
  ```

### 3. Backend (`Backend/src/config/auth.config.ts`)
- ✅ يكتشف ngrok URL تلقائياً من `NGROK_URL`
- ✅ يستخدم ngrok في OAuth callback تلقائياً
- ✅ يعود إلى localhost إذا لم يتوفر ngrok

## 🚀 كيفية الاستخدام:

### الطريقة 1: استخدام ngrok URL من app.json (موصى بها)

1. **تأكد من أن ngrok يعمل:**
   ```powershell
   ngrok http 3000
   ```

2. **انسخ ngrok URL** (مثل: `https://serologically-appointed-kailey.ngrok-free.dev`)

3. **حدّث `front/app.json`:**
   ```json
   {
     "expo": {
       "extra": {
         "ngrokUrl": "https://YOUR_NGROK_URL.ngrok-free.dev"
       }
     }
   }
   ```

4. **أعد تشغيل Expo:**
   ```powershell
   cd front
   npm start
   # ثم اضغط 'r' لإعادة التحميل
   ```

### الطريقة 2: استخدام متغير البيئة

1. **أنشئ ملف `.env` في مجلد `front`:**
   ```env
   EXPO_PUBLIC_NGROK_URL=https://serologically-appointed-kailey.ngrok-free.dev
   ```

2. **أعد تشغيل Expo**

### الطريقة 3: تحديث Backend .env

1. **أنشئ/حدّث ملف `.env` في مجلد `Backend`:**
   ```env
   NGROK_URL=https://serologically-appointed-kailey.ngrok-free.dev
   GOOGLE_CALLBACK_URL=https://serologically-appointed-kailey.ngrok-free.dev/api/auth/google/callback
   ```

2. **أعد تشغيل Backend:**
   ```powershell
   cd Backend
   npm run dev
   ```

## ✅ ما يعمل الآن:

- ✅ **Frontend يتصل بالباك إند عبر ngrok** تلقائياً
- ✅ **OAuth (Google) يعمل** مع ngrok تلقائياً
- ✅ **يعمل مع Expo Tunnel** و **Expo Localhost**
- ✅ **يعود تلقائياً إلى local IP** إذا لم يتوفر ngrok

## 🔧 إعداد Google OAuth:

1. **اذهب إلى Google Cloud Console:**
   - https://console.cloud.google.com/
   - APIs & Services → Credentials

2. **أضف Authorized redirect URI:**
   ```
   https://serologically-appointed-kailey.ngrok-free.dev/api/auth/google/callback
   ```

3. **تأكد من تحديث `.env` في Backend:**
   ```env
   GOOGLE_CLIENT_ID="your-client-id"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   GOOGLE_CALLBACK_URL="https://serologically-appointed-kailey.ngrok-free.dev/api/auth/google/callback"
   ```

## 📝 ملاحظات مهمة:

### 1. ngrok URL يتغير
- **Free plan:** URL يتغير في كل مرة تشغل ngrok
- **Paid plan:** يمكنك الحصول على URL ثابت

### 2. تحديث app.json
- كل مرة تشغل ngrok وتحصل على URL جديد، يجب تحديث `app.json` → `extra.ngrokUrl`
- أو استخدم متغير البيئة `EXPO_PUBLIC_NGROK_URL`

### 3. CORS
- الباك إند يدعم ngrok URLs تلقائياً
- لا حاجة لتعديل CORS settings

## 🎯 الأولوية في اختيار API URL:

1. **ngrok URL** (من `EXPO_PUBLIC_NGROK_URL` أو `app.json` → `extra.ngrokUrl`)
2. **API URL** (من `EXPO_PUBLIC_API_URL` أو `app.json` → `extra.apiUrl`)
3. **Localhost/Local IP** (fallback)

## 🆘 حل المشاكل:

### التطبيق لا يتصل بالباك إند:
- ✅ تأكد من أن ngrok يعمل: افتح http://localhost:4040
- ✅ تأكد من تحديث `app.json` → `extra.ngrokUrl`
- ✅ تأكد من إعادة تشغيل Expo (اضغط 'r')

### OAuth لا يعمل:
- ✅ تأكد من إضافة ngrok URL في Google Cloud Console
- ✅ تأكد من تحديث `GOOGLE_CALLBACK_URL` في Backend `.env`
- ✅ تأكد من إعادة تشغيل Backend

### CORS errors:
- ✅ تأكد من أن ngrok URL يبدأ بـ `https://`
- ✅ الباك إند يدعم ngrok URLs تلقائياً

---

## ✅ جاهز للاستخدام!

الآن يمكنك:
1. تشغيل ngrok: `ngrok http 3000`
2. تحديث `app.json` → `extra.ngrokUrl` (إذا تغير URL)
3. تشغيل Expo: `cd front && npm start`
4. اختبار OAuth على الهاتف! 🎉

