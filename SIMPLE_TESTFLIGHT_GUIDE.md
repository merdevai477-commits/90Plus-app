# دليل مبسط لرفع التطبيق على TestFlight 🚀

## 🎯 **الخطوات المطلوبة:**

### **1️⃣ إنشاء حساب Expo (مرة واحدة فقط)**

1. اذهب لـ: https://expo.dev/signup
2. أنشئ حساب جديد:
   - **Username:** mhmdsh1892 (أو أي اسم تريده)
   - **Email:** mhmdsh1892@gmail.com
   - **Password:** أي باسورد تريده

### **2️⃣ تسجيل الدخول في Terminal**

```bash
cd front
eas login
# استخدم بيانات حساب Expo الجديد (مش Apple)
```

### **3️⃣ إنشاء مشروع EAS جديد**

```bash
eas init
# اختر "Create a new project"
```

### **4️⃣ إعداد Apple Developer Account**

في ملف `eas.json`، حدث البيانات:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "mhmdsh1892@gmail.com",
        "ascAppId": "سيتم الحصول عليه من App Store Connect",
        "appleTeamId": "سيتم الحصول عليه من Developer Account"
      }
    }
  }
}
```

### **5️⃣ إنشاء App في App Store Connect**

1. اذهب لـ: https://appstoreconnect.apple.com
2. سجل دخول بحساب Apple: mhmdsh1892@gmail.com / Mhmdsh050@
3. My Apps → + → New App
4. املأ البيانات:
   - **Name:** 90Plus
   - **Bundle ID:** com.mhmdsh1892.ninetyplusapp (غير الاسم)
   - **SKU:** 90plus-app

### **6️⃣ تحديث Bundle ID**

في `app.json`:

```json
{
  "ios": {
    "bundleIdentifier": "com.mhmdsh1892.ninetyplusapp"
  }
}
```

### **7️⃣ إنشاء Build**

```bash
eas build --platform ios --profile production
```

### **8️⃣ رفع على TestFlight**

```bash
eas submit --platform ios --profile production
```

## 🔧 **إذا واجهت مشاكل:**

### **مشكلة تسجيل الدخول:**
- تأكد من إنشاء حساب Expo أولاً
- حساب Expo مختلف عن حساب Apple

### **مشكلة Bundle ID:**
- يجب أن يكون Bundle ID فريد
- غير "mrdev187" إلى "mhmdsh1892"

### **مشكلة Team ID:**
- اذهب لـ: https://developer.apple.com/account
- Membership → Team ID

## ⚡ **الطريقة السريعة للاختبار:**

إذا تريد اختبار فوري بدون TestFlight:

```bash
npx expo publish
```

ثم استخدم تطبيق **Expo Go** على الآيفون.

## 📞 **للمساعدة:**

إذا واجهت أي مشكلة، أرسل لي:
1. رسالة الخطأ كاملة
2. الخطوة اللي وقفت عندها

## 🎉 **بعد النجاح:**

- ستحصل على رابط TestFlight
- يمكنك دعوة مختبرين
- التطبيق سيكون جاهز للتحميل

---

**ملاحظة مهمة:** حساب Expo مختلف عن حساب Apple Developer. تحتاج الاثنين!