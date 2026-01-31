# 🍎 Apple Compliance Requirements - Implementation Guide

## 📌 Overview

Apple رفض التطبيق بسبب مشكلتين أساسيتين:

### 1️⃣ Guideline 5.1.1(v) - Account Deletion
**المشكلة**: التطبيق فيه إنشاء حساب لكن مافيش خاصية حذف الحساب

**الحل المطلوب**:
- ✅ إضافة زر "Delete Account" في Settings
- ✅ عملية حذف واضحة (أقل من 3 خطوات)
- ✅ تحذير المستخدم من فقدان البيانات
- ✅ تأكيد بالباسورد أو البصمة
- ✅ حذف دائم (مش مجرد تعطيل)
- ✅ إرسال إيميل تأكيد

### 2️⃣ Guideline 1.2 - User-Generated Content Moderation
**المشكلة**: التطبيق فيه محتوى من المستخدمين (Reels) لكن مافيش نظام moderation كامل

**الحل المطلوب**:
- ✅ Terms of Service (EULA) يظهر عند التسجيل
- ✅ سياسة واضحة ضد المحتوى المسيء
- ✅ نظام للإبلاغ عن المحتوى المخالف
- ✅ نظام لحظر المستخدمين المسيئين
- ✅ لوحة تحكم للمشرفين (Admin Dashboard)

---

## 📂 الملفات المُنشأة

تم إنشاء spec كامل في المجلد:
```
.kiro/specs/apple-compliance-requirements/
├── README.md                      # نظرة عامة
├── requirements.md                # المتطلبات التفصيلية
├── design.md                      # التصميم التقني
├── tasks.md                       # خطوات التنفيذ
├── terms-of-service-content.md    # نص شروط الخدمة
└── apple-response-template.md     # قالب الرد على Apple
```

---

## 🎯 الميزات المطلوب تنفيذها

### 1. Account Deletion (حذف الحساب)

#### Frontend:
- **AccountDeletionModal** - نافذة تأكيد الحذف (خطوتين)
  - الخطوة 1: تحذير + قائمة البيانات اللي هتتحذف
  - الخطوة 2: تأكيد بالباسورد/البصمة
- تحديث Settings screen بإضافة زر "Delete Account" (أحمر)

#### Backend:
- **AccountDeletionService** - خدمة حذف الحساب
  - `initiateAccountDeletion()` - بدء عملية الحذف
  - `permanentlyDeleteAccount()` - حذف نهائي بعد 30 يوم
  - `deleteUserData()` - حذف كل بيانات المستخدم
  - `deleteClerkUser()` - حذف حساب Clerk
- API Endpoint: `DELETE /api/users/me`
- Email confirmation

#### Database:
```sql
ALTER TABLE User ADD COLUMN isDeleted BOOLEAN DEFAULT false;
ALTER TABLE User ADD COLUMN deletedAt TIMESTAMP;
ALTER TABLE User ADD COLUMN scheduledDeletionAt TIMESTAMP;
```

---

### 2. Terms of Service (شروط الخدمة)

#### Frontend:
- **TermsOfServiceModal** - نافذة عرض الشروط
  - عرض نص الشروط (scrollable)
  - تفعيل زر Accept بعد القراءة للآخر
  - Checkbox للموافقة الصريحة
- إضافة الشروط في signup flow

#### Backend:
- **TermsService** - خدمة إدارة الشروط
  - `getLatestTerms()` - جلب آخر نسخة
  - `recordAcceptance()` - تسجيل الموافقة
  - `hasAcceptedLatestTerms()` - التحقق من الموافقة
- API Endpoints:
  - `GET /api/terms/latest`
  - `POST /api/terms/accept`

#### Database:
```sql
CREATE TABLE TermsAcceptance (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  version TEXT NOT NULL,
  acceptedAt TIMESTAMP DEFAULT NOW(),
  ipAddress TEXT,
  UNIQUE(userId, version)
);
```

---

### 3. Content Reporting (الإبلاغ عن المحتوى)

#### Frontend:
- **ReportContentModal** - نافذة الإبلاغ
  - اختيار السبب (Spam, Harassment, Inappropriate, etc.)
  - إضافة تفاصيل اختيارية
  - رسالة تأكيد
- إضافة زر Report في:
  - Reels (three-dot menu)
  - Comments (long-press menu)
  - User Profiles (three-dot menu)

#### Backend:
- تحسين **ModerationService**
  - `checkDuplicateReport()` - منع التكرار
  - `calculateReportPriority()` - حساب الأولوية
- API Endpoints:
  - `POST /api/reports/reel/:reelId`
  - `POST /api/reports/comment/:commentId`
  - `POST /api/reports/user/:userId`

---

### 4. User Blocking (حظر المستخدمين)

#### Frontend:
- **BlockedUsersScreen** - شاشة إدارة المحظورين
  - عرض قائمة المستخدمين المحظورين
  - زر Unblock لكل مستخدم
- إضافة زر Block في User Profiles
- إضافة "Blocked Users" في Settings

#### Backend:
- API Endpoints (موجودة بالفعل):
  - `POST /api/users/block/:userId`
  - `DELETE /api/users/block/:userId`
  - `GET /api/users/blocked`
- تحديث queries لتصفية المستخدمين المحظورين

---

## 📋 خطوات التنفيذ (Tasks)

### Phase 1: Database & Backend (3-4 أيام)
1. ✅ إنشاء migration للـ TermsAcceptance table
2. ✅ إضافة حقول الحذف للـ User model
3. ✅ إنشاء TermsService
4. ✅ إنشاء AccountDeletionService
5. ✅ تحسين ModerationService
6. ✅ إضافة API endpoints
7. ✅ كتابة Unit Tests

### Phase 2: Frontend (4-5 أيام)
8. ✅ إنشاء TermsOfServiceModal
9. ✅ إنشاء AccountDeletionModal
10. ✅ إنشاء ReportContentModal
11. ✅ إنشاء BlockedUsersScreen
12. ✅ تحديث Settings screen
13. ✅ إضافة الشروط في signup flow
14. ✅ إضافة أزرار Report و Block
15. ✅ إضافة الترجمات (EN, AR)

### Phase 3: Testing (2-3 أيام)
16. ✅ Unit Tests
17. ✅ Integration Tests
18. ✅ Manual Testing
19. ✅ Bug Fixes

### Phase 4: Deployment (1-2 أيام)
20. ✅ Deploy Backend to Railway
21. ✅ Build & Upload to TestFlight
22. ✅ Test on Real Device
23. ✅ Submit to Apple

---

## ⏱️ Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| Backend | 3-4 days | Database, Services, APIs |
| Frontend | 4-5 days | Components, Screens, Integration |
| Testing | 2-3 days | Unit, Integration, Manual |
| Deployment | 1-2 days | Railway, TestFlight, Apple |
| **Total** | **10-14 days** | |

---

## 🚀 كيفية البدء

### 1. مراجعة الـ Spec
```bash
# اقرأ المتطلبات
cat .kiro/specs/apple-compliance-requirements/requirements.md

# اقرأ التصميم
cat .kiro/specs/apple-compliance-requirements/design.md

# اقرأ المهام
cat .kiro/specs/apple-compliance-requirements/tasks.md
```

### 2. بدء التنفيذ
اتبع المهام بالترتيب في `tasks.md`:
- ابدأ بـ Phase 1 (Backend)
- ثم Phase 2 (Frontend)
- ثم Phase 3 (Testing)
- وأخيراً Phase 4 (Deployment)

### 3. الاختبار
- اختبر حذف الحساب من Settings
- اختبر قبول الشروط عند التسجيل
- اختبر الإبلاغ عن المحتوى
- اختبر حظر المستخدمين

### 4. النشر
- انشر Backend على Railway
- ارفع التطبيق على TestFlight
- قدم لـ Apple للمراجعة

---

## 📝 ملاحظات مهمة

### Account Deletion
- ⚠️ الحذف دائم ومش ممكن التراجع عنه
- ⏳ فترة سماح 30 يوم قبل الحذف النهائي
- 📧 إرسال إيميل تأكيد للمستخدم
- 🔐 تأكيد بالباسورد أو البصمة

### Terms of Service
- 📜 يجب الموافقة قبل إنشاء الحساب
- 🚫 سياسة صفر تسامح مع المحتوى المسيء
- 📱 متاح في Settings في أي وقت
- 🔢 تتبع نسخة الشروط المقبولة

### Content Moderation
- 🚨 نظام Strikes (3 تحذيرات → إيقاف 7 أيام)
- 🤖 حذف تلقائي للمحتوى المبلغ عنه بكثرة
- 👮 لوحة تحكم للمشرفين (اختياري في v1)
- ⏱️ مراجعة البلاغات خلال 24 ساعة

---

## 🎯 معايير النجاح

- ✅ معدل إتمام حذف الحساب > 95%
- ✅ معدل نجاح الإبلاغ > 98%
- ✅ وقت استجابة المشرفين < 24 ساعة
- ✅ موافقة Apple App Store

---

## 📞 الدعم

للأسئلة أو المشاكل:
- Email: merdevai477@gmail.com
- Spec Location: `.kiro/specs/apple-compliance-requirements/`

---

## ✅ الخطوة التالية

**جاهز للبدء؟**

قل لي أي phase عايز تبدأ فيها:
1. **Phase 1**: Backend (Database + Services + APIs)
2. **Phase 2**: Frontend (Components + Screens)
3. **Phase 3**: Testing
4. **Phase 4**: Deployment

أو لو عايز تشتغل على task معين، قل لي رقم الـ task من `tasks.md`!

---

**Status**: 🟢 Spec Complete - Ready for Implementation  
**Priority**: 🔴 Critical (Blocking Apple Approval)  
**Estimated Time**: 10-14 days

