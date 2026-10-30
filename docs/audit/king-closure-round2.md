# King closure — round 2 (read-only)

**وقت التحقق:** 2026-10-30 ≈ 12:00–12:05 UTC  
**قيود:** لا كتابة على Production، لا apply لـ re-settle، لا أسرار في الملف.  
**التصنيف:** CONFIRMED / LIKELY / UNVERIFIED.

---

## 1) Stale-NS pending

### الأعداد (SQL READ ONLY)

```sql
-- predictions pending + cached_fixtures.status='NS' + matchDate < now()-2 days
prediction_n = 14
match_n      = 9
```

| عمر منذ kickoff | predictions | matches |
|-----------------|-------------|---------|
| 2–7d | 0 | 0 |
| 7–30d | 8 | 3 |
| 30–90d | 0 | 0 |
| 90d+ | 6 | 6 |

**مصدر:** استعلام `default_transaction_read_only=on`، 2026-10-30T12:01Z.

### عينة 15 (كل المباريات التسع + تفاصيل)

| apiMatchId | pending | matchDate (DB) | days_past | كاش | فرق / دوري | API-Football الآن | مغطاة بالـ sweep؟ |
|------------|---------|----------------|-----------|-----|------------|-------------------|-------------------|
| 1546302 | 1 | 2026-06-01 | 150.9 | NS | Mosul–Al-Qasim / Iraqi | **UNVERIFIED** (حساب AF معلّق محلياً: `account is suspended`) | **لا** — أقدم من 24h |
| 1548304 | 1 | 2026-06-05 | 146.9 | NS | Sudani PL | UNVERIFIED (AF) | لا |
| 1548305 | 1 | 2026-06-05 | 146.9 | NS | Sudani PL | UNVERIFIED | لا |
| 1543891 | 1 | 2026-06-09 | 142.8 | NS | Brasileiro U17 | UNVERIFIED | لا |
| 4777619 | 1 | 2026-07-21 | 100.8 | NS | Club Friendlies | UNVERIFIED | لا |
| 4781374 | 1 | 2026-07-21 | 100.8 | NS | Club Friendlies | UNVERIFIED | لا |
| 4823092 | 1 | 2026-10-08 | 22.0 | NS | Uganda PL | UNVERIFIED | لا |
| 4803033 | 1 | 2026-10-22 | 7.8 | NS | Algeria Ligue 1 | UNVERIFIED | لا |
| 4803037 | 6 | 2026-10-22 | 7.8 | NS | Algeria Ligue 1 | UNVERIFIED | لا |

### هل الـ stale-NS sweep يغطيها؟

**CONFIRMED — لا تغطي أي صف من الـ 14.**

من `src/services/stale-ns-sweep.service.ts:55-66`:

- يختار فقط `status ∈ {NS,TBD}` و `matchDate` بين **now−24h** و **now−3h**.
- كل صفوف stale-NS ذات توقعات لها `matchDate` أقدم من يومين → خارج النافذة.
- استعلام مرافق: مباريات في نافذة الـ sweep وعليها توقعات pending = **0**؛ fixtures في النافذة بدون شرط توقعات ≈ 9–13 (يظهر في اللوج).

**لوج Railway:** `[StaleNsSweep] found=9..13 corrected=0 stillNs=...` كل 10 دقائق — الـ sweep **يعمل** لكنه يفشل في تصحيح تلك الصفوف من المزود (`corrected=0`).

**365 لهذه العينة:** لم يُستدعَ لكل الـ 9 (تكلفة/وقت). للصفوف ذات ids ≥4e6 غالباً native-365؛ الأقدم 154xxxx غالباً API-Football. **هل المزود يقول «انتهت»؟ UNVERIFIED** لهذا المرور بسبب تعليق مفتاح AF المحلي؛ الإنتاج ما زال يظهر `apiFootball.status=active` على `/api/health` لكن لم يُستعلم من السيرفر.

### اقتراح تسوية آمنة (بدون تنفيذ)

1. **Refresh إجباري** خارج نافذة 24h: نفس `forceRefreshFixtureNearKickoff` / loader التسوية لدفعة من `apiMatchId` المعلّقة NS و`matchDate < now()-2d`.  
2. مرّر الناتج على **`resolveSettlementInput` (نفس الـ gate)** — لا تسوية إلا FT/AET/PEN بدرجات صالحة.  
3. لو المزود ما زال NS/TBD بعد عمر كبير → مرشّح **VOID** (خلف `PREDICTION_VOID_ENABLED`) أو إبقاء pending بقرار منتج — **لا** افتراض فوز.  
4. لا backfill `isCorrect` من غير snapshot + قفل `settle_leases`.

---

## 2) تتبع 4730724 و 4870902

### 4730724 (Iveria 5–4 FC Betlemi Keda، David Kipiani Cup)

| مرحلة | الدليل | قيمة |
|-------|--------|------|
| لوج settle | Railway 00:17:09Z | `Match 4730724 is finished (5-4)` → resolving `(5-4, FT, winner=home)` → `SETTLE_COMPLETE` counts wrong=1؛ `SETTLE_PUSH_SUPPRESSED` |
| صف التوقّع | SQL | id `0b3c8a12-…`؛ `isCorrect=false`؛ `settledStatus=FT`؛ `settledWinner=home`؛ scores 5–4؛ `settledAt=2026-10-30 00:17:09.63`؛ pick=`away` |
| الكاش الآن | SQL | `status=NS`، scores null، `updatedAt=2026-07-11`، fullData short=NS |
| 365 live الآن | `fetchScores365GameById(4730724)` | statusId **154**؛ scores 5–4؛ `settlementSnapshot: { status: **AET**, home:5, away:4, pens null }` |

**تفسير (CONFIRMED جزئياً):**  
التسوية حفظت **FT** في audit fields؛ المصنّف الحالي لـ 365 يعطي **AET** لنفس النتيجة (After ET / statusId 154) — يتوافق مع إصلاح 0a90b3700 لكن **بعد** لحظة التسوية. الكاش لم يُحدَّث للنهائي وبقي/رُجِع NS منذ يوليو → انحراف عرض إن العميل يقرأ الكاش (E10).  

**إعادة استخدام الـ id؟** نفس الأسماء/الدوري/التاريخ في الكاش والتوقع — **LIKELY لا إعادة استخدام** لمباراة أخرى. لا دليل على fixtureId متنازع. AF live: UNVERIFIED (معلّق محلياً).

### 4870902 (AFC Léopard vs Bandari، Kenya PL)

| مصدر | حالة | نتيجة |
|------|------|--------|
| كاش DB | **ABD** / Match Abandoned | 0–0؛ `updatedAt=2026-10-14`؛ fullData short ما زال NS (قديم) |
| توقعات | صفّان `isCorrect IS NULL` | home + away؛ بدون settledAt |
| لوج settle السابق | 00:17:11Z `SETTLE_COMPLETE` FT 0-0 draw wrong=2 | ثم **أُرجعت** للـ pending (قرار revert سابق) |
| لوج الآن | كل ~2 دقائق | `SETTLE_SOURCE_CONFLICT` cachedStatus=ABD providerStatus=FT ثم `SETTLE_GATE_REJECTED` STATUS_NOT_SETTLEABLE ABD |
| 365 live | statusId **3**؛ snapshot **FT 0–0** | يطابق `providerStatus: FT` في اللوج |

**ليه الكاش ABD والمزود FT؟ (CONFIRMED بالكود+لوج)**  
`prediction-settlement-snapshot.ts:141-151`: لو الكاش في `NO_RESULT` (ABD/…) والمزود يعطي نهائي → **لا تُستبدل**؛ يُرجَع الكاش ويُسجَّل CONFLICT.  

**هل 0–0 حقيقي؟** 365 يقول FT 0–0 الآن — **LIKELY** من منظور 365؛ قد يكون تسجيل بعد هجر/إلغاء بمصدر مختلف. بدون مصدر ثالث (اتحاد كينيا / AF معلّق) = **UNVERIFIED** كحقيقة أرضية.

**هل يمكن إيقاف الـ conflict loop بـ backoff من غير تسوية؟**  
**نعم، تصميمياً (غير منفّذ).** حالياً لا backoff على CONFLICT — كل tick watcher يعيد المحاولة. اقتراح (بدون تنفيذ): بعد N تعارضات لنفس `apiMatchId` خلال 24h، تخطَّ الجلب/اللوج لعدة ساعات مع عدّاد؛ الإبقاء على ABD في الكاش وpending — **بدون** تسوية تلقائية.

---

## 3) Re-settle dry-run — قائمة الـ 53 wrongToCorrect

**مصدر الأعداد:** `scripts/reconcile-predictions.ts` @ 2026-10-30 (summary: wrongToCorrect=53، winner 37 + exact 16).  
**مكافآت الكود:** `CORRECT_PREDICTION_REWARD=10` (`prediction-resolver.service.ts:27`)؛ XP winner/exact = **1** لكلٍ (`xp.service.ts:22-23`).  
التقدير أدناه = `wrongToCorrect × 10` كوينز و `× 1` XP عند apply (Q3: فقط w2c). عمود **مصدر خارجي** للتحقق اليدوي.

| apiMatchId | الكاش (status score) | الفرق | w2c | c2w | est coins | est XP | مصدر خارجي |
|------------|----------------------|-------|-----|-----|-----------|--------|------------|
| 4847402 | FT 3–2 | Dortmund–Bremen DFB-Pokal | 18 | 0 | 180 | 18 | |
| 4755367 | FT 1–3 | Freiburg–Bayern | 9 | 1 | 90 | 9 | |
| 4632636 | FT 3–2 | Flamengo–Atlético-MG | 6 | 1 | 60 | 6 | |
| 4734212 | FT 3–3 | TOP Oss–Jong Ajax | 6 | 12 | 60 | 6 | |
| 4750812 | FT 1–2 | Valencia–Villarreal | 2 | 1 | 20 | 2 | |
| 4875608 | FT 3–2 | Shabab Al Ahly–Al Ain | 2 | 0 | 20 | 2 | |
| 4876002 | FT 0–1 | Damascus Al Ahli–Al Shorta | 2 | 0 | 20 | 2 | |
| 4789446 | FT 4–1 | Al Ahli–Al Khaleej | 1 | 1 | 10 | 1 | |
| 4732652 | FT 1–3 | Torino–Como | 1 | 1 | 10 | 1 | |
| 4869405 | FT 4–3 | Boston River–River Plate | 1 | 0 | 10 | 1 | |
| 4742036 | FT 0–2 | Everton–Chelsea | 1 | 0 | 10 | 1 | |
| 4742032 | FT 3–1 | Tottenham–Coventry | 1 | 0 | 10 | 1 | |
| 4728145 | FT 8–0 | Livingston–… | 1 | 0 | 10 | 1 | |
| 4663496 | FT 1–0 | Auda–Liepaja | 1 | 0 | 10 | 1 | |
| 4621261 | FT 2–2 | Inter Miami–Cincinnati | 1 | 0 | 10 | 1 | |
| **المجموع** | | | **53** | (جزئي) | **530** | **53** | |

(مجموع الصفوف في الجدول = 53 w2c. أي مباراة c2w تُسجَّل في dry-run ولا تُطبَّق.)

### الأمر الدقيق (تشغّله أنت — الـ token من env لديك فقط)

Dry-run افتراضي ما لم تمرّر `dryRun=0` (`predictions.routes.ts:734`).

PowerShell:

```powershell
# ADMIN_TOKEN = Clerk JWT لمستخدم admin (لا تلصقه في ملفات/شات)
$matchId = 4847402   # كرّر لكل apiMatchId من الجدول
Invoke-RestMethod -Method POST `
  -Uri "https://90plus.pro/api/predictions/admin/resettle/$matchId`?dryRun=1" `
  -Headers @{ Authorization = "Bearer $env:ADMIN_TOKEN" }
```

bash:

```bash
MATCH=4847402
curl -sS -X POST \
  "https://90plus.pro/api/predictions/admin/resettle/${MATCH}?dryRun=1" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Accept: application/json"
```

- **Path:** `POST /api/predictions/admin/resettle/:matchId`  
- **Query:** `dryRun=1` أو احذف المعامل (أي قيمة غير `0` = dry-run)  
- **Headers:** `Authorization: Bearer <admin JWT>` (+ `requireAdmin`)  
- **نجاح متوقع:** `{ success: true, data: { dryRun: true, counts, items, ... } }` بدون كتابة جداول resettle  
- **هذا المرور:** لم يُنفَّذ (لا ADMIN_TOKEN في بيئة المحقق) — **UNVERIFIED** كناتج endpoint حي

---

## 4) PEN — 365 live والركلات

استدعاء `fetchScores365GameById(..., { force: true })` + `settlementSnapshotFrom365Game` (قراءة فقط، بدون كتابة كاش).

| fixtureId | كاش DB | 365 live snapshot | حقل الركلات | ملاحظة |
|-----------|--------|-------------------|-------------|--------|
| **4857309** Fleetwood–Arsenal | PEN 1–1؛ penalty null/null | **PEN 1–1؛ penaltyHome=5 penaltyAway=3** | عبر `resolve365ExtraAndPenalty` (`penaltyScore` و/أو أحداث الركلات — `scores365-experiment.service.ts:2031-2146`) | **CONFIRMED** 365 يملك الركلات الآن؛ الكاش لم يلتقطها |
| **4858305** Man City–Brighton | PEN 2–2؛ pen null | **PEN 2–2؛ 4–3** | نفس المسار | CONFIRMED |
| **4857350** Palmeiras–Flu | PEN 0–1؛ pen null | **PEN 0–1؛ 5–3** | نفس المسار | CONFIRMED |
| **4761280** Toluca U19–Pumas | PEN؛ pen null | empty payload / retired | — | **CONFIRMED** لا بيانات 365 الآن |
| **1545586** AL Masry–Masr | PEN؛ **pen 6–5 في الكاش** | empty / retired | الكاش كافٍ للبوابة | CONFIRMED كاش؛ 365 غير متاح |

**خلاصة:** الثلاثية الكبرى **قابلة للحسم من 365 live اليوم** إن أُعيد تحميل الكاش/الـ snapshot قبل أي re-settle. الكاش الحالي وحده → `PEN_WINNER_UNKNOWN`.

### تصميم إدخال ركلات يدوي (بدون تنفيذ)

1. **Admin endpoint** مثلاً `POST /admin/resettle/:matchId/official-penalty` body: `{ home, away, sourceNote }` + requireAdmin.  
2. اكتب في جدول audit جديد أو حدّث `cached_fixtures.fullData.score.penalty` + علامة `officialOverrideAt` (additive).  
3. شغّل **نفس** `resettleMatchPredictions` / gate بعد الكتابة.  
4. ائتمان فقط `wrongToCorrect` بمفاتيح `prediction:{id}:resettle:coins` و `prediction:{id}:resettle` (موجودة).  
5. **دفتر عكسي لـ correctToWrong:** اختياري ومنفصل — خصم بمفتاح `prediction:{id}:clawback:coins` لمرة واحدة؛ الافتراض الحالي للمنتج = لا تلمس.  
6. Idempotency: unique على مفاتيح الائتمان/الخصم؛ لا apply مرتين لنفس run.

---

## 5) تأكيدات كود / بنية

| بند | الحكم | الدليل |
|-----|--------|--------|
| HTTP لـ CONFLICT بعد kickoff | **CONFIRMED = 409** | `ErrorCode.CONFLICT` → `ErrorStatus[E005]=409` (`src/constants/errors.ts:46`)؛ `sendError` يستخدم `ErrorStatus[code]` (`:85`)؛ مسار King: `predictions.routes.ts:103-104` يرسل `ErrorCode.CONFLICT` لـ `MATCH_STARTED` / … |
| numReplicas | **CONFIRMED = 1** | Railway `describe-service` → `multiRegionConfig.europe-west4-drams3a.numReplicas: 1` |
| مسار الكوينز يكتب `idempotencyKey` | **CONFIRMED بالاختبار**؛ **UNVERIFIED بإنتاج ناجح** | كود: `prediction-resolver.service.ts:281-297` يكتب `prediction:{id}:coins`. اختبار: `prediction-resolver.settle.test.ts` — «idempotency\|coin» → **1 passed** (`expect ... idempotencyKey`).toBe(`prediction:p7:coins`)؛ استدعاءان settle → `coinCreate` مرة واحدة. إنتاج: كل `coin_transactions.idempotencyKey` ما زالت null (لا settle صحيح بعد B7) |

---

## 6) Query جاهز لأول settle حي (FT فيها توقعات)

بعد ظهور `SETTLE_COMPLETE` في اللوج لـ `:matchId`، شغّل **READ ONLY**:

```sql
-- 1) صفوف المباراة بعد التسوية
SELECT id, "isCorrect", "settledStatus", "settledWinner",
       "settledHomeScore", "settledAwayScore",
       "settledAt", "resolvedAt", "coinsWon"
FROM predictions
WHERE "apiMatchId" = :matchId
ORDER BY "settledAt" NULLS LAST;

-- 2) مفاتيح الكوينز (يجب أن تظهر لأول مرة إذا وُجد فائز)
SELECT "idempotencyKey", amount, "userId", "createdAt"
FROM coin_transactions
WHERE "idempotencyKey" LIKE 'prediction:%:coins'
  AND "idempotencyKey" IN (
    SELECT 'prediction:' || id::text || ':coins' FROM predictions WHERE "apiMatchId" = :matchId
  );

-- 3) XP مرة واحدة
SELECT "idempotencyKey", amount, "userId", "createdAt"
FROM xp_transactions
WHERE "idempotencyKey" IN (
  SELECT 'prediction:' || id::text FROM predictions WHERE "apiMatchId" = :matchId
);

-- 4) لا تكرار
SELECT "idempotencyKey", COUNT(*) AS n
FROM coin_transactions
WHERE "idempotencyKey" LIKE 'prediction:%'
GROUP BY 1 HAVING COUNT(*) > 1;

-- 5) السجل vs الكاش (عرض)
SELECT p.id, p."isCorrect", p."settledHomeScore", p."settledAwayScore", p."settledStatus",
       cf.status AS cache_status, cf."homeScore", cf."awayScore"
FROM predictions p
JOIN cached_fixtures cf ON cf."fixtureId" = p."apiMatchId"
WHERE p."apiMatchId" = :matchId;
```

**نجاح متوقع:** `settledAt` غير null للصفوف التي كانت pending؛ لكل `isCorrect=true` صف كوينز بمفتاح `prediction:{id}:coins` وصف XP بمفتاح `prediction:{id}`؛ لا مفاتيح مكررة؛ إن اختلف الكاش عن settled* فالعرض السيرفري يعتمد على settled (Phase 4).

---

## ملخص تنفيذي سريع

1. **14** توقع stale-NS خارج نافذة الـ sweep (3h–24h) — الـ sweep حي لكنه لا يراها.  
2. **4730724** settled كـ FT في DB؛ 365 الآن AET 5–4؛ الكاش NS قديم.  
3. **4870902** CONFLICT متعمّد (ABD vs 365 FT 0–0)؛ backoff غير موجود.  
4. **ثلاث PEN كبيرة:** 365 live **يملك** الركلات الآن (5–3 / 4–3 / 5–3) بينما الكاش null — فرصة re-settle بعد refresh.  
5. Dry-run: أوامر جاهزة؛ قائمة 15 مباراة / 53 صف؛ لم تُنفَّذ هنا.  
6. **409** و **replicas=1** وكتابة idempotencyKey في الكود+unit test مؤكدة.

## غير مؤكد / يحتاج طرفاً آخر

- حالة API-Football الحية للمباريات (مفتاح محلي معلّق).  
- ناتج dry-run HTTP الفعلي (يحتاج ADMIN_TOKEN عندك).  
- هل 0–0 لـ 4870902 «رسمي» خارج 365.  
- أول settle صحيح حي يكتب مفاتيح كوينز في الإنتاج (لم يحدث بعد).
