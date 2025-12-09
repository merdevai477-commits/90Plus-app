# 🔐 تفعيل Google & Apple OAuth في Clerk

## ✅ تم إضافة الأزرار في التطبيق!

دلوقتي محتاج تفعل OAuth Providers في Clerk Dashboard.

---

## 🔧 الخطوات:

### 1️⃣ تفعيل Google OAuth:

#### في Clerk Dashboard:
1. افتح: https://dashboard.clerk.com
2. اختار Application بتاعك
3. اذهب إلى: **User & Authentication** → **Social Connections**
4. اضغط على **Google**
5. فعّل "Enable for sign-up and sign-in"

#### الإعدادات (اختياري):
- **Use Clerk's development keys:** ✅ (للتجربة السريعة)
- **Use custom credentials:** إذا عندك Google OAuth credentials

#### احفظ التغييرات!

---

### 2️⃣ تفعيل Apple Sign In:

#### في Clerk Dashboard:
1. نفس الخطوات السابقة
2. اضغط على **Apple**
3. فعّل "Enable for sign-up and sign-in"

#### ملاحظة:
- Apple Sign In يحتاج Apple Developer Account
- للتجربة، استخدم "Use Clerk's development keys"

#### احفظ التغييرات!

---

## 🚀 اختبار OAuth:

### 1. أعد تشغيل التطبيق:
```bash
cd front
npm start --clear
```

### 2. في التطبيق:
- اضغط على أيقونة Google (Chrome)
- أو اضغط على أيقونة Apple
- سجل دخول
- **هيرجعك للتطبيق تلقائياً!** 🎉

---

## 📱 الشكل النهائي:

```
┌─────────────────────────────┐
│     Football Pro            │
│  Welcome back, Champion!    │
├─────────────────────────────┤
│  [Login] [Sign Up]          │
├─────────────────────────────┤
│  📧 Email Address           │
│  🔒 Password                │
│                             │
│  [Sign In →]                │
│                             │
│  OR CONTINUE WITH           │
│                             │
│    [🌐]    [🍎]            │
│  Google   Apple             │
│                             │
│  [🎮 متابعة كضيف]          │
└─────────────────────────────┘
```

---

## ✅ المميزات الجديدة:

- ✅ زر Google Sign In (أيقونة Chrome)
- ✅ زر Apple Sign In (أيقونة Apple)
- ✅ "OR CONTINUE WITH" divider
- ✅ "Forgot Password?" link
- ✅ نفس التصميم (Dark theme, Green glow)

---

## 🆘 حل المشاكل:

### 1. "OAuth provider not enabled"
- تأكد من تفعيل Google/Apple في Clerk Dashboard
- أعد تشغيل التطبيق

### 2. "Redirect URI mismatch"
- Clerk بيتعامل مع الـ redirect تلقائياً
- لو فيه مشكلة، تأكد من `expo-web-browser` مثبت

### 3. "Apple Sign In not working"
- Apple Sign In يحتاج Apple Developer Account
- استخدم "Use Clerk's development keys" للتجربة

---

## 📊 الخطوات التالية:

### 1. تفعيل Email Verification:
- في Clerk Dashboard → Email, Phone, Username
- فعّل "Require email verification"

### 2. تخصيص OAuth Screens:
- في Clerk Dashboard → Customization
- غيّر الألوان والشعار

### 3. إضافة Forgot Password:
```tsx
const handleForgotPassword = async () => {
  // سيتم إضافته لاحقاً
};
```

---

## ✅ جاهز!

**افتح التطبيق وجرب Google/Apple Sign In!** 🎉

```bash
cd front
npm start
```
