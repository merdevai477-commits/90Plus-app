# 📱 دليل بناء نسخة Android للاختبار

**التاريخ:** 4 أبريل 2026  
**الهدف:** بناء نسخة Android APK للاختبار الشامل قبل TestFlight

---

## 🎯 الخطة

### المرحلة 1: بناء Preview Build
نسخة تجريبية كاملة للاختبار على Android

### المرحلة 2: الاختبار الشامل
اختبار جميع الميزات الجديدة (EULA, Report, Block, etc.)

### المرحلة 3: التأكد من الجودة
التأكد من عدم وجود مشاكل قبل TestFlight

---

## 🚀 خطوات البناء

### 1. التحضير

```bash
cd front

# تأكد من تسجيل الدخول في EAS
npx eas-cli login

# تحقق من التكوين
npx eas-cli build:configure
```

### 2. بناء النسخة

```bash
# بناء Preview Build للاندرويد
npx eas-cli build --platform android --profile preview
```

**الوقت المتوقع:** 20-30 دقيقة

### 3. تحميل النسخة

بعد انتهاء البناء:
1. ستحصل على رابط تحميل APK
2. حمل الملف على موبايلك
3. ثبت التطبيق

---

## ✅ قائمة الاختبار الشاملة

### 1. EULA Flow (اتفاقية المستخدم)
- [ ] تثبيت جديد يظهر شاشة EULA
- [ ] زر "Agree" غير فعال قبل الـ scroll
- [ ] بعد الـ scroll، الزر يتفعل
- [ ] بعد الموافقة، الدخول للتطبيق
- [ ] عدم ظهور EULA مرة أخرى

### 2. Content Filter (فلترة المحتوى)
- [ ] محاولة كتابة كلمات مسيئة (English)
- [ ] محاولة كتابة كلمات مسيئة (Arabic)
- [ ] رسالة خطأ واضحة عند الرفض
- [ ] المحتوى النظيف يمر بنجاح

### 3. Report System (نظام الإبلاغ)
- [ ] Long-press على reel يظهر قائمة
- [ ] خيار "Report" موجود
- [ ] Modal يظهر مع أسباب الإبلاغ
- [ ] اختيار سبب وإرسال
- [ ] رسالة نجاح تظهر
- [ ] التقرير يظهر في قاعدة البيانات

### 4. Block System (نظام الحظر)
- [ ] فتح profile مستخدم آخر
- [ ] قائمة 3 نقاط تظهر
- [ ] خيار "Block User" موجود
- [ ] Confirmation dialog يظهر
- [ ] بعد التأكيد، المحتوى يختفي
- [ ] المستخدم المحظور لا يظهر في Feed

### 5. Authentication (المصادقة)
- [ ] تسجيل دخول بـ Email
- [ ] تسجيل دخول بـ Google
- [ ] تسجيل دخول بـ Apple (إذا متاح)
- [ ] تسجيل خروج
- [ ] تسجيل دخول مرة أخرى

### 6. Home Screen (الشاشة الرئيسية)
- [ ] المباريات تظهر بشكل صحيح
- [ ] Live scores تتحدث
- [ ] Predictions تعمل
- [ ] Coins تتحدث بعد التوقع

### 7. Matches Screen (شاشة المباريات)
- [ ] قائمة المباريات تظهر
- [ ] Filters تعمل (Live, Upcoming, Finished)
- [ ] Match details تفتح
- [ ] Predictions تعمل

### 8. Quiz Screen (شاشة الكويز)
- [ ] Daily quiz يظهر
- [ ] الأسئلة تظهر بشكل صحيح
- [ ] الإجابات تسجل
- [ ] Coins تضاف بعد الإجابة الصحيحة
- [ ] Leaderboard يظهر

### 9. Reels Screen (شاشة الريلز)
- [ ] Reels تظهر
- [ ] Video playback يعمل
- [ ] Like/Comment يعمل
- [ ] Share يعمل
- [ ] Upload reel يعمل

### 10. Profile Screen (شاشة البروفايل)
- [ ] Profile info يظهر
- [ ] Edit profile يعمل
- [ ] Upload photo يعمل
- [ ] Stats تظهر بشكل صحيح
- [ ] Settings تفتح

### 11. Settings Screen (شاشة الإعدادات)
- [ ] Language change يعمل
- [ ] Theme change يعمل (إذا متاح)
- [ ] Notifications settings تعمل
- [ ] Privacy settings تعمل
- [ ] Logout يعمل

### 12. Notifications (الإشعارات)
- [ ] Push notifications تصل
- [ ] Notification tap يفتح الشاشة الصحيحة
- [ ] Notification badge يظهر

### 13. Performance (الأداء)
- [ ] التطبيق يفتح بسرعة
- [ ] Scrolling سلس
- [ ] No lag في الانتقال بين الشاشات
- [ ] Images تحمل بسرعة
- [ ] Videos تشتغل بدون تقطيع

### 14. Offline Mode (وضع Offline)
- [ ] قطع الإنترنت
- [ ] رسالة "No internet" تظهر
- [ ] Cached data يظهر
- [ ] إعادة الاتصال تعمل تلقائياً

### 15. Error Handling (معالجة الأخطاء)
- [ ] Server error يظهر رسالة واضحة
- [ ] Network error يظهر رسالة واضحة
- [ ] Retry button يعمل
- [ ] Error boundaries تعمل

---

## 🐛 تسجيل المشاكل

إذا وجدت أي مشكلة، سجلها بهذا الشكل:

```markdown
### المشكلة: [وصف قصير]

**الخطوات:**
1. [خطوة 1]
2. [خطوة 2]
3. [خطوة 3]

**النتيجة المتوقعة:**
[ما كان يجب أن يحدث]

**النتيجة الفعلية:**
[ما حدث بالفعل]

**Screenshots:**
[إذا متاح]

**Device Info:**
- Model: [مثلاً: Samsung Galaxy S21]
- Android Version: [مثلاً: Android 13]
- App Version: 1.0.1
```

---

## 📊 نموذج تقرير الاختبار

```markdown
# Android Testing Report
Date: [التاريخ]
Tester: [الاسم]
Device: [الموديل]
Android Version: [الإصدار]

## Test Results

### EULA Flow: ✅ / ❌
Notes: [ملاحظات]

### Content Filter: ✅ / ❌
Notes: [ملاحظات]

### Report System: ✅ / ❌
Notes: [ملاحظات]

### Block System: ✅ / ❌
Notes: [ملاحظات]

### Authentication: ✅ / ❌
Notes: [ملاحظات]

### Home Screen: ✅ / ❌
Notes: [ملاحظات]

### Matches Screen: ✅ / ❌
Notes: [ملاحظات]

### Quiz Screen: ✅ / ❌
Notes: [ملاحظات]

### Reels Screen: ✅ / ❌
Notes: [ملاحظات]

### Profile Screen: ✅ / ❌
Notes: [ملاحظات]

### Settings Screen: ✅ / ❌
Notes: [ملاحظات]

### Notifications: ✅ / ❌
Notes: [ملاحظات]

### Performance: ✅ / ❌
Notes: [ملاحظات]

### Offline Mode: ✅ / ❌
Notes: [ملاحظات]

### Error Handling: ✅ / ❌
Notes: [ملاحظات]

## Overall Status
- [ ] Ready for TestFlight
- [ ] Needs fixes

## Critical Issues
[قائمة المشاكل الحرجة]

## Minor Issues
[قائمة المشاكل البسيطة]

## Recommendations
[توصيات للتحسين]
```

---

## 🔧 الأوامر المفيدة

```bash
# تحقق من حالة البناء
npx eas-cli build:list

# إلغاء بناء
npx eas-cli build:cancel

# عرض logs
npx eas-cli build:view [build-id]

# تحميل APK مباشرة
npx eas-cli build:download [build-id]
```

---

## ⚠️ ملاحظات مهمة

1. **TypeScript Errors:** في أخطاء TypeScript لكن مش هتأثر على البناء
2. **Build Time:** البناء بياخد 20-30 دقيقة
3. **APK Size:** الحجم المتوقع: 50-80 MB
4. **Testing:** اختبر على أكتر من جهاز إذا ممكن
5. **Internet:** تأكد من اتصال إنترنت قوي أثناء البناء

---

## ✅ الخطوات التالية

بعد الاختبار الناجح:
1. إصلاح أي مشاكل وجدتها
2. بناء نسخة iOS للـ TestFlight
3. اختبار على iOS
4. التقديم إلى App Store

---

**آخر تحديث:** 4 أبريل 2026  
**الحالة:** جاهز للبناء
