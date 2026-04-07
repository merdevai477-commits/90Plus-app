# 📱 دليل اختبار iPad - خطوة بخطوة

## 🎯 الهدف
اختبار تسجيل الدخول على iPad للتأكد من حل المشكلة المبلغ عنها من Apple Review.

---

## 🖥️ الاختبار على iPad Simulator

### الخطوة 1: تشغيل التطبيق
```bash
cd front
npx expo start
```

### الخطوة 2: فتح iPad Simulator
في الترمينال، اضغط على:
```
i
```
ثم اختر من القائمة:
```
iPad Air 11-inch (M3) - iOS 26.4
```

### الخطوة 3: انتظر فتح التطبيق
- سيفتح Xcode Simulator تلقائياً
- سيتم تحميل التطبيق على iPad
- انتظر حتى تظهر شاشة تسجيل الدخول

---

## ✅ سيناريوهات الاختبار

### السيناريو 1: فحص الـ Layout
**الهدف:** التأكد من أن الواجهة تظهر بشكل صحيح على iPad

**الخطوات:**
1. افتح التطبيق على iPad Simulator
2. تحقق من:
   - [ ] الـ form متمركز في الشاشة (مش ملتصق بالجوانب)
   - [ ] الـ inputs كبيرة وواضحة
   - [ ] الـ buttons سهلة الضغط عليها
   - [ ] الـ spacing مناسب (مش متزاحم)
   - [ ] الـ logo واضح وبحجم مناسب

**النتيجة المتوقعة:**
- Form width: حوالي 600px (مش full width)
- Input height: 64px (أكبر من iPhone)
- Font size: 18px (أكبر من iPhone)

---

### السيناريو 2: اختبار الكيبورد
**الهدف:** التأكد من أن الكيبورد لا يغطي زر Login

**الخطوات:**
1. اضغط على حقل Email
2. تحقق من:
   - [ ] الكيبورد يظهر من الأسفل
   - [ ] الـ form يتحرك للأعلى تلقائياً
   - [ ] زر Login مازال ظاهر (مش مغطى)
3. اضغط على حقل Password
4. تحقق من نفس النقاط

**النتيجة المتوقعة:**
- الكيبورد يظهر بدون تغطية الأزرار
- يمكن التمرير (scroll) إذا احتاج المستخدم

---

### السيناريو 3: اختبار تسجيل الدخول
**الهدف:** التأكد من أن Login يعمل بدون أخطاء

**الخطوات:**
1. افتح Console في Xcode (View → Debug Area → Activate Console)
2. أدخل email صحيح: `test@example.com`
3. أدخل password صحيح: `Test123456`
4. اضغط على زر "دخول"
5. راقب الـ Console

**النتيجة المتوقعة في Console:**
```javascript
🔐 Login attempt started {
  device: {
    width: 1024,
    height: 768,
    isTablet: true,    // ✅ مهم جداً
    platform: 'ios',
    version: '26.4'
  },
  apiUrl: 'https://90plus-app-production-b28d.up.railway.app/api',
  hasEmail: true,
  hasPassword: true
}
```

**إذا نجح Login:**
- سيظهر loading screen
- سيتم الانتقال للصفحة الرئيسية
- ✅ المشكلة محلولة!

**إذا فشل Login:**
- سيظهر error message واضح
- راجع الـ Console logs
- أرسل الـ logs للمراجعة

---

### السيناريو 4: اختبار Error Handling
**الهدف:** التأكد من أن رسائل الخطأ واضحة

**الخطوات:**
1. أدخل email خاطئ: `wrong@test.com`
2. أدخل password خاطئ: `wrong123`
3. اضغط على "دخول"
4. تحقق من:
   - [ ] رسالة خطأ واضحة بالعربي
   - [ ] الـ Console يحتوي على device info
   - [ ] يمكن إعادة المحاولة

**النتيجة المتوقعة:**
```javascript
❌ Login failed: {
  error: 'البريد الإلكتروني غير مسجل',
  code: 'form_identifier_not_found',
  device: {
    isTablet: true,
    width: 1024,
    platform: 'ios'
  }
}
```

---

## 📱 الاختبار على iPad حقيقي (TestFlight)

### الخطوة 1: عمل Build
```bash
cd front
eas build --platform ios --profile production
```

### الخطوة 2: رفع على TestFlight
1. انتظر اكتمال الـ build (حوالي 15-20 دقيقة)
2. سيتم رفعه تلقائياً على App Store Connect
3. افتح App Store Connect → TestFlight
4. أضف iPad Air كـ tester

### الخطوة 3: تنزيل على iPad
1. افتح TestFlight على iPad Air
2. نزل النسخة الجديدة
3. افتح التطبيق

### الخطوة 4: اختبار نفس السيناريوهات
- ✅ Layout
- ✅ Keyboard
- ✅ Login
- ✅ Error Handling

---

## 🔍 كيفية قراءة الـ Logs

### على Simulator
1. افتح Xcode
2. Window → Devices and Simulators
3. اختر iPad Simulator
4. اضغط على "Open Console"
5. ابحث عن:
   - `🔐 Login attempt started`
   - `❌ Login failed`
   - `isTablet: true`

### على iPad حقيقي
1. وصّل iPad بالكمبيوتر
2. افتح Xcode
3. Window → Devices and Simulators
4. اختر iPad من القائمة
5. اضغط على "Open Console"
6. شغّل التطبيق واختبر

---

## ✅ Checklist النهائي

### قبل الاختبار
- [x] التعديلات مطبقة على `front/app/auth/index.tsx`
- [x] لا توجد أخطاء TypeScript
- [ ] التطبيق يعمل على iPhone (للتأكد)

### أثناء الاختبار على Simulator
- [ ] Layout صحيح على iPad
- [ ] Keyboard لا يغطي الأزرار
- [ ] Login يعمل بدون أخطاء
- [ ] Console logs تظهر `isTablet: true`
- [ ] Error messages واضحة

### أثناء الاختبار على iPad حقيقي
- [ ] Layout صحيح
- [ ] Keyboard handling صحيح
- [ ] Login يعمل
- [ ] Performance جيد
- [ ] لا توجد crashes

### بعد الاختبار
- [ ] جميع السيناريوهات نجحت
- [ ] لا توجد مشاكل في الـ logs
- [ ] التطبيق جاهز لإعادة الرفع

---

## 🚨 ماذا تفعل إذا فشل الاختبار؟

### إذا كان Layout غلط
1. تحقق من `isTablet` في Console
2. تحقق من `width` و `height`
3. راجع الـ styles في الكود

### إذا كان Keyboard يغطي الأزرار
1. تحقق من `KeyboardAvoidingView`
2. جرب scroll يدوياً
3. راجع `keyboardVerticalOffset`

### إذا فشل Login
1. تحقق من الإنترنت
2. تحقق من API URL في Console
3. تحقق من الـ error message
4. أرسل الـ logs الكاملة

### إذا ظهرت Crashes
1. افتح Xcode Console
2. ابحث عن stack trace
3. حدد السطر الذي حدث فيه الـ crash
4. أرسل الـ crash log

---

## 📞 الدعم

إذا واجهت أي مشكلة:
1. احفظ الـ Console logs
2. خذ screenshots من المشكلة
3. سجل فيديو للمشكلة (إن أمكن)
4. أرسل كل المعلومات للمراجعة

---

**تم إعداد الدليل:** 2026-04-03  
**الحالة:** ✅ جاهز للاختبار  
**المدة المتوقعة:** 30-45 دقيقة

