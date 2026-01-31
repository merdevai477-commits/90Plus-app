# دليل رفع التطبيق على TestFlight 🚀

## 📋 **المتطلبات:**
- ✅ Apple Developer Account (99$ سنوياً)
- ✅ حساب App Store Connect
- ✅ EAS CLI مثبت

## 🔧 **الخطوة 1: التحضير**

### تثبيت الأدوات المطلوبة:
```bash
npm install -g @expo/cli eas-cli
```

### تسجيل الدخول:
```bash
cd front
eas login
# استخدم: mhmdsh1892@gmail.com
```

## 🏗️ **الخطوة 2: إعداد App Store Connect**

### 1. إنشاء App جديد:
- اذهب لـ: https://appstoreconnect.apple.com
- My Apps → + → New App
- **Name:** 90Plus
- **Bundle ID:** com.mrdev187.ninetyplusapp
- **SKU:** 90plus-app

### 2. الحصول على المعرفات:
بعد إنشاء الـ App:
- **App Store Connect App ID:** (رقم طويل من URL الـ App)
- **Team ID:** (من Developer Account Settings)

### 3. تحديث eas.json:
```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "mhmdsh1892@gmail.com",
        "ascAppId": "YOUR_APP_ID_HERE",
        "appleTeamId": "YOUR_TEAM_ID_HERE"
      }
    }
  }
}
```

## 🚀 **الخطوة 3: إنشاء Build**

### Build للإنتاج:
```bash
cd front
eas build --platform ios --profile production
```

**ملاحظة:** هذا الأمر سيأخذ 10-20 دقيقة

## 📤 **الخطوة 4: الرفع على TestFlight**

### رفع تلقائي:
```bash
eas submit --platform ios --profile production
```

### أو رفع يدوي:
1. حمل الـ .ipa file من EAS Dashboard
2. استخدم Transporter app من Apple
3. ارفع الملف يدوياً

## 🔄 **البدائل السريعة:**

### 1. Development Build (للاختبار السريع):
```bash
eas build --platform ios --profile development
```

### 2. Expo Publish (بدون build):
```bash
npx expo publish
```

### 3. Preview Build:
```bash
eas build --platform ios --profile preview
```

## 📱 **الخطوة 5: إعداد TestFlight**

بعد رفع الـ Build:

1. اذهب لـ App Store Connect
2. TestFlight → iOS Builds
3. انتظر معالجة الـ Build (5-10 دقائق)
4. أضف Internal Testers
5. أرسل دعوات للمختبرين

## 🛠️ **حل المشاكل الشائعة:**

### مشكلة الصلاحيات:
```bash
eas logout
eas login
# تأكد من استخدام الحساب الصحيح
```

### مشكلة Bundle ID:
- تأكد من أن Bundle ID فريد
- يجب أن يطابق ما في app.json

### مشكلة Team ID:
- اذهب لـ Developer Account
- Membership → Team ID

## 📋 **Checklist قبل الرفع:**

- [ ] Apple Developer Account مفعل
- [ ] App مُنشأ في App Store Connect  
- [ ] Bundle ID صحيح ومطابق
- [ ] Team ID و App ID محدثين في eas.json
- [ ] تسجيل دخول EAS بالحساب الصحيح
- [ ] جميع الأذونات مضافة في app.json

## 🎯 **الأوامر السريعة:**

```bash
# كل شيء في أمر واحد
cd front && eas login && eas build --platform ios --profile production && eas submit --platform ios --profile production
```

## 📞 **للمساعدة:**

إذا واجهت مشاكل:
1. تحقق من EAS Dashboard: https://expo.dev/accounts/[username]/projects/90plus
2. راجع Logs في Build Details
3. تأكد من صحة جميع المعرفات

## 🎉 **بعد النجاح:**

- ستصلك إشعارات على الإيميل
- يمكنك دعوة مختبرين من TestFlight
- التطبيق سيكون متاح للتحميل خلال دقائق

**نصيحة:** احفظ هذا الملف للمرات القادمة! 📝