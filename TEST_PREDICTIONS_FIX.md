# اختبار إصلاح التوقعات

## الهدف
التحقق من أن التوقعات لا تظهر كخاطئة قبل انتهاء المباراة.

## خطوات الاختبار

### 1. اختبار Backend (API)

#### A. إنشاء توقع جديد
```bash
# استبدل TOKEN بـ Clerk token الخاص بك
curl -X POST https://90plus-app-production.up.railway.app/api/api/predictions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiMatchId": "1234567",
    "predictionType": "home",
    "homeTeam": "Manchester United",
    "awayTeam": "Liverpool",
    "homeTeamLogo": "https://example.com/logo1.png",
    "awayTeamLogo": "https://example.com/logo2.png",
    "matchDate": "2026-01-20T15:00:00Z",
    "leagueName": "Premier League"
  }'
```

**النتيجة المتوقعة**:
```json
{
  "success": true,
  "data": {
    "prediction": {
      "id": "...",
      "userId": "...",
      "apiMatchId": 1234567,
      "predictionType": "home",
      "coinsSpent": 5,
      "isCorrect": null,  // ✅ يجب أن يكون null
      "createdAt": "...",
      "homeTeam": "Manchester United",
      "awayTeam": "Liverpool"
    },
    "newBalance": 95,
    "remaining": 9
  },
  "message": "تم تسجيل توقعك بنجاح! 🎯"
}
```

#### B. التحقق من التوقعات المعلقة
```bash
curl https://90plus-app-production.up.railway.app/api/api/predictions/unresolved
```

**النتيجة المتوقعة**:
```json
{
  "success": true,
  "data": {
    "totalUnresolved": 5,
    "uniqueMatches": 3,
    "matchIds": [1234567, 7654321, 9876543],
    "predictions": [
      {
        "id": "...",
        "apiMatchId": 1234567,
        "predictionType": "home",
        "homeTeam": "Manchester United",
        "awayTeam": "Liverpool",
        "matchDate": "2026-01-20T15:00:00.000Z",
        "createdAt": "2026-01-18T10:30:00.000Z"
      }
    ]
  }
}
```

#### C. التحقق من توقعات المستخدم
```bash
curl https://90plus-app-production.up.railway.app/api/api/predictions/user \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**النتيجة المتوقعة**:
```json
{
  "success": true,
  "data": {
    "predictions": [
      {
        "id": "...",
        "userId": "...",
        "apiMatchId": 1234567,
        "predictionType": "home",
        "coinsSpent": 5,
        "coinsWon": null,
        "isCorrect": null,  // ✅ يجب أن يكون null
        "createdAt": "...",
        "resolvedAt": null
      }
    ],
    "predictionsMap": {
      "1234567": {
        "id": "...",
        "prediction": {
          "type": "home",
          "homeScore": 0,
          "awayScore": 0
        },
        "coinsSpent": 5,
        "coinsWon": null,
        "isCorrect": null,  // ✅ يجب أن يكون null
        "createdAt": "..."
      }
    }
  }
}
```

### 2. اختبار Frontend (UI)

#### A. فتح تطبيق الموبايل
1. افتح التطبيق
2. اذهب إلى تاب "المباريات"
3. اسحب لأسفل إلى قسم "🎯 توقع نتائج المباريات"

#### B. إنشاء توقع جديد
1. اختر مباراة قادمة
2. اضغط على أحد الأزرار (فوز المضيف / تعادل / فوز الضيف)
3. تأكيد التوقع

**النتيجة المتوقعة**:
- ✅ يظهر alert "تم التوقع بنجاح! 🎯"
- ✅ الزر المختار يصبح ملون (أخضر/أصفر/أحمر)
- ✅ باقي الأزرار تصبح disabled
- ✅ **لا يظهر** بانر "توقع خاطئ ❌"
- ✅ يظهر "🎫 التكلفة: 5 كوبونات" (إذا لم يكن هناك توقع)

#### C. التحقق من حالة التوقع
1. اسحب الشاشة لأسفل (Pull to Refresh)
2. تحقق من أن التوقع لا يزال بدون بانر نتيجة

**النتيجة المتوقعة**:
- ✅ التوقع يظهر بدون بانر نتيجة
- ✅ الزر المختار لا يزال ملون
- ✅ لا يظهر "توقع خاطئ ❌"

### 3. اختبار حل التوقعات (Resolution)

#### A. محاكاة انتهاء مباراة (Manual Resolve)
```bash
# استبدل MATCH_ID بـ ID المباراة
curl -X POST https://90plus-app-production.up.railway.app/api/api/predictions/resolve/1234567
```

**النتيجة المتوقعة**:
```json
{
  "success": true,
  "message": "Resolved predictions for match 1234567 (2-1)"
}
```

#### B. التحقق من التوقع بعد الحل
```bash
curl https://90plus-app-production.up.railway.app/api/api/predictions/user \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**النتيجة المتوقعة**:
```json
{
  "success": true,
  "data": {
    "predictions": [
      {
        "id": "...",
        "isCorrect": true,  // ✅ أو false حسب النتيجة
        "coinsWon": 10,     // ✅ إذا كان صحيح
        "resolvedAt": "2026-01-18T15:00:00.000Z"
      }
    ]
  }
}
```

#### C. التحقق من UI بعد الحل
1. افتح التطبيق
2. اذهب إلى قسم التوقعات
3. ابحث عن المباراة المحلولة

**النتيجة المتوقعة**:
- ✅ يظهر بانر "✅ توقع صحيح! +10 كوبونات" (إذا كان صحيح)
- ✅ أو يظهر "❌ توقع خاطئ" (إذا كان خاطئ)
- ✅ الكوبونات تم تحديثها في الرصيد

### 4. اختبار PredictionWatcherService

#### A. التحقق من الخدمة تعمل
```bash
# في Backend logs على Railway
# ابحث عن:
# "🎯 Starting prediction watcher service..."
# "✅ Prediction watcher started (checking every 5 minutes)"
```

#### B. انتظار 5 دقائق
```bash
# بعد 5 دقائق، ابحث في logs عن:
# "🔍 Checking unresolved predictions..."
# "📊 Checking X matches with unresolved predictions..."
# "🏁 Match XXXXX is finished (2-1), resolving predictions..."
# "✅ Prediction check completed"
```

## السيناريوهات المختلفة

### سيناريو 1: توقع صحيح
1. المستخدم يتوقع "فوز المضيف"
2. المباراة تنتهي 2-1 للمضيف
3. `isCorrect = true`
4. المستخدم يحصل على +10 كوبونات
5. يظهر "✅ توقع صحيح! +10 كوبونات"

### سيناريو 2: توقع خاطئ
1. المستخدم يتوقع "تعادل"
2. المباراة تنتهي 2-1
3. `isCorrect = false`
4. لا يحصل على كوبونات
5. يظهر "❌ توقع خاطئ"

### سيناريو 3: مباراة لم تنتهي
1. المستخدم يتوقع "فوز الضيف"
2. المباراة لا تزال جارية (1H, HT, 2H)
3. `isCorrect = null`
4. **لا يظهر** بانر النتيجة
5. التوقع يبقى معلق

### سيناريو 4: مباراة ملغاة
1. المستخدم يتوقع "فوز المضيف"
2. المباراة تم إلغاؤها (CANC, PST)
3. `isCorrect = null`
4. التوقع يبقى معلق
5. (يمكن إضافة منطق لإرجاع الكوبونات لاحقاً)

## الأخطاء المحتملة

### خطأ 1: "Already predicted on this match"
**السبب**: المستخدم حاول التوقع على نفس المباراة مرتين  
**الحل**: هذا سلوك صحيح - لا يمكن تغيير التوقع

### خطأ 2: "Insufficient coins"
**السبب**: المستخدم ليس لديه 5 كوبونات  
**الحل**: المستخدم يحتاج لكسب المزيد من الكوبونات

### خطأ 3: "Daily prediction limit reached"
**السبب**: المستخدم وصل للحد اليومي (10 توقعات)  
**الحل**: انتظر حتى اليوم التالي

### خطأ 4: "Match not found" (عند الحل اليدوي)
**السبب**: Match ID غير موجود في API-Football  
**الحل**: تحقق من Match ID الصحيح

## معايير النجاح ✅

- [ ] التوقعات الجديدة تُنشأ مع `isCorrect: null`
- [ ] لا يظهر بانر النتيجة للتوقعات المعلقة
- [ ] يظهر بانر النتيجة فقط بعد حل التوقع
- [ ] الكوبونات تُمنح للتوقعات الصحيحة
- [ ] الإشعارات تُرسل بعد حل التوقعات
- [ ] PredictionWatcherService يعمل كل 5 دقائق
- [ ] التوقعات تُحل تلقائياً عند انتهاء المباريات

## الأدوات المساعدة

### قاعدة البيانات (PostgreSQL)
```sql
-- التحقق من التوقعات المعلقة
SELECT id, "apiMatchId", "predictionType", "isCorrect", "createdAt"
FROM predictions
WHERE "isCorrect" IS NULL
ORDER BY "createdAt" DESC
LIMIT 10;

-- التحقق من التوقعات المحلولة
SELECT id, "apiMatchId", "predictionType", "isCorrect", "coinsWon", "resolvedAt"
FROM predictions
WHERE "isCorrect" IS NOT NULL
ORDER BY "resolvedAt" DESC
LIMIT 10;

-- إحصائيات التوقعات
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN "isCorrect" IS NULL THEN 1 END) as pending,
  COUNT(CASE WHEN "isCorrect" = true THEN 1 END) as correct,
  COUNT(CASE WHEN "isCorrect" = false THEN 1 END) as incorrect
FROM predictions;
```

### Railway Logs
```bash
# مراقبة logs في الوقت الفعلي
railway logs --follow

# البحث عن logs التوقعات
railway logs | grep "prediction"
railway logs | grep "🎯"
```

---

**تاريخ الإنشاء**: 2026-01-18  
**الحالة**: 📝 جاهز للاختبار
