# أوامر رفع التطبيق على TestFlight 🚀

## 📋 **بيانات الحساب:**
- **Apple ID:** mhmdsh1892@gmail.com
- **Apple Password:** Mhmdsh050@
- **Bundle ID:** com.mhmdsh1892.ninetyplusapp

## 🔧 **الأوامر المطلوبة:**

### 1. تسجيل الدخول:
```bash
cd front
eas login
```

### 2. إنشاء مشروع EAS:
```bash
eas init
```

### 3. إنشاء iOS Build:
```bash
eas build --platform ios --profile production
```

### 4. رفع على TestFlight:
```bash
eas submit --platform ios --profile production
```

## 🌐 **الروابط المطلوبة:**

1. **إنشاء حساب Expo:** https://expo.dev/signup
2. **App Store Connect:** https://appstoreconnect.apple.com
3. **Apple Developer:** https://developer.apple.com/account

## 📝 **المعرفات المطلوبة:**

بعد إنشاء الـ App في App Store Connect:
- **App Store Connect App ID:** (من URL الـ App)
- **Team ID:** (من Apple Developer Account)

## ⚡ **للاختبار السريع (بدون TestFlight):**

```bash
npx expo publish
```

ثم استخدم تطبيق **Expo Go** على الآيفون.

## 🎯 **الخطوات بالترتيب:**

1. ✅ إنشاء حساب Expo
2. ✅ تسجيل دخول EAS
3. ✅ إنشاء مشروع EAS
4. ✅ إنشاء App في App Store Connect
5. ✅ الحصول على App ID و Team ID
6. ✅ تحديث eas.json
7. ✅ إنشاء Build
8. ✅ رفع على TestFlight

## 🚨 **ملاحظات مهمة:**

- حساب Expo مختلف عن حساب Apple
- Bundle ID يجب أن يكون فريد
- Build يأخذ 10-20 دقيقة
- TestFlight Review يأخذ 24-48 ساعة

---

**جاهز للبدء! 🎉**