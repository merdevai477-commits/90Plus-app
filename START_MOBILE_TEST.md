# 📱 دليل اختبار التطبيق على الموبايل

## 🎯 الهدف:
اختبار OAuth (Google/Apple) على الموبايل والتأكد من أن كل حاجة شغالة

---

## ✅ قبل ما تبدأ:

### 1. تأكد من الإعدادات:

#### Clerk Dashboard:
1. افتح: https://dashboard.clerk.com
2. اذهب إلى: **Configure** → **Paths**
3. أضف في **Allowed redirect URLs**:
   ```
   footballproapp://
   exp://192.168.1.7:8081
   ```
4. احفظ التغييرات

#### Backend .env:
تأكد من وجود:
```env
CLERK_SECRET_KEY=sk_test_C91Stzsrdq7UXj9JFBrGcughjFONN6f8ioJEsxMIHJ
DATABASE_URL=your_database_url
PORT=3000
```

#### Frontend app.json:
تأكد من:
```json
{
  "expo": {
    "scheme": "footballproapp",
    "extra": {
      "clerkPublishableKey": "pk_test_Z2xvd2luZy10aHJ1c2gtMTIuY2xlcmsuYWNjb3VudHMuZGV2JA",
      "apiUrl": "http://192.168.1.7:3000/api"
    }
  }
}
```

---

## 🚀 خطوات التشغيل:

### 1️⃣ شغل Backend:

```bash
cd Backend
npm run dev
```

**المفروض تشوف:**
```
🚀 Football App Backend is running!
📍 Server: http://localhost:3000
📍 API: http://localhost:3000/api
📍 Health: http://localhost:3000/api/health
✅ Database connected successfully
```

### 2️⃣ شغل Frontend:

في terminal جديد:
```bash
cd front
npm start --clear
```

**المفروض تشوف:**
- QR code
- Metro bundler running
- `exp://192.168.1.7:8081`

### 3️⃣ اختبر الإعدادات (اختياري):

```bash
.\TEST_OAUTH.ps1
```

---

## 📱 على الموبايل:

### 1. افتح Expo Go:
- Android: من Google Play
- iOS: من App Store

### 2. امسح QR Code:
- تأكد إن الموبايل والكمبيوتر على نفس الـ WiFi
- امسح الـ QR code من terminal

### 3. اختبر OAuth:

#### ✅ اختبار Google OAuth:
1. اضغط على أيقونة Google 🟢
2. اختار حسابك
3. **المفروض يرجعك للتطبيق على Home**
4. اذهب إلى Profile → تشوف بياناتك

#### ✅ اختبار Apple OAuth:
1. اضغط على أيقونة Apple 🍎
2. سجل دخول
3. **المفروض يرجعك للتطبيق على Home**
4. اذهب إلى Profile → تشوف بياناتك

#### ✅ اختبار Email/Password:
1. اكتب email وpassword
2. اضغط "تسجيل"
3. **المفروض يدخلك على Home**
4. اذهب إلى Profile → تشوف بياناتك

---

## 🎉 النتيجة المتوقعة:

### في Profile Screen:
- ✅ اسمك (من Google/Apple/Email)
- ✅ صورتك الشخصية
- ✅ Username (auto-generated)
- ✅ 50 Coins (هدية ترحيب!)
- ✅ Level 1
- ✅ تاريخ التسجيل

### في Backend:
```bash
# شوف الـ logs في terminal
✅ New user created from Clerk: user_xxxxx
```

### في Database:
```sql
-- المستخدم اتخزن في جدول users
SELECT * FROM users WHERE "clerkUserId" = 'user_xxxxx';
```

---

## 🆘 مشاكل شائعة:

### ❌ "authentication_failed"
**السبب:** Redirect URLs مش مضافة في Clerk Dashboard  
**الحل:** أضف `footballproapp://` و `exp://192.168.1.7:8081` في Clerk Dashboard

### ❌ "This screen doesn't exist"
**السبب:** App scheme مش مظبوط  
**الحل:** تأكد من `scheme: "footballproapp"` في app.json

### ❌ "No token available"
**السبب:** Backend مش شغال أو CLERK_SECRET_KEY غلط  
**الحل:** تأكد من Backend شغال وال key صحيح

### ❌ OAuth يفتح لكن مش بيرجع للتطبيق
**السبب:** Redirect URL مش مضاف  
**الحل:** أضف `exp://192.168.1.7:8081` في Clerk Dashboard

### ❌ "Cannot connect to backend"
**السبب:** IP Address غلط أو Backend مش شغال  
**الحل:** 
1. تأكد من Backend شغال
2. تأكد من IP في app.json صحيح
3. تأكد من الموبايل والكمبيوتر على نفس WiFi

---

## 🔍 تشخيص المشاكل:

### 1. تحقق من Backend:
```bash
# في browser، افتح:
http://localhost:3000/api/health

# المفروض تشوف:
{
  "status": "OK",
  "database": "Connected",
  "server": "Running"
}
```

### 2. تحقق من Expo:
```bash
# في browser، افتح:
http://localhost:8081

# المفروض تشوف صفحة Metro bundler
```

### 3. تحقق من Logs:
```bash
# في terminal بتاع Backend:
# شوف لو فيه errors

# في terminal بتاع Expo:
# شوف لو فيه errors
```

---

## 💡 نصائح مهمة:

1. **WiFi:** الموبايل والكمبيوتر لازم يكونوا على نفس الشبكة
2. **Firewall:** تأكد إن Firewall مش بيمنع port 3000 و 8081
3. **IP Address:** لو IP الكمبيوتر اتغير، حدث app.json
4. **Clear Cache:** لو فيه مشاكل، استخدم `npm start --clear`

---

## 🎯 بعد ما كل حاجة تشتغل:

### اختبر Features:
- ✅ Login/Signup
- ✅ Google OAuth
- ✅ Apple OAuth
- ✅ Profile Screen
- ✅ Coins System
- ✅ Guest Mode

### اختبر Navigation:
- ✅ Home → Profile
- ✅ Profile → Settings
- ✅ Logout → Auth Screen

---

## 📚 ملفات مساعدة:

- `FIX_OAUTH_REDIRECT.md` - حل مشاكل OAuth redirect
- `OAUTH_MOBILE_FIX.md` - حل سريع لمشاكل OAuth
- `TEST_OAUTH.ps1` - سكريبت اختبار الإعدادات
- `CLERK_SETUP_COMPLETE.md` - توثيق إعداد Clerk
- `CLERK_BACKEND_SETUP_COMPLETE.md` - توثيق Backend

---

**جرب دلوقتي وقولي النتيجة!** 🚀

إذا كل حاجة شغالة، يبقى OAuth integration كامل! ✅
