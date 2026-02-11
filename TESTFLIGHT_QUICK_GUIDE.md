# 🚀 TestFlight Upload - دليل سريع

## ✅ الإعدادات جاهزة

- ✅ Bundle ID: `com.mhmdsh1892.ninetyplusapp`
- ✅ Apple ID: `mhmdsh1892@gmail.com`
- ✅ Version: `1.0.0`
- ✅ Build Number: `1` (auto-increment enabled)
- ✅ Privacy URL: https://90plus-app-production.up.railway.app/privacy
- ✅ Support URL: https://90plus-app-production.up.railway.app/support

---

## 🚀 الطريقة الأسهل (موصى بها)

### الخطوة 1: Build

```bash
cd front
eas build --platform ios --profile production
```

**ملاحظات:**
- الوقت المتوقع: 15-20 دقيقة
- هيطلب منك تسجيل دخول Apple Developer
- هيطلب منك App Store Connect API Key (أول مرة بس)

---

### الخطوة 2: Submit تلقائياً

بعد ما الـ build يخلص، اعمل:

```bash
eas submit --platform ios --latest
```

**ملاحظات:**
- `--latest` معناها هيستخدم آخر build
- هيرفع على TestFlight تلقائياً
- الوقت المتوقع: 5-10 دقائق

---

## 🎯 الخطوات بالتفصيل

### 1. تسجيل الدخول لـ EAS

```bash
eas login
```

أدخل:
- Email: حسابك على Expo
- Password: كلمة المرور

---

### 2. Build للـ iOS

```bash
cd front
eas build --platform ios --profile production
```

**هيحصل إيه:**
1. هيسألك: "Would you like to automatically create an App Store Connect API Key?"
   - اختار: **Yes** ✅

2. هيسألك: "Log in to your Apple account"
   - أدخل: `mhmdsh1892@gmail.com`
   - أدخل: كلمة المرور
   - أدخل: 2FA code (لو مطلوب)

3. هيبدأ الـ build على سيرفرات Expo
   - انتظر 15-20 دقيقة
   - تقدر تقفل الـ terminal، الـ build هيكمل

4. لما يخلص، هتلاقي رسالة:
   ```
   ✅ Build finished
   📦 Download: https://expo.dev/...
   ```

---

### 3. Submit لـ TestFlight

```bash
eas submit --platform ios --latest
```

**هيحصل إيه:**
1. هيسألك: "Would you like to log in to your Apple account?"
   - اختار: **Yes** ✅

2. هيرفع الـ .ipa على App Store Connect
   - الوقت المتوقع: 5-10 دقائق

3. لما يخلص، هتلاقي رسالة:
   ```
   ✅ Successfully submitted build to App Store Connect
   ```

---

## 📱 بعد الرفع

### 1. روح على App Store Connect

https://appstoreconnect.apple.com

### 2. اختار التطبيق

- اسم التطبيق: **90Plus**
- Bundle ID: `com.mhmdsh1892.ninetyplusapp`

### 3. روح على TestFlight

- دوس على "TestFlight" من القائمة الجانبية
- هتلاقي الـ build بيتعالج (Processing)
- الوقت المتوقع: 5-15 دقيقة

### 4. لما الـ Processing يخلص

- الـ build هيبقى "Ready to Test"
- تقدر تضيف testers
- تقدر تنزل التطبيق على جهازك

---

## 🧪 اختبار على TestFlight

### 1. حمل TestFlight

من App Store على iPhone/iPad

### 2. افتح TestFlight

- هتلاقي **90Plus** في القائمة
- دوس "Install"

### 3. اختبر التطبيق

- افتح التطبيق
- اختبر كل الـ features:
  - ✅ Login/Signup
  - ✅ Block User
  - ✅ Privacy/Terms (في Settings)
  - ✅ Account Deletion
  - ✅ Report Content
  - ✅ Predictions
  - ✅ Quiz
  - ✅ Reels

---

## 🆘 مشاكل شائعة

### مشكلة: "Invalid bundle identifier"

**الحل:**
1. تأكد إن Bundle ID في `app.json` مطابق لـ Apple Developer
2. Bundle ID: `com.mhmdsh1892.ninetyplusapp`

---

### مشكلة: "Provisioning profile error"

**الحل:**
```bash
eas credentials
```
اختار:
- Platform: iOS
- Action: "Manage credentials"
- اختار "Remove all credentials"
- اعمل build تاني، هيعمل credentials جديدة

---

### مشكلة: "Build failed"

**الحل:**
```bash
cd front
rm -rf node_modules
npm install
eas build --platform ios --profile production --clear-cache
```

---

### مشكلة: "App Store Connect API Key not found"

**الحل:**
1. روح على https://appstoreconnect.apple.com/access/api
2. دوس "Generate API Key"
3. حمل الـ .p8 file
4. اعمل:
```bash
eas credentials
```
5. اختار "Set up App Store Connect API Key"
6. ارفع الـ .p8 file

---

## 📋 Checklist قبل الرفع

- [ ] Backend deployed على Railway
- [ ] Privacy URL شغال
- [ ] Terms URL شغال
- [ ] Support URL شغال
- [ ] Block feature tested
- [ ] Account deletion tested
- [ ] Report system tested
- [ ] Git changes pushed
- [ ] Environment variables set

---

## 🎯 الأوامر الكاملة

```bash
# 1. Login
eas login

# 2. Build
cd front
eas build --platform ios --profile production

# 3. Submit (بعد ما الـ build يخلص)
eas submit --platform ios --latest

# 4. Check status
eas build:list
```

---

## 📊 Timeline المتوقع

| الخطوة | الوقت |
|--------|-------|
| Build على EAS | 15-20 دقيقة |
| Submit لـ App Store Connect | 5-10 دقائق |
| Processing في TestFlight | 5-15 دقيقة |
| **المجموع** | **25-45 دقيقة** |

---

## 🎊 بعد ما يخلص

### TestFlight Ready ✅

- تقدر تنزل التطبيق على جهازك
- تقدر تضيف testers (حتى 10,000 tester)
- تقدر تختبر كل الـ features

### Submit for Review 🚀

لما تتأكد إن كل حاجة شغالة:

1. روح على App Store Connect
2. دوس "App Store" (مش TestFlight)
3. دوس "Prepare for Submission"
4. املا البيانات:
   - App Name: **90Plus**
   - Subtitle: **Football Predictions & Reels**
   - Description: (استخدم `LONG_APP_DESCRIPTION.md`)
   - Keywords: football, soccer, predictions, reels, quiz
   - Support URL: https://90plus-app-production.up.railway.app/support
   - Privacy URL: https://90plus-app-production.up.railway.app/privacy
5. ارفع Screenshots (5-6 صور)
6. اختار الـ build من TestFlight
7. دوس "Submit for Review"

---

## 📞 محتاج مساعدة؟

**Email:** merdevai477@gmail.com

**Documentation:**
- `TESTFLIGHT_WINDOWS_GUIDE.md` - دليل مفصل
- `READY_FOR_APPLE_SUBMISSION.md` - دليل الرفع الكامل
- `SCREENSHOTS_GUIDE.md` - دليل الـ Screenshots

---

## 🚀 ابدأ دلوقتي!

```bash
cd front
eas build --platform ios --profile production
```

**Good Luck! 🎉**

---

**Last Updated:** February 5, 2026
**Status:** ✅ READY TO UPLOAD

---

**Made with ❤️ for 90Plus**
