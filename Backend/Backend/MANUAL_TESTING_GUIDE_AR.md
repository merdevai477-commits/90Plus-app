# 📱 دليل الاختبار اليدوي
## Apple UGC Compliance - Manual Testing

**الهدف:** التحقق من عمل جميع الميزات قبل التقديم إلى App Store

---

## 🧪 الاختبارات المطلوبة

### 1. EULA Flow Test

**الخطوات:**
1. احذف التطبيق من الجهاز (إذا كان مثبتاً)
2. ثبت التطبيق من جديد
3. افتح التطبيق
4. **النتيجة المتوقعة:** ظهور شاشة EULA
5. حاول الضغط على "Agree" بدون scroll
6. **النتيجة المتوقعة:** الزر غير فعال
7. اعمل scroll للأسفل
8. **النتيجة المتوقعة:** تفعيل زر "Agree"
9. اضغط "Agree"
10. **النتيجة المتوقعة:** الدخول للتطبيق

**سجل هذا الفيديو على جهاز iOS فعلي!**

---

### 2. Content Filter Test

**Test 1: محتوى نظيف**
```bash
POST /api/reels
{
  "videoUrl": "https://example.com/video.mp4",
  "caption": "Hello this is a clean post"
}
```
**النتيجة المتوقعة:** 200/201 - نجاح

**Test 2: محتوى مسيء (English)**
```bash
POST /api/reels
{
  "videoUrl": "https://example.com/video.mp4",
  "caption": "you are a damn idiot"
}
```
**النتيجة المتوقعة:** 400 - رفض مع رسالة خطأ

**Test 3: محتوى مسيء (Arabic)**
```bash
POST /api/reels
{
  "videoUrl": "https://example.com/video.mp4",
  "caption": "انت غبي وحمار"
}
```
**النتيجة المتوقعة:** 400 - رفض مع رسالة خطأ

---

### 3. Report System Test

**الخطوات:**
1. افتح التطبيق
2. اذهب إلى Feed
3. اضغط long-press على reel
4. **النتيجة المتوقعة:** ظهور قائمة مع خيار "Report"
5. اضغط "Report"
6. **النتيجة المتوقعة:** ظهور modal مع أسباب الإبلاغ
7. اختر سبب (مثلاً: "Spam")
8. أضف تفاصيل إضافية (اختياري)
9. اضغط "Submit"
10. **النتيجة المتوقعة:** رسالة نجاح "Report submitted. We'll review it within 24 hours."

**تحقق من Backend:**
```bash
# افتح Prisma Studio
npx prisma studio

# تحقق من جدول Report
# يجب أن يظهر التقرير الجديد
```

**تحقق من Admin Notification:**
```bash
# افتح جدول Notification
# يجب أن يظهر إشعار للـ admin
```

**سجل هذا الفيديو على جهاز iOS فعلي!**

---

### 4. Block System Test

**الخطوات:**
1. افتح التطبيق
2. اذهب إلى profile مستخدم آخر
3. اضغط على قائمة 3 نقاط (⋮)
4. **النتيجة المتوقعة:** ظهور خيار "Block User"
5. اضغط "Block User"
6. **النتيجة المتوقعة:** ظهور confirmation dialog
7. اضغط "Confirm"
8. **النتيجة المتوقعة:** رسالة نجاح
9. ارجع إلى Feed
10. **النتيجة المتوقعة:** اختفاء جميع محتوى المستخدم المحظور

**تحقق من Backend:**
```bash
# افتح Prisma Studio
npx prisma studio

# تحقق من جدول Block
# يجب أن يظهر الحظر الجديد

# تحقق من جدول Report
# يجب أن يتم إنشاء report تلقائي
```

**سجل هذا الفيديو على جهاز iOS فعلي!**

---

### 5. Admin Panel Test

**الخطوات:**
1. أنشئ مستخدم admin:
```sql
UPDATE users 
SET role = 'ADMIN' 
WHERE email = 'your-email@example.com';
```

2. سجل دخول كـ admin

3. اختبر Admin Endpoints:

**Get Reports:**
```bash
GET /api/admin/reports
Authorization: Bearer <admin_token>
```
**النتيجة المتوقعة:** قائمة التقارير

**Review Report:**
```bash
POST /api/admin/reports/:id/review
Authorization: Bearer <admin_token>
{
  "action": "WARNING",
  "reason": "First violation"
}
```
**النتيجة المتوقعة:** 200 - نجاح

**Ban User:**
```bash
POST /api/admin/users/:id/ban
Authorization: Bearer <admin_token>
{
  "reason": "Multiple violations"
}
```
**النتيجة المتوقعة:** 200 - نجاح

**تحقق من Ban:**
```bash
# حاول تسجيل دخول المستخدم المحظور
# النتيجة المتوقعة: 403 Forbidden
```

---

### 6. Cron Job Test

**الخطوات:**
1. أنشئ تقرير في قاعدة البيانات
2. غير `createdAt` ليكون قبل 21 ساعة:
```sql
UPDATE reports 
SET "createdAt" = NOW() - INTERVAL '21 hours'
WHERE id = 'report-id';
```

3. انتظر ساعة واحدة (أو شغل الـ cron job يدوياً)

4. **النتيجة المتوقعة:** إشعار للـ admin عن التقارير المعلقة

**تشغيل Cron Job يدوياً (للاختبار):**
```typescript
// في Backend console
import { AdminNotificationService } from './services/admin-notification.service';
await AdminNotificationService.notifyPendingReports();
```

---

## 🔍 نقاط التحقق المهمة

### EULA
- [ ] شاشة EULA تظهر للمستخدمين الجدد
- [ ] Scroll detection يعمل
- [ ] زر "Agree" يتفعل بعد الـ scroll
- [ ] لا يمكن الوصول للمحتوى بدون قبول EULA
- [ ] يتم حفظ القبول في قاعدة البيانات

### Content Filter
- [ ] الكلمات المسيئة (English) يتم رفضها
- [ ] الكلمات المسيئة (Arabic) يتم رفضها
- [ ] المحتوى النظيف يتم قبوله
- [ ] رسالة خطأ واضحة عند الرفض

### Report System
- [ ] زر Report موجود على جميع المحتوى
- [ ] Modal يظهر مع أسباب الإبلاغ
- [ ] يتم إنشاء Report في قاعدة البيانات
- [ ] Admin يتلقى إشعار فوري
- [ ] رسالة نجاح تظهر للمستخدم

### Block System
- [ ] زر Block موجود في profile
- [ ] Confirmation dialog يظهر
- [ ] المحتوى يختفي فوراً من Feed
- [ ] يتم إنشاء Block في قاعدة البيانات
- [ ] يتم إنشاء Report تلقائي
- [ ] Admin يتلقى إشعار

### Admin Panel
- [ ] Admin يمكنه رؤية جميع التقارير
- [ ] Admin يمكنه مراجعة التقارير
- [ ] Admin يمكنه ban المستخدمين
- [ ] Banned users يحصلون على 403
- [ ] Cron job يعمل للتقارير المعلقة

---

## 📊 Test Results Template

استخدم هذا Template لتوثيق نتائج الاختبارات:

```markdown
# Manual Testing Results
Date: [التاريخ]
Tester: [الاسم]

## EULA Flow
- [ ] Test passed
- [ ] Video recorded
- Issues: [إذا وجدت]

## Content Filter
- [ ] English profanity blocked
- [ ] Arabic profanity blocked
- [ ] Clean content accepted
- Issues: [إذا وجدت]

## Report System
- [ ] Report button visible
- [ ] Report submitted successfully
- [ ] Admin notified
- [ ] Video recorded
- Issues: [إذا وجدت]

## Block System
- [ ] Block button visible
- [ ] User blocked successfully
- [ ] Content removed from feed
- [ ] Admin notified
- [ ] Video recorded
- Issues: [إذا وجدت]

## Admin Panel
- [ ] Reports list working
- [ ] Review working
- [ ] Ban working
- [ ] Banned user gets 403
- Issues: [إذا وجدت]

## Cron Job
- [ ] Pending reports alert working
- Issues: [إذا وجدت]

## Overall Status
- [ ] All tests passed
- [ ] Ready for submission
```

---

## 🎥 Screen Recording Tips

### للحصول على أفضل تسجيل:

1. **استخدم جهاز iOS فعلي** (ليس simulator)
2. **نظف الشاشة** قبل التسجيل
3. **أغلق الإشعارات** لتجنب التشتيت
4. **استخدم وضع Portrait** (عمودي)
5. **تأكد من الإضاءة الجيدة**
6. **تحدث ببطء** أثناء التسجيل (اختياري)
7. **أظهر كل خطوة بوضوح**
8. **لا تسرع** - خذ وقتك

### كيفية التسجيل على iOS:

1. افتح Control Center
2. اضغط على زر التسجيل (⏺)
3. انتظر 3 ثوان
4. ابدأ الاختبار
5. عند الانتهاء، اضغط على الشريط الأحمر في الأعلى
6. اضغط "Stop"

---

## ✅ Checklist النهائي

قبل التقديم، تأكد من:

- [ ] جميع الاختبارات اليدوية ناجحة
- [ ] 3 فيديوهات مسجلة على iOS
- [ ] الفيديوهات واضحة وتظهر جميع الخطوات
- [ ] جميع الاختبارات الآلية ناجحة (17/17)
- [ ] قاعدة البيانات تحتوي على البيانات الصحيحة
- [ ] Admin notifications تعمل
- [ ] Cron jobs تعمل
- [ ] Documentation كاملة

---

**جاهز للتقديم!** 🚀

