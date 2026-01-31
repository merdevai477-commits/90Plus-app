# دليل رفع التطبيق على TestFlight من Windows 🚀

## 📋 **المتطلبات:**
- ✅ حساب Apple Developer: `mhmdsh1892@gmail.com`
- ✅ كلمة المرور: `Mhmdsh050@`
- ✅ التطبيق مرفوع على Expo Go بنجاح
- ✅ جهاز Windows مع PowerShell

## 🔧 **الخطوات:**

### **1. تسجيل الدخول في EAS CLI:**
```powershell
cd front
eas login
```
**أدخل بيانات Expo:**
- Username: `mrdev_10`
- Password: `iw5!T?JaJN%+Q93`

### **2. ربط المشروع بـ Apple Developer:**
```powershell
eas device:create
```
اختر `ios` واتبع التعليمات لإضافة جهازك للاختبار.

### **3. بناء التطبيق للإنتاج:**
```powershell
eas build --platform ios --profile production
```

**سيطلب منك:**
- Apple ID: `mhmdsh1892@gmail.com`
- Password: `Mhmdsh050@`
- Team ID: (سيتم اكتشافه تلقائياً)

### **4. رفع على TestFlight:**
```powershell
eas submit --platform ios --profile production
```

**سيطلب منك:**
- اختيار البناء الأخير
- تأكيد الرفع

## 🔍 **إذا واجهت مشاكل:**

### **مشكلة: "No development team found"**
```powershell
# احصل على Team ID
eas credentials
```

### **مشكلة: "Bundle ID already exists"**
- اذهب لـ [Apple Developer Console](https://developer.apple.com)
- تأكد من وجود App ID: `com.mhmdsh1892.ninetyplusapp`

### **مشكلة: "Authentication failed"**
```powershell
# امسح الكاش وأعد المحاولة
eas auth:logout
eas login
```

## 📱 **بعد الرفع الناجح:**

1. **اذهب لـ [App Store Connect](https://appstoreconnect.apple.com)**
2. **سجل دخول بـ:** `mhmdsh1892@gmail.com`
3. **اذهب لـ TestFlight**
4. **أضف مختبرين:**
   - اضغط على "External Testing"
   - أضف إيميلات المختبرين
   - اضغط "Start Testing"

## 🎯 **معلومات مهمة:**

### **Bundle ID:**
```
com.mhmdsh1892.ninetyplusapp
```

### **App Name:**
```
90Plus
```

### **Support URL:**
```
https://90plus-app-production.up.railway.app/support
```

### **Privacy Policy URL:**
```
https://90plus-app-production.up.railway.app/privacy
```

## ⚡ **الأوامر السريعة:**

```powershell
# الانتقال للمجلد
cd front

# تسجيل الدخول
eas login

# بناء التطبيق
eas build --platform ios --profile production

# رفع على TestFlight
eas submit --platform ios --profile production

# فحص الحالة
eas build:list
```

## 🔄 **للتحديثات المستقبلية:**

### **تحديث بسيط (OTA):**
```powershell
npx expo publish
```

### **تحديث يحتاج Build جديد:**
```powershell
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

## 📞 **للمساعدة:**
- **الدعم:** merdevai477@gmail.com
- **الهاتف:** +220 76 30 953

---

**ملاحظة:** العملية قد تستغرق 15-30 دقيقة للبناء و 5-10 دقائق للرفع.