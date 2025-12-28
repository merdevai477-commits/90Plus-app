# نظام إشعارات المباريات المفضلة ⚽🔔

## نظرة عامة
نظام متكامل لمراقبة المباريات المفضلة وإرسال إشعارات فورية عن جميع الأحداث المهمة (أهداف، بطاقات، ركلات جزاء).

## كيف يعمل النظام؟

### 1. تفضيل المباراة (Favorite Match)
- المستخدم يضغط على النجمة ⭐ في أي مباراة (Home Screen أو Leagues Screen)
- يتم حفظ ID المباراة في AsyncStorage
- المباراة تظهر في أول القائمة

### 2. المراقبة التلقائية (Auto Monitoring)
- النظام يعمل تلقائياً في الخلفية كل 45 ثانية
- يفحص فقط المباريات المفضلة التي تكون LIVE
- يتوقف عن العمل عندما يكون التطبيق في الخلفية (لتوفير البطارية)

### 3. اكتشاف الأحداث الجديدة
- يقارن الأحداث الحالية مع آخر snapshot محفوظ
- يكتشف الأحداث الجديدة فقط (لا يرسل إشعارات مكررة)
- يحفظ snapshot جديد بعد كل فحص

### 4. الإشعارات
- يتم إنشاء إشعار لكل حدث جديد
- الإشعارات تظهر في صفحة Notifications
- أنواع الإشعارات:
  - ⚽ **هدف** (Goal) - نوع: success - لون أخضر
  - 🟥 **طرد** (Red Card) - نوع: error - لون أحمر
  - 🟨 **إنذار** (Yellow Card) - نوع: warning - لون أصفر
  - 🎯 **ركلة جزاء** (Penalty) - نوع: info - لون أزرق

## الملفات الرئيسية

### 1. Storage Layer
- **`src/storage/matchFavorites.storage.ts`**
  - حفظ/حذف/قراءة المباريات المفضلة
  - استخدام AsyncStorage

- **`src/storage/matchEventStorage.ts`**
  - حفظ snapshots للأحداث
  - مقارنة الأحداث القديمة بالجديدة

### 2. Service Layer
- **`src/services/matchEventMonitor.ts`**
  - فحص المباريات وجلب الأحداث من API
  - تحويل الأحداث إلى format موحد
  - اكتشاف الأحداث الجديدة

### 3. Hook Layer
- **`src/hooks/useMatchEventsMonitor.ts`**
  - React Hook للمراقبة التلقائية
  - إدارة الـ polling interval
  - التعامل مع app state (foreground/background)

### 4. Store Layer
- **`src/store/home.store.ts`**
  - Zustand store لإدارة الحالة
  - إضافة الإشعارات
  - إدارة المباريات المفضلة

### 5. UI Layer
- **`app/notifications.tsx`**
  - صفحة عرض الإشعارات
  - تصميم مميز لكل نوع حدث
  - زر "مسح الكل"

- **`components/Home/MatchList.tsx`**
  - عرض المباريات مع زر النجمة
  - animation عند الضغط على النجمة

## سير العمل (Workflow)

```
1. User clicks ⭐ on match
   ↓
2. Match ID saved to AsyncStorage
   ↓
3. useMatchEventsMonitor starts monitoring
   ↓
4. Every 45 seconds:
   - Get favorited IDs
   - Check which are LIVE
   - Fetch events from API
   - Compare with last snapshot
   - Detect new events
   ↓
5. For each new event:
   - Format notification
   - Add to notifications store
   - Show in Notifications screen
```

## الإعدادات

### Polling Interval
```typescript
const POLLING_INTERVAL = 45000; // 45 seconds
```
يمكن تغييره في `src/hooks/useMatchEventsMonitor.ts`

### أنواع الأحداث المراقبة
- ⚽ Goals (عادي، penalty، own goal)
- 🟥 Red Cards
- 🟨 Yellow Cards (اختياري - قد يكون كثير)
- 🎯 Penalties

## التحسينات المستقبلية

### 1. Push Notifications
- إضافة Expo Notifications
- إرسال push notifications حتى لو التطبيق مغلق

### 2. Sound & Vibration
- صوت مميز لكل نوع حدث
- اهتزاز عند الأهداف

### 3. Notification Settings
- السماح للمستخدم باختيار أنواع الأحداث
- تفعيل/تعطيل الإشعارات لكل مباراة

### 4. Rich Notifications
- صور اللاعبين
- فيديو الهدف (إن وجد)
- إحصائيات المباراة

### 5. Match Summary
- إشعار بملخص المباراة عند النهاية
- النتيجة النهائية + أهم الأحداث

## استكشاف الأخطاء

### المشكلة: الإشعارات لا تظهر
**الحل:**
1. تأكد أن المباراة مفضلة (النجمة ملونة)
2. تأكد أن المباراة LIVE
3. افتح Console وشوف الـ logs:
   - `⭐ Found X favorited match(es)`
   - `🔴 Monitoring X LIVE favorited match(es)`
   - `🔔 New notification added`

### المشكلة: إشعارات مكررة
**الحل:**
- تأكد أن الـ snapshot بيتحفظ بشكل صحيح
- امسح الـ AsyncStorage وابدأ من جديد

### المشكلة: البطارية تستهلك بسرعة
**الحل:**
- زود الـ POLLING_INTERVAL لـ 60 ثانية
- قلل عدد المباريات المفضلة
- النظام بيتوقف تلقائياً في الخلفية

## الخلاصة

✅ النظام شغال 100%
✅ يراقب المباريات المفضلة فقط
✅ يرسل إشعارات للأحداث الجديدة فقط
✅ يتوقف في الخلفية لتوفير البطارية
✅ تصميم جميل ومنظم للإشعارات

---

**تم التطوير بواسطة:** Kiro AI Assistant
**التاريخ:** 2024
**الحالة:** ✅ جاهز للاستخدام
