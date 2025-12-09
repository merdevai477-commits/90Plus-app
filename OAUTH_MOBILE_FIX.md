# 🔧 حل مشكلة OAuth على الموبايل

## المشكلة:
لما بتضغط على Google/Apple، بيفتح الصفحة لكن بعد ما تختار الحساب بيرجعك على صفحة خطأ:
```
http://localhost:8081/auth/error?error=authentication_failed
```

---

## الحل (3 خطوات بس):

### 1️⃣ افتح Clerk Dashboard

اذهب إلى: **https://dashboard.clerk.com**

### 2️⃣ ضبط Redirect URLs

1. من القائمة الجانبية: **Configure** → **Paths**
2. في قسم **Allowed redirect URLs**، أضف:
   ```
   footballproapp://
   exp://192.168.1.7:8081
   ```
3. اضغط **Save**

### 3️⃣ اختبر التطبيق

```bash
# شغل Backend
cd Backend
npm run dev

# في terminal تاني، شغل Frontend
cd front
npm start --clear
```

---

## ✅ المفروض يحصل إيه:

1. تضغط على أيقونة Google 🟢
2. يفتح صفحة Google
3. تختار حسابك
4. **يرجعك للتطبيق مباشرة على Home** ✅
5. تلاقي نفسك مسجل دخول!

---

## 🧪 اختبر الإعدادات:

شغل السكريبت ده عشان يتأكد إن كل حاجة مظبوطة:

```bash
.\TEST_OAUTH.ps1
```

---

## 🆘 لو لسه مش شغال:

### تأكد من:

1. **Backend شغال:**
   ```bash
   cd Backend
   npm run dev
   ```
   لازم تشوف: `Server running on port 3000`

2. **Expo شغال:**
   ```bash
   cd front
   npm start
   ```
   لازم تشوف QR code

3. **Clerk Keys موجودة:**
   - في `Backend/.env`: `CLERK_SECRET_KEY=sk_test_...`
   - في `front/app.json`: `clerkPublishableKey: "pk_test_..."`

4. **Google/Apple مفعلين في Clerk:**
   - Dashboard → **User & Authentication** → **Social Connections**
   - Google: ✅ Enabled
   - Apple: ✅ Enabled

---

## 📱 على الموبايل:

1. افتح **Expo Go**
2. امسح الـ QR code
3. اضغط على **Google** أو **Apple**
4. سجل دخول
5. **المفروض يرجعك للتطبيق!** ✅

---

## 💡 ملاحظات مهمة:

- **IP Address:** لازم يكون نفس IP الكمبيوتر والموبايل على نفس الـ WiFi
- **Redirect URLs:** لازم تكون مضافة في Clerk Dashboard
- **Backend:** لازم يكون شغال عشان يخزن بيانات المستخدم

---

## 🎉 بعد ما OAuth يشتغل:

هتلاقي في **Profile Screen**:
- ✅ اسمك من Google/Apple
- ✅ صورتك
- ✅ 50 Coins (هدية ترحيب!)
- ✅ Level 1

---

**جرب دلوقتي!** 🚀

إذا لسه فيه مشكلة، شوف الملف ده: `FIX_OAUTH_REDIRECT.md`
