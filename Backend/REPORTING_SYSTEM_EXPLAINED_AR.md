# 🚨 نظام البلاغات (Reporting System) - شرح كامل

## 📋 نظرة عامة

نظام البلاغات في 90Plus يسمح للمستخدمين بالإبلاغ عن المحتوى المخالف (ريلز، تعليقات، مستخدمين) ويساعد الإدارة في مراجعة ومعالجة هذه البلاغات.

---

## 🗄️ قاعدة البيانات (Database Schema)

### جدول Report

```prisma
model Report {
  id                String         @id @default(uuid())
  reporterId        String         // المستخدم الذي أبلغ
  reportedUserId    String?        // المستخدم المبلغ عنه
  reportedReelId    String?        // الريل المبلغ عنه
  reportedCommentId String?        // التعليق المبلغ عنه
  type              ReportType     // نوع البلاغ
  reason            String         // السبب التفصيلي
  status            ReportStatus   // حالة البلاغ
  priority          ReportPriority // أولوية المراجعة
  reviewedBy        String?        // المراجع (admin)
  reviewedAt        DateTime?      // وقت المراجعة
  action            ReportAction   // الإجراء المتخذ
  isDuplicate       Boolean        // هل هو بلاغ مكرر؟
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### أنواع البلاغات (ReportType)

```typescript
enum ReportType {
  SPAM              // سبام / محتوى متكرر
  HARASSMENT        // تحرش / إساءة
  INAPPROPRIATE     // محتوى غير لائق
  FAKE_INFO         // معلومات مضللة
  COPYRIGHT         // انتهاك حقوق النشر
  OTHER             // أسباب أخرى
}
```

### حالات البلاغ (ReportStatus)

```typescript
enum ReportStatus {
  PENDING   // قيد الانتظار (جديد)
  REVIEWED  // تمت المراجعة
  RESOLVED  // تم الحل
  REJECTED  // مرفوض (بلاغ كاذب)
}
```

### أولويات البلاغ (ReportPriority)

```typescript
enum ReportPriority {
  LOW       // منخفضة
  MEDIUM    // متوسطة (افتراضي)
  HIGH      // عالية
  CRITICAL  // حرجة (تحتاج تدخل فوري)
}
```

### الإجراءات المتخذة (ReportAction)

```typescript
enum ReportAction {
  NO_ACTION         // لا إجراء (بلاغ كاذب)
  WARNING           // تحذير للمستخدم
  CONTENT_REMOVED   // حذف المحتوى
  USER_SUSPENDED    // تعليق المستخدم
  USER_BANNED       // حظر المستخدم
}
```

---

## 🔌 API Endpoints الموجودة حالياً

### 1. الإبلاغ عن ريل

```http
POST /api/reports/reel/:reelId
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "spam",           // spam, harassment, inappropriate, violence, hate, copyright, other
  "additionalInfo": "وصف تفصيلي للمشكلة"
}
```

**Response:**
```json
{
  "status": "SUCCESS",
  "message": "Report submitted successfully"
}
```

### 2. الإبلاغ عن تعليق

```http
POST /api/reports/comment/:commentId
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "harassment",
  "additionalInfo": "تعليق مسيء"
}
```

**Response:**
```json
{
  "status": "SUCCESS",
  "message": "Report submitted successfully"
}
```

---

## 🎯 كيف يعمل النظام حالياً؟

### 1. المستخدم يبلغ عن محتوى

```typescript
// في الفرونت إند (React Native)
const reportReel = async (reelId: string, reason: string) => {
  try {
    const response = await fetch(`${API_URL}/api/reports/reel/${reelId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: 'spam',
        additionalInfo: 'هذا الفيديو سبام'
      })
    });
    
    const data = await response.json();
    Alert.alert('تم', 'تم إرسال البلاغ بنجاح');
  } catch (error) {
    Alert.alert('خطأ', 'فشل إرسال البلاغ');
  }
};
```

### 2. البلاغ يُحفظ في قاعدة البيانات

```typescript
// في الباك إند
await prisma.report.create({
  data: {
    reporterId: user.id,           // من أبلغ
    reportedReelId: reelId,        // الريل المبلغ عنه
    reportedUserId: reel.userId,   // صاحب الريل
    type: 'SPAM',                  // نوع البلاغ
    reason: 'هذا الفيديو سبام',    // السبب
    status: 'PENDING',             // قيد الانتظار
    priority: 'MEDIUM',            // أولوية متوسطة
  }
});
```

### 3. الإدارة تراجع البلاغات

```typescript
// Admin Dashboard (لاحقاً)
GET /api/admin/reports?status=PENDING&priority=HIGH
```

### 4. الإدارة تتخذ إجراء

```typescript
// Admin Action
PUT /api/admin/reports/:reportId/resolve
{
  "action": "CONTENT_REMOVED",
  "reason": "محتوى مخالف"
}
```

---

## 🚀 ما هو موجود الآن؟

### ✅ موجود ويعمل:

1. **جدول Report في قاعدة البيانات** ✅
2. **API لإبلاغ عن ريل** ✅
3. **API لإبلاغ عن تعليق** ✅
4. **نظام الحالات والأولويات** ✅
5. **ربط البلاغ بالمستخدم والمحتوى** ✅

### ❌ غير موجود (يحتاج تطوير):

1. **واجهة المستخدم (UI) في الفرونت إند** ❌
   - زر Report في الريلز
   - زر Report في التعليقات
   - نموذج اختيار سبب البلاغ
   - صفحة بلاغاتي

2. **Admin Dashboard** ❌
   - صفحة مراجعة البلاغات
   - فلترة حسب الحالة والأولوية
   - اتخاذ إجراءات (حذف، تحذير، حظر)
   - إحصائيات البلاغات

3. **الإبلاغ عن مستخدم** ❌
   - API لإبلاغ عن مستخدم مباشرة
   - أسباب خاصة بالمستخدمين

4. **نظام الإشعارات** ❌
   - إشعار للإدارة عند بلاغ جديد
   - إشعار للمستخدم عند اتخاذ إجراء

5. **Auto-Moderation Rules** ❌
   - حذف تلقائي بعد 3 بلاغات
   - تعليق تلقائي بعد 5 بلاغات
   - كشف البلاغات المكررة

---

## 🎨 كيف يبدو في الفرونت إند؟

### 1. زر Report في الريل

```typescript
// في ReelCard.tsx
<TouchableOpacity onPress={() => setShowReportModal(true)}>
  <Icon name="flag" size={24} color="#FF3B30" />
</TouchableOpacity>

<ReportModal
  visible={showReportModal}
  contentType="reel"
  contentId={reel.id}
  onClose={() => setShowReportModal(false)}
/>
```

### 2. نموذج البلاغ (ReportModal)

```typescript
// ReportModal.tsx
const reportReasons = [
  { id: 'spam', label: 'سبام', icon: '🚫' },
  { id: 'harassment', label: 'تحرش', icon: '⚠️' },
  { id: 'inappropriate', label: 'محتوى غير لائق', icon: '🔞' },
  { id: 'violence', label: 'عنف', icon: '⚔️' },
  { id: 'hate', label: 'خطاب كراهية', icon: '💢' },
  { id: 'copyright', label: 'حقوق نشر', icon: '©️' },
  { id: 'other', label: 'أخرى', icon: '❓' },
];

return (
  <Modal visible={visible}>
    <View>
      <Text>لماذا تريد الإبلاغ عن هذا المحتوى؟</Text>
      
      {reportReasons.map(reason => (
        <TouchableOpacity
          key={reason.id}
          onPress={() => setSelectedReason(reason.id)}
        >
          <Text>{reason.icon} {reason.label}</Text>
        </TouchableOpacity>
      ))}
      
      <TextInput
        placeholder="وصف تفصيلي (اختياري)"
        value={additionalInfo}
        onChangeText={setAdditionalInfo}
        multiline
      />
      
      <Button
        title="إرسال البلاغ"
        onPress={handleSubmitReport}
      />
    </View>
  </Modal>
);
```

### 3. صفحة بلاغاتي

```typescript
// MyReportsScreen.tsx
GET /api/reports/my-reports

// عرض قائمة البلاغات التي أرسلها المستخدم
[
  {
    id: "...",
    type: "SPAM",
    status: "PENDING",
    createdAt: "2026-04-01",
    contentType: "reel",
    contentId: "..."
  }
]
```

---

## 🛡️ Admin Dashboard

### 1. صفحة مراجعة البلاغات

```typescript
// AdminReportsScreen.tsx
GET /api/admin/reports?status=PENDING&priority=HIGH

// عرض البلاغات مع:
- معلومات المبلغ
- المحتوى المبلغ عنه
- السبب
- الأولوية
- أزرار الإجراءات
```

### 2. اتخاذ إجراء

```typescript
// Admin Actions
PUT /api/admin/reports/:reportId/resolve
{
  "action": "CONTENT_REMOVED",
  "reason": "محتوى مخالف للشروط"
}

// الإجراءات المتاحة:
- NO_ACTION (رفض البلاغ)
- WARNING (تحذير)
- CONTENT_REMOVED (حذف المحتوى)
- USER_SUSPENDED (تعليق 7 أيام)
- USER_BANNED (حظر دائم)
```

---

## 🤖 Auto-Moderation Rules

### القواعد التلقائية المقترحة:

```typescript
// 1. حذف تلقائي بعد 3 بلاغات
if (reportCount >= 3) {
  await prisma.reel.update({
    where: { id: reelId },
    data: { isDeleted: true }
  });
}

// 2. تعليق تلقائي بعد 5 بلاغات على مستخدم
if (userReportCount >= 5) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isSuspended: true,
      suspendedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  });
}

// 3. كشف البلاغات المكررة
const existingReport = await prisma.report.findFirst({
  where: {
    reporterId: userId,
    reportedReelId: reelId,
    createdAt: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // آخر 24 ساعة
    }
  }
});

if (existingReport) {
  return { error: 'لقد أبلغت عن هذا المحتوى مسبقاً' };
}
```

---

## 📊 إحصائيات البلاغات

### Dashboard للإدارة:

```typescript
// GET /api/admin/reports/stats

{
  "total": 150,
  "pending": 45,
  "resolved": 90,
  "rejected": 15,
  "byType": {
    "SPAM": 60,
    "HARASSMENT": 30,
    "INAPPROPRIATE": 40,
    "COPYRIGHT": 10,
    "OTHER": 10
  },
  "byPriority": {
    "LOW": 50,
    "MEDIUM": 70,
    "HIGH": 25,
    "CRITICAL": 5
  },
  "topReportedUsers": [
    { userId: "...", username: "user1", reportCount: 12 },
    { userId: "...", username: "user2", reportCount: 8 }
  ]
}
```

---

## 🔔 نظام الإشعارات

### 1. إشعار للإدارة

```typescript
// عند بلاغ جديد
await createNotification({
  userId: adminId,
  type: 'MODERATION_ALERT',
  title: 'بلاغ جديد',
  message: `تم الإبلاغ عن ${contentType} بسبب ${reason}`,
  data: { reportId, contentId }
});
```

### 2. إشعار للمستخدم المبلغ عنه

```typescript
// عند اتخاذ إجراء
await createNotification({
  userId: reportedUserId,
  type: 'MODERATION_ALERT',
  title: 'تنبيه من الإدارة',
  message: 'تم حذف محتوى لمخالفته الشروط',
  data: { action, reason }
});
```

---

## 🎯 خطة التطوير المقترحة

### المرحلة 1: الفرونت إند الأساسي (أسبوع واحد)
1. ✅ زر Report في الريلز
2. ✅ زر Report في التعليقات
3. ✅ ReportModal مع الأسباب
4. ✅ صفحة "بلاغاتي"

### المرحلة 2: Admin Dashboard (أسبوعان)
1. ✅ صفحة مراجعة البلاغات
2. ✅ فلترة وبحث
3. ✅ اتخاذ إجراءات
4. ✅ إحصائيات

### المرحلة 3: Auto-Moderation (أسبوع واحد)
1. ✅ حذف تلقائي بعد 3 بلاغات
2. ✅ تعليق تلقائي بعد 5 بلاغات
3. ✅ كشف البلاغات المكررة
4. ✅ نظام الأولويات التلقائي

### المرحلة 4: الإشعارات (3 أيام)
1. ✅ إشعارات للإدارة
2. ✅ إشعارات للمستخدمين
3. ✅ Push notifications

---

## 💡 أفضل الممارسات

### 1. منع إساءة استخدام النظام

```typescript
// حد أقصى 5 بلاغات في اليوم
const todayReports = await prisma.report.count({
  where: {
    reporterId: userId,
    createdAt: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
    }
  }
});

if (todayReports >= 5) {
  return { error: 'لقد وصلت للحد الأقصى من البلاغات اليومية' };
}
```

### 2. حماية من البلاغات الكاذبة

```typescript
// تتبع دقة البلاغات
const userReportAccuracy = await calculateReportAccuracy(userId);

if (userReportAccuracy < 0.3) { // أقل من 30% دقة
  // تحذير أو تقييد
  await warnUser(userId, 'بلاغات كاذبة متكررة');
}
```

### 3. الشفافية مع المستخدمين

```typescript
// إشعار بنتيجة البلاغ
await createNotification({
  userId: reporterId,
  type: 'GENERAL',
  title: 'تحديث على بلاغك',
  message: 'تم مراجعة بلاغك واتخاذ الإجراء المناسب',
  data: { reportId, action }
});
```

---

## 🔗 الربط مع نظام Strikes

```typescript
// عند حذف محتوى بسبب بلاغ
await prisma.strike.create({
  data: {
    userId: reportedUserId,
    reportId: report.id,
    reportedReelId: reelId,
    strikeType: 'CONTENT_VIOLATION',
    reason: report.reason
  }
});

// تحديث عدد الإنذارات
await prisma.user.update({
  where: { id: reportedUserId },
  data: {
    warningsCount: { increment: 1 }
  }
});

// إذا وصل 3 إنذارات = تعليق
if (user.warningsCount >= 3) {
  await suspendUser(reportedUserId, 7); // 7 days
}
```

---

## 📝 الخلاصة

### ✅ ما هو موجود:
- قاعدة بيانات كاملة
- API للإبلاغ عن ريلز وتعليقات
- نظام الحالات والأولويات

### ❌ ما يحتاج تطوير:
- واجهة المستخدم (UI)
- Admin Dashboard
- Auto-Moderation
- الإشعارات

### 🎯 الأولوية:
1. **عالية:** واجهة المستخدم (زر Report + Modal)
2. **متوسطة:** Admin Dashboard
3. **منخفضة:** Auto-Moderation + الإشعارات

---

**هل تريد البدء في تطوير أي من هذه المكونات؟** 🚀
