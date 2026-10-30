# King of Predictions — تقرير إغلاق مستقل (read-only)

**تاريخ التحقق:** 2026-10-30 ≈ 10:45–11:00 UTC  
**الوضع:** READ-ONLY VERIFICATION — لا كتابة على Production DB/Redis، لا apply لـ re-settle، لا commits من هذا المرور.  
**HEAD المفحوص:** `a172c1053` (Railway deploy `edf0d32e`, git على `/api/health`: `a172c1053ff7`)  
**المراجع:** `docs/audit/king-of-predictions-audit.md`؛ deploys `8c448fb4`/`beb1417ff`، `acefa58`، `a172c10`.  
**التصنيف:** CONFIRMED / LIKELY / POSSIBLE / UNVERIFIED.  
**CLOSED-VERIFIED** = دليل تشغيل (استعلام/لوج/اختبار شغّال)، مش قراءة كود وحدها.

---

## عاجل

1. **أحكام قديمة غلط لسه مقفولة في الإنتاج (CONFIRMED).**  
   `scripts/reconcile-predictions.ts` (read-only، 2026-10-30T10:44:01Z): **53** `wrongToCorrect` (37 winner + 16 exact)، **29** `correctToWrong`، **43** undeterminable (منها **42** تحت status=PEN). جداول `prediction_resettle_*` = **0** runs/items؛ `resettledAt` = **0**. المستخدمون اللي اتظلموا لم يُعوَّضوا.  
2. **مسار التسوية الحي شبه متوقف عن إثبات نجاح جديد منذ 00:17Z (CONFIRMED).**  
   `max(settledAt)=2026-10-30 00:17:09.63` — صف واحد فقط في كل الجدول له `settledAt`. لوج `SETTLE_COMPLETE` ظهر مرتين فقط بعد P0 (4730724 و 4870902)؛ صفوف 4870902 رجعت `isCorrect IS NULL` وتُضرب الآن بـ `SETTLE_SOURCE_CONFLICT` كل دقيقتين تقريباً.  
3. **مفاتيح عملات التسوية لم تُكتب أبداً في الإنتاج (CONFIRMED).**  
   `coin_transactions`: total=2887، `idempotencyKey IS NOT NULL` = **0**، رغم وجود unique index `coin_transactions_idempotencyKey_key`. حماية B7 موجودة في الكود والـ schema لكن **غير مُمارَسة** على بيانات حية ناجحة.  
4. **إصلاحات العميل (Phases 4+6) على `main` ولم تصل للمستخدمين (CONFIRMED).**  
   runtime المنشور عبر فرع OTA القديم: `1.1.0` / app `1.1.1`؛ `main` = runtime `1.2.0` / app `1.1.4`. ≈156 commit front بين آخر tip OTA و`a172c1053`.  
5. **Sentry backend غير قابل للتحقق من الحساب المتصل (UNVERIFIED).**  
   Org المرئي: `mrdev-pk` — مشروع واحد فقط `90plus-app` (موبايل). لا مشروع backend. `SETTLE_OBSERVABILITY_BOOT` يذهب عبر `captureMessage` وليس بالضرورة لوج Railway → **0** ظهور في فلتر اللوجات.

**قرار هذا المرور:** **محتاج إجراء** قبل إعلان «سليم للمستخدمين»: (أ) قرار apply/dry-run لـ re-settle، (ب) نشر عميل، (ج) إثبات Sentry backend أو بديل تنبيه. مسار الـ gate الحي **ليس منهاراً مثل U1**، لكنه **قليل النجاح المُثبَت** ويترك تراثاً اقتصادياً مفتوحاً.

---

## 0) Executive summary (≤15 سطر)

- U1 (أعمدة ناقصة) **مُغلق بدليل:** migration `20261030120000_prediction_settle_audit` finished `2026-10-29 23:30:26Z`؛ كل أعمدة `settled*`/`voided*`/`resettle*` موجودة؛ `/api/health` → `schema.ok=true`، `SCHEMA_OK` migrationsChecked=89.  
- التسوية الحية بعد الإصلاح: **نجاح audit-snapshot واحد** (مباراة 4730724)؛ لا pending على FT/AET/PEN أقدم من 30 دقيقة الآن؛ الـ pending=131 كلها NS/PST/ABD.  
- تراث A7 ما زال مفتوحاً: 53 wrongToCorrect بلا تعويض؛ re-settle endpoint موجود وdry-run افتراضي؛ **لم يُطبَّق**.  
- اختبارات backend للتنبؤات على worktree `a172c1053` بعد `prisma generate`: **13 suites / 137 tests PASS**. قبل `fdba7cb10`: **0** suites بنفس الأسماء. Front King: 15+5+2 PASS.  
- أخطر 5 مفتوحة: (1) تراث wrongToCorrect، (2) PEN بلا tally في الكاش، (3) عميل غير منشور، (4) Sentry backend، (5) 4870902 conflict دائم + إثبات ضعيف أن مسار settle ينجح على مباريات جديدة فيها توقعات.  
- **جاهز للمراقبة المشروطة للمسار الحي**؛ **غير جاهز لإغلاق المنتج اقتصادياً/عميل**.

---

## 1) صحة التسوية الحية

جلسة Postgres: `SET TRANSACTION READ ONLY` + `SET LOCAL default_transaction_read_only = on` عبر Prisma على نفس قاعدة الإنتاج (تطابق `finished_at` لـ migration resettle مع لوج Railway 09:01:22Z).

### 1a — آخر settled/resolved وتقسيم زمني

| مقياس | قيمة | مصدر |
|--------|------|------|
| max(resolvedAt) | 2026-10-30 00:17:09.63 | SQL |
| max(settledAt) | 2026-10-30 00:17:09.63 | SQL |
| resolved_n / settled_n / total | 3117 / **1** / 3248 | SQL |
| بعد deploy beb1417 `2026-10-29T22:50:31Z` | resolved=**1** | SQL |
| بعد settle_audit mig `23:30:26Z` | resolved=**1** | SQL |
| بعد acefa58 `09:01:22Z` | resolved=**0** | SQL |
| بعد a172c10 `09:51:56Z` | resolved=**0** | SQL |

ساعة بساعة (`resolvedAt >= 2026-10-29T22:00Z`):

| hour (UTC) | n | correct | wrong |
|------------|---|--------|-------|
| 2026-10-29T22:00 | 28 | 17 | 11 |
| 2026-10-30T00:00 | 1 | 0 | 1 |

الـ 28 في ساعة 22:00 **قبل** انقطاع U1 المكتمل (أعمدة ظهرت 23:30) — صفوف `resolvedAt` بلا `settledAt` (تراث pre-audit). الصف الوحيد ذو `settledAt` هو في 00:17.

**لوج Railway `SETTLE_COMPLETE` (نافذة ما بعد 22:50Z):** عينتان فقط:
- 00:17:09Z apiMatchId=**4730724** FT 5-4 home wrong=1  
- 00:17:11Z apiMatchId=**4870902** FT 0-0 draw wrong=2  

في DB الآن: 4730724 ما زال settled؛ **4870902 صفّان pending من جديد** (`isCorrect` null) — يتوافق مع قرار revert سابق + حامِل ABD.

### 1b — Pending على نهائيات >30 دقيقة

```sql
-- النتيجة: 0 صفوف مجموعات
... isCorrect IS NULL AND voidedAt IS NULL
AND cf.status IN ('FT','AET','PEN')
AND cf.updatedAt < now() - interval '30 minutes'
```

**العدد = 0.** لا قائمة apiMatchId.  
`/api/health.settlement.settleablePendingMatches = 0`، `oldestSettleablePendingAgeMin = null` — متسق.

### 1c — أقدم pending في الجدول

أقدم صف: apiMatchId **1546302**، created 2026-05-31، status كاش **NS**، عمر ≈151 يوم.  
توزيع pending الحالي (من SQL على statuses الحية): NS=120، PST=8، ABD=3. المجموع 131 يطابق health.

**السبب:** مباريات لم تُنهَ / تأجيل / هجر — ليست فشل gate على FT.

### 1d — توزيع settled* آخر 7 أيام / فساد درجات

آخر 7 أيام: صف واحد فقط — `settledStatus=FT`, `settledWinner=home`, null_scores=0, neg_scores=0.  
كل الصفوف ذات `settledAt`: bad_status=0، null_score=0، neg_score=0.  
`settledWinner` vs اشتقاق من الدرجات لـ FT/AET: **0** اختلاف.

### 1e — توافق settled vs كاش بعد P0

اختلاف واحد:
| apiMatchId | settled | cache الآن |
|------------|---------|------------|
| 4730724 | FT home 5-4 | **NS** scores null |

**CONFIRMED** انحراف عرض إن الواجهة تقرأ الكاش بدل `settled*` للمباريات غير المُحدَّثة في العميل القديم؛ السيرفر Phase 4 يعرض settled عند وجوده (`king-prediction.service.ts` history). العميل الجديد لم يُنشر.

### 1f — Backlog بعد ظهور الأعمدة / Push

- بعد `finished_at` للـ settle_audit خلال ساعتين: resolved=**1** فقط — **لم** يحدث تفريغ backlog كبير.  
- عدد push `PREDICTION_RESULT` بعد الإصلاح: **غير مؤكد** (لم يُعثَر على عدّاد في اللوجات المفلترة؛ لا جدول إشعارات فُحص هنا).  
- تكرار عملات: keys مكررة `prediction:%` = **0** (لأن المفاتيح أصلاً 0).  
- Throttling/push-policy: كود+اختبار `settle-push-policy.test.ts` PASS؛ أثر إنتاجي على backlog **غير مؤكد** لقلة أحداث settle.

### 1g — فجوة 22:50Z → ظهور الأعمدة

- `resolved_during_outage` بين 22:50:31Z و 23:30:26Z = **0** (SQL).  
- المدة ≈ **40 دقيقة** بلا تسوية ناجحة مؤكدة — يطابق سرد U1.  
- عدد التوقعات التي «تأخرت» كـ FT جاهزة أثناء الفجوة ثم تسوّت بعد الإصلاح: استعلام التأخير على `cf.updatedAt < 22:50` و resolve خلال 6 ساعات بعد mig أعاد **n=0** — يعني إما لم يكن هناك نهائي settleable معلّق، أو التسوية لم تلحقهم (الـ burst=1 فقط). **جزئياً غير مؤكد** أيّهما دون لوج أخطاء Prisma التاريخي الكامل (فلتر 72h لم يُظهر `settledHomeScore does not exist` الآن — الحادثة أُغلقت).

### 1h — تسوية مزدوجة / عملات مكررة

- `idempotencyKey` مكرر: **0**.  
- كل المفاتيح null → لا إثبات أن مسار `prediction:{id}:coins` اشتغل مرة في الإنتاج.  
- XP: لم يُفحص جدول XP بالتفصيل في هذا المرور → تكرار XP **غير مؤكد**.

---

## 2) Logs Railway (≈ آخر 72 ساعة) و `/api/health`

**حدود:** فلتر MCP يعيد حتى 500 سطر؛ الأعداد أدناه من عيّنة مفلترة + استعلامات أحداث محددة — ليست بالضرورة exhaust لـ كل سطر خام.

| الحدث | عدد تقريبي في العيّنة | ملاحظات |
|--------|------------------------|---------|
| SCHEMA_OK | ≥9 boots (86→89) | متكرر مع كل deploy |
| SCHEMA_MISMATCH | 0 | |
| SETTLE_COMPLETE | **2** | فقط عند 00:17Z |
| SETTLE_GATE_REJECTED | مئات (health today 314) | عيّنات: `STATUS_NOT_SETTLEABLE` على PST/ABD |
| SETTLE_SKIPPED_LOCKED | 0 في العيّنة | |
| SETTLE_SKIPPED_NO_LOCK | 0 | |
| SETTLE_ERROR | 0 | |
| PEN_WINNER_UNKNOWN | 0 في العيّنة | المتوقع لـ PEN المخزّنة لو أُعيد فتحها؛ حالياً الصفوف القديمة محسومة غلط |
| SETTLE_OBSERVABILITY_BOOT | **0 في Railway** | يُرسل لـ Sentry فقط (`main.ts` ~877) |
| SETTLE_DRAINED | 5 | عند إيقاف deploys |
| SETTLE_LOCK_LOST | 0 | |
| SETTLE_SOURCE_CONFLICT | متكرر؛ health today **41** | كلها تقريباً **4870902** ABD cache vs FT provider |
| SETTLE_STALE | 0 | |
| VOID_CANDIDATE | health today **35** | الفلاج off → لوج فقط |
| SIGTERM أثناء settle | 0 في العيّنة | |
| Prisma column missing | 0 الآن | |

**Restarts:** من أزواج SCHEMA_OK + Starting prediction watcher: تقريباً **≥9** منذ 22:00Z يوم 29 (deploys متتابعة Phases).

### `/api/health` (لقطة 2026-10-30T10:45:32.626Z)

لا يوجد مفتاح اسمه `predictions`. الموجود:

```json
"status": "OK",
"schema": { "checked": true, "ok": true, "pendingMigrations": [], "missingColumns": [], "checkedAt": "2026-10-30T09:53:41.220Z" },
"settlement": {
  "pendingCount": 131,
  "oldestSettleablePendingAgeMin": null,
  "settleablePendingMatches": 0,
  "lastSettleAt": "2026-10-30T00:17:09.630Z",
  "today": {
    "VOID_CANDIDATE": 35,
    "GATE_STATUS_NOT_SETTLEABLE": 314,
    "SETTLE_GATE_REJECTED": 314,
    "SETTLE_SOURCE_CONFLICT": 41
  }
},
"git": "a172c1053ff7",
"providers.apiFootball.redisAvailable": true
```

عدادات `today` من Redis day-hash (E9) — **تبقى عبر restart** داخل TTL 14 يوم (كود)؛ ليست process-local. عدّادات أقدم قبل E9 كانت process-local — تاريخياً.

---

## 3) جدول Finding IDs

| ID | الحالة | Commit(s) | أين الآن | اختبار شُغِّل؟ | دليل إنتاج |
|----|--------|-----------|----------|----------------|------------|
| U1 | **CLOSED-VERIFIED** | d5e557c, 734b5a7 | أعمدة+SCHEMA_OK | schema عبر health | mig finished + columns SQL |
| B1 | CLOSED-UNVERIFIED | aaaa2395b | `king-prediction.service.ts:146-165`, `king-prediction-rules.ts:122-129` | `king-prediction.lock.test.ts` ضمن 137 PASS بعد generate | لا POST حي بعد kickoff في هذا المرور |
| B2 | CLOSED-UNVERIFIED | aaaa2395b | submit→upsert يتجاهل client matchDate |同上 | لا probe API |
| B3 | CLOSED-UNVERIFIED | aaaa2395b | `claimDailySlot` + cairoDayKey | lock tests | لا ضغط متوازٍ حي |
| B4 | CLOSED-UNVERIFIED | aaaa2395b | lockVerdict على update بعد kickoff | lock tests | لا probe |
| B5 | CLOSED-UNVERIFIED | aaaa2395b | MATCH_NOT_ELIGIBLE لجديد | lock tests | — |
| B6 | CLOSED-UNVERIFIED | aaaa2395b | `predictionWriteLimiter` على POST `/` و `/submit` | لا اختبار مخصّص يمسكه صراحة | — |
| B7 | **PARTIAL** | 6d26a51 | resolver يكتب `prediction:{id}:coins`؛ unique index موجود | unit/resolver suites | **0 keys في الإنتاج** |
| B8 | CLOSED-UNVERIFIED | 57544d0 | `kingWeekWhere` مشترك history+LB | `cairo-week.test.ts`, `history-settled-display` | بوابة أسبوع سابقة ادُّعيت؛ لم تُعد في هذا المرور |
| A2 | CLOSED-UNVERIFIED | 4aa2b595d, 0a90b3700 | classifier موحّد + After ET | scores365-settlement + gate | 4730724 سُجّل SETTLE كـ **FT** رغم سرد AET — يحتاج مراجعة |
| A4 | CLOSED-UNVERIFIED | 4aa2b595d | alignment في snapshot tests | snapshot tests PASS | لا مباراة swapped حية |
| A5 | CLOSED-VERIFIED (تصميم) | f67fb16 | `prediction-settle-lock.ts` lease فقط | settle-lock  PASS؛ mutation fail-closed intended | لا SETTLE_SKIPPED_NO_LOCK في اللوج |
| A6 | CLOSED-UNVERIFIED | f67fb16 | heartbeat 20s | lock tests | لا مباراة 5k صف |
| A7 | **OPEN** | acefa5867 | resettle service+route | resettle.test 8 ضمن 137 | runs=0؛ 53 w2c باقية |
| A8 | CLOSED-UNVERIFIED | 4aa2b595d | gate يرفض FT+pens غير محلولة | gate tests | — |
| A10 | **OPEN** | 4aa2b595d | كاش يخزّن penalty object لكن tallies **null** للثلاثية | pen في SQL | 4857309/4858305/4857350: `"away":null,"home":null` |
| A11 | CLOSED-UNVERIFIED | f67fb16 | resolved فقط بعد complete | watcher/resolver tests | — |
| A12 | CLOSED-UNVERIFIED | aaaa2395b | unique `(userId, canonicalFixtureKey)` موجود في indexes | — | فهرس مؤكد SQL |
| A13 | CLOSED-VERIFIED | f67fb16 | `predictions_isCorrect_apiMatchId_idx` | EXPLAIN: Index Scan Cond isCorrect IS NULL AND apiMatchId= | SQL EXPLAIN |
| C1 | CLOSED-UNVERIFIED | aaaa2395b | cairoDayKey | cairo/king rules tests | — |
| C2 | CLOSED-UNVERIFIED | 57544d0 | serverDayCairo على /king/matches | — | health/API shape؛ قيمة اليوم لم تُعد جلبها هنا |
| C3 | CLOSED-UNVERIFIED | 57544d0 | cairoWeekBounds Sun–Sat Africa/Cairo | cairo-week PASS | — |
| C4 | CLOSED-UNVERIFIED | 57544d0 | نفس kingWeekWhere | cairo-week | — |
| C7 | PARTIAL / WONT-FIX جزئي | 57544d0 | العميل يتبع server calendar في WeekScreen (كود) | kingCalendar front PASS | OTA غير منشور |
| D1 | CLOSED-UNVERIFIED (كود+اختبار) | a172c1053 | HistoryList لا يفرّغ | historyList.render 5 PASS | لا جهاز حي |
| D2 | CLOSED-UNVERIFIED | a172c1053 | token gap يبقي الصفوف | render test | — |
| D3 | CLOSED-UNVERIFIED | a172c1053 | settleUncertainSave | kingPicksStore 15 PASS | — |
| D5 | CLOSED-UNVERIFIED | a172c1053 | persist AsyncStorage | store tests | — |
| D6 | CLOSED-UNVERIFIED | a172c1053 | bindUser | store tests | — |
| D9 | CLOSED-UNVERIFIED | a172c1053 | noteResult + push hook | store test noteResult | لا push حي |
| D12 | CLOSED-UNVERIFIED | a172c1053 | KAV behavior height على Android | لا اختبار جهاز | كود فقط |
| D13 | CLOSED-UNVERIFIED | a172c1053 | loadingMoreRef | render test | — |
| E2 | PARTIAL | — | replicas؛ lock يغطي | — | numReplicas **غير مؤكد** هذا المرور |
| E5 | CLOSED-UNVERIFIED | f67fb16, 0a90b3700 | drain + node startCommand | SETTLE_DRAINED في اللوج | |
| E6 | CLOSED-UNVERIFIED | aaaa2395b | `toPredictionDto` بلا settled* | — | لا اعتراض response حي |
| E7 | CLOSED-UNVERIFIED | f67fb16 | single fetch path | tests | — |
| E9 | CLOSED-VERIFIED جزئي | b0b31e1 | health.settlement + Redis today counters | settle-metrics PASS | health حي |
| E10 | PARTIAL | 57544d0 | سيرفر يعرض settled؛ عميل قديم يقرأ كاش | history-settled tests | انحراف 4730724 vs cache |
| E11 | PARTIAL | f67fb16 | VOID خلف فللاج؛ off | void tests PASS؛ VOID_CANDIDATE في health | voidedAt count=0؛ PST/ABD pending باقية |
| F1–F12 | OPEN/FUTURE | — | — | — | انظر §9 |

**Findings جديدة من هذا المرور:**
- **N1:** `coin_transactions.idempotencyKey` كلها NULL رغم unique index (B7 غير مُفعَّل عملياً).  
- **N2:** مسار settle الحي أنتج settledAt=1 فقط منذ الإصلاح؛ إثبات ضعيف على مباريات عليها توقعات بعد 00:17.  
- **N3:** 4870902 يولّد ضوضاء `SETTLE_SOURCE_CONFLICT` مستمرة.  
- **N4:** كائن `score.penalty` موجود لكن قيم null — `bool_or(penalty is not null)` مضلّل إن لم تُفحص القيم.

---

## 4) هل الإصلاحات موجودة في الكود على main؟

| بند | موجود؟ | file:line (دليل) |
|-----|--------|------------------|
| B1/B2 kickoff من الكاش؛ client matchDate متجاهل | نعم | `king-prediction.service.ts:146-147,177`؛ `resolveServerFixture` في rules |
| 409 بعد kickoff | نعم عبر ErrorCode.CONFLICT | `predictions.routes.ts:103-104` (HTTP رقم **غير مؤكد** دون قراءة mapper) |
| منع تبديل الوضع بعد kickoff | نعم | `king-prediction.service.ts:163-165` |
| B3 حد يومي atomic Cairo | نعم | `claimDailySlot` + `cairoDayKey()` :148,195 |
| B5 allowlist/eligibility | نعم | `lockVerdict` → MATCH_NOT_ELIGIBLE |
| B6 rate limit | نعم | `predictionWriteLimiter` على POST |
| B7 unique idempotency | schema نعم؛ بيانات لا | index SQL؛ resolver:281 |
| A12 canonical id | نعم | create `canonicalFixtureKey` :213؛ unique index |
| E6 DTO بلا settled* | نعم | `toPredictionDto` :61-79 |
| A2/A4/A8/A10 classifier+penalty cache | جزئي | tests PASS؛ tallies null في الكاش للمباريات الحرجة |
| A5/A6 lease+heartbeat | نعم | `prediction-settle-lock.ts:1-80`؛ TTL 60s، heartbeat 20s |
| Redis down؟ | القفل **ليس Redis** — Postgres `settle_leases`؛ Redis down لا يمنع القفل (CONFIRMED بالكود). Redis ما زال لـ metrics/cache. |
| E5 SIGTERM drain | نعم | SETTLE_DRAINED في اللوجات |
| E11 VOID flag | مقفول | `prediction-void.service.ts`: `=== 'true'` فقط؛ health VOID_CANDIDATE بدون voided rows |
| Phase 4 أسبوع | **سياسة فعلية:** أسبوع تقويمي **الأحد 00:00 → السبت 24:00 Africa/Cairo** عبر `cairoWeekBounds`/`cairoDayKey` (DST من بيانات IANA). ليس UTC Sunday. `kingWeekWhere`: `(matchDate ∈ week) OR (matchDate null AND createdAt ∈ week)`. history والـ leaderboard يستخدمان نفس الدالة (`king-prediction.service.ts`). `ar.ts` `weekRange`: «من الأحد إلى السبت» — يطابق. |
| Phase 6 D1–D13 | نعم في الملفات المذكورة أعلاه | لم تُنشر للمستخدم |

**فرق معلَن/موجود:** الإعلان السابق أن B7 «حي»؛ الإنتاج بلا أي مفتاح. الإعلان أن penalty «في الكاش»؛ المفتاح موجود والقيم null للثلاثية.

---

## 5) الاختبارات

### Worktrees
- قبل: `C:\Football-app-audit-before` @ `faa1d197c` (= `fdba7cb10^`) — **0** ملفات اختبار بأسماء settlement/gate/cairo-week/resettle.  
- بعد: `C:\Football-app-audit-after` @ `a172c1053` — بعد `npx prisma generate`:  
  **Test Suites: 13 passed / Tests: 137 passed**  
  (pattern: prediction-settlement-gate|settle-lock|void|cairo-week|history-settled|resettle|settle-metrics|king-prediction.lock|snapshot|scores365-settlement|resolver.settle|settle-push|watcher)

قبل `prisma generate` فشلت 7 suites بـ TS2305 على نوع `Prediction` — بيئي، ليس regression منطقي.

### Front (على worktree الرئيسي front، نفس commit)
| suite | نتيجة |
|-------|--------|
| kingPicksStore.test.ts | 15 PASS |
| historyList.render.test.tsx | 5 PASS |
| kingCalendar.test.ts | 2 PASS |

الـ suite الكامل للـ front **لم يكتمل** في هذا المرور (سابقاً علّق >50 دقيقة). مقارنة فشل pre-existing vs regression للـ suite الكامل: **غير مؤكد**.

### Backend full suite
لم يُشغَّل كامل المشروع في هذا المرور (التركيز على prediction suites). **غير مؤكد** انحدار خارج التنبؤات.

### عدّ اختبارات جديدة مرتبطة بالمراحل
≈137 اختبار backend تنبؤات/تسوية غير موجودة قبل fdba7cb10 + 22 front King المذكورة. تغطي: gate/PEN، lock/concurrency، void flag، Cairo week/DST حدود، history settled، resettle dry-run، push policy، D2/D3/D5/D6/D9/D13.

### Skip
في عيّنة gate: عند `-t PEN` ظهر 12 skipped من 19 — skips عادية لفلتر الاسم لا `xit` دائم. مسح شامل لكل `xit`/`describe.skip` في المجلد: **غير مكتمل** → أي skip دائم **غير مؤكد**.

### تجربة تكسير (worktree after، ثم restore)
| كسر | النتيجة |
|-----|---------|
| `predictionType==='draw' → return true` بدل false على PEN | **1 failed** — الاختبار يمسك القرار |
| (محاولة سابقة) كسر اسم `cairoWeekBounds` | 15 failed |
| D1/D3/merge من جلسة تنفيذ سابقة | فشلت الاختبارات المقصودة ثم رُممت |

---

## 6) Re-settle (Phase 5) — الحالة الحقيقية

| فحص | نتيجة |
|-----|--------|
| prediction_resettle_runs | **0** |
| prediction_resettle_items | **0** |
| predictions.resettledAt/resettleRunId | **0** |
| dry-run في الكود | `if (opts.dryRun) return {...}` قبل أي create (`prediction-resettle.service.ts:193-195`) — **لا كتابة** |
| ADMIN_TOKEN في بيئة المحقق | **غير موجود** → dry-run HTTP **لم يُنفَّذ** (حسب القواعد: لا طلب token) |

### الأعداد (reconcile 10:44Z)
| bucket | n |
|--------|---|
| wrongToCorrect | 53 (winner 37 + exact 16) |
| correctToWrong | 29 (w 20 + e 9) — سياسة: لا تُطبَّق |
| unchanged | 2974 |
| undeterminable | 43 |
| byStatus PEN undeterminable | 42 |
| doubleCredit / creditOnWrong | 0 / 0 |
| correctWithoutKeyedCredit | 1068 (تراث قبل المفاتيح) |

**41 vs 42:** الثلاثية الكلاسيكية 29+10+2=**41** توقعات على PEN محسومة `isCorrect=false` سابقاً. الـ **42** في undeterminable/PEN تشمل صفاً إضافياً (مثل 4761280 أو غيره بـ penalty tallies ناقصة) — reconcile يعدّ حسب gate الآن لا «صفوف لسه pending».

### مباريات PEN
| fixtureId | status | penalty JSON | أثر gate |
|-----------|--------|--------------|----------|
| 4857309 | PEN 1-1 | home/away **null** | PEN_WINNER_UNKNOWN إن أُعيد الحكم |
| 4858305 | PEN 2-2 | null/null |同上 |
| 4857350 | PEN 0-1 | null/null |同上 |
| 4761280 | PEN 1-1 | null/null |同上 |
| 1545586 | PEN | home 6 away 5 | قابل للحسم |

365 live API للركلات الآن: **غير مؤكد** (لم يُستدعَ مزوّد خارجي في هذا المرور).  
إدخال نتيجة رسمية يدوياً عبر endpoint re-settle: يعتمد على snapshot loader/gate — **لا** دفتر عكسي يدوي منفصل لـ correctToWrong. لا مسار admin لحقن penalty tallies وُجد في هذا المرور → **غير مؤكد**/غالباً غير موجود.

---

## 7) Client وجاهزية النشر

### ما على main ولم يُنشَر
- آخر tip معروف لفرع OTA: `341767b91` runtime **1.1.0** / 1.1.1.  
- `main` front: runtime **1.2.0** / version 1.1.4؛ buildNumber محلي معدّل 164 (**غير committed** في تقارير سابقة — لا نلتزم به).  
- `git log 341767b91..a172c1053 -- front/`: **≈156** commits تشمل Coach King، Community، Share&Win، deferred invite، Phases 4+6 King، إلخ.

### غير ملك اللعبة (عينة عالية الأثر)
| Commit | أثر |
|--------|-----|
| fcd30b864 Share&Win restyle | UI جوائز/أصول كبيرة |
| Coach King series (f81516b…) | تسعير/ميزانية/UI كامل |
| Community safety/feed | اعتدال صور + تبويب |
| Deferred invite Android/iOS | attribution |

OTA من main = كل ما سبق.

### استراتيجية release مقترحة
1. Branch من آخر store build مستقر (runtime يطابق الجهاز).  
2. Cherry-pick فقط: `57544d021` (جزء front) + `a172c1053` (+ locales إن لزم).  
3. قناة OTA على runtime **1.2.0** إن كان الـ store build 1.1.4/1.2.0 منشوراً؛ وإلا انتظر build.  
4. **D12** (`behavior: 'height'`) JS-only داخل Modal — **لا يتطلب native build** (LIKELY). تغيير `app.json`/أيقونات = يحتاج build.

### توافق قديم
- 409/CONFLICT بعد kickoff: عملاء قدامى قد يعرضون خطأ عام — **غير مؤكد** بدون اختبار UI قديم.  
- `serverDayCairo`/`weekBounds`: عميل قديم يتجاهل الحقول الزائدة عادة (آمن).  
- VOID: الفلاج off → لا شكل void في API للأغلبية؛ عميل جديد يعرف `voided` في history — غير منشور.

### مخاطر معروفة
FlashList scrollToEnd low-end، RTL home/away، نصوص VOID: كما في التدقيق السابق — **لم تُعاد تجربتها على جهاز** هذا المرور → تبقى LIKELY/UNVERIFIED.

---

## 8) المراقبة والتنبيهات

| بند | الحالة |
|-----|--------|
| Sentry backend يستقبل BOOT؟ | **UNVERIFIED** — الحساب يرى فقط `90plus-app`. المطلوب: صاحب org يفتح مشروع backend أو يصحّح DSN ويبحث `SETTLE_OBSERVABILITY_BOOT` |
| Quota | غير مؤكد |
| Health counters | Redis day hash (تبقى) + pending من DB (لحظي) |
| Process-local؟ | عدّادات E9 **ليست** process-local؛ أي عدّاد أقدم قبل b0b31e1 كان |

**تنبيهات مقترحة (لم تُنفَّذ):**
| شرط | عتبة | أين |
|-----|------|-----|
| settleable pending age | >30 min | health scrape → Railway/uptime |
| SETTLE_SKIPPED_NO_LOCK | >0 /15m | Sentry/log drain |
| PEN_WINNER_UNKNOWN | >0 | Sentry |
| SETTLE_ERROR | >0 | Sentry |
| SETTLE_SOURCE_CONFLICT نفس id | >10/ساعة | log metric (4870902 الآن) |
| lastSettleAt stale أثناء أيام فيها FT+predictions | >6h | SQL+health |
| SCHEMA_MISMATCH | أي | boot P0 |

---

## 9) المخاطر المتبقية

| خطر | احتمال | أثر | كشف حالي | وقاية متبقية |
|-----|--------|-----|----------|--------------|
| WC shootouts / PEN بلا tally | عالي موسمياً | pending أو حكم غلط | GATE/PEN logs؛ الآن tallies null | عقد penalty + مصدر خارجي |
| 365 يغيّر payload | متوسط | undeterminable | GATE reasons | اختبارات ذهبية للـ payload |
| Redis down | منخفض/متوسط | metrics/cache؛ **القفل يبقى** على PG | redisAvailable على health | HA Redis للعدّادات |
| Deploy أثناء settle كبير | متوسط | drain 20s؛ صفوف تبقى pending | SETTLE_DRAINED | طابور أطول |
| تصحيح رسمي بعد settle | عالي للتراث | حكم ثابت | reconcile | re-settle apply |
| حسابان | خارج التقنية | حدّان يوميان | — | سياسة منتج |
| تأجيل PST/ABD | حاصل | pending للأبد وVOID off | VOID_CANDIDATE؛ PST=8 ABD=3 | قرار VOID أو إغلاق يدوي |
| 4870902 conflict loop | حاصل | ضوضاء لوج + صفان معلّقان | CONFLICT كل ~2 دقائق | قرار منتج: اترك/void/فرض |

**أحكام قديمة غلط الآن:** **53** wrongToCorrect (تأثير: نقاط/كوينز ناقصة للمستخدمين الصحيحين)، **29** correctToWrong (لو طُبّق السحب لاحقاً — حالياً **لا**)، **≈41–42** PEN ببوابة لا تستطيع إعادة الحكم من الكاش.

---

## 10) افتراضات اتكسرت وعيوب التنفيذ

| افتراض/عيب | هل حُل؟ | أثر جانبي |
|------------|---------|-----------|
| npm يبتلع SIGTERM | حُل بـ `node dist/...` (0a90b3700) | SETTLE_DRAINED يظهر |
| ABD يُستبدل بـ Ended/FT تلقائياً | حُل بالـ hold + CONFLICT | 4870902 عالق ضوضاء |
| "After ET" = AET | كود+اختبار؛ لكن settle 4730724 سُجّل **FT** في اللوج | يحتاج تفسير (مصدر snapshot وقتها؟) — **PARTIAL** |
| partial index → composite `(isCorrect, apiMatchId)` | نعم؛ EXPLAIN Index Scan | يغطي pending per match؛ ليس partial فقط null |
| Redis+advisory → lease PG | نعم fail-closed | لا settle إن فشل INSERT lease |

---

## 11) خطة الإغلاق والمقاييس

### تعريف «إغلاق» قابل للقياس — القيم الآن

| مقياس | هدف | الآن | حكم |
|------|-----|------|-----|
| settleable pending FT/AET/PEN >30m | 0 | **0** | OK |
| SCHEMA ok | true | true | OK |
| SETTLE_ERROR / column missing | 0 | 0 (عيّنة) | OK |
| wrongToCorrect المعلّق | 0 بعد apply | **53** | FAIL |
| resettle applied audit | يطابق الخطة | 0 runs | FAIL إلى أن يُقرَّر |
| عميل Phase 4+6 منشور | نعم | لا | FAIL |
| Sentry backend BOOT | حدث موجود | غير مؤكد | FAIL/UNVERIFIED |
| lastSettleAt حديث عند وجود عمل | — | 00:17Z فقط | راقب |
| coin idempotency keys على settle صحيح جديد | >0 | 0 | راقب أول فوز |

### اختبار يدوي موبايل (مرتبط IDs)
1. بعد kickoff: تعديل توقع → رفض (B1/B4).  
2. حفظ مع شبكة مقطوعة ثم استعادة (D3).  
3. تسجيل خروج/دخول حسابين (D5/D6).  
4. شريط أيام الأسبوع عبر منتصف ليل القاهرة/DST (C3).  
5. سجل أثناء reload وtoken gap (D1/D2).  
6. Android كيبورد ورقة النتيجة (D12).  
7. Push نتيجة → تحديث سجل (D9) — يحتاج بناء منشور.

### مراقبة مقترحة قبل الإغلاق النهائي
48–72 ساعة: لا SCHEMA_MISMATCH؛ لا settleable pending>30m؛ ≥1 SETTLE_COMPLETE على مباراة فيها توقعات مع كتابة `settledAt`+`idempotencyKey`؛ CONFLICT 4870902 محلول أو مقبول؛ قرار re-settle منفّذ أو مؤجّل صراحة.

**مؤشر عدم الجاهزية:** تراث 53 + عميل غير منشور + Sentry backend أعمى + settledAt=1 فقط منذ الإصلاح → **الإغلاق غير جاهز**.

---

## اللي ما قدرتش أتحقق منه

| بند | ما يحسمه | من |
|-----|----------|-----|
| Sentry backend BOOT/quota | بحث في مشروع backend الصحيح | صاحب Sentry |
| POST حي بعد kickoff / 409 | استدعاء API بمستخدم تجريبي | مهندس بجلسة auth |
| 365 live penalty للثلاثية | طلب API الآن | backend/ops |
| Redis SCAN لمفاتيح settle:* | عميل Redis read-only (CLI كان unauthorized) | ops |
| عدد push بعد backlog | لوجات إشعار/مزوّد push | ops |
| Full front/backend suite vs قبل | تشغيل كامل على worktrees | CI |
| numReplicas الحالي | Railway service settings | ops |
| HTTP status الفعلي لـ CONFLICT | قراءة `ErrorCode` mapper أو curl | مهندس |

---

## قرارات يلزم أخذها

1. **Apply re-settle** للـ 15+ مباراة ذات wrongToCorrect بعد dry-run — نعم/لا/جزئي.  
2. **correctToWrong (29):** تركها (القرار الحالي) أم سحب؟  
3. **PEN 41/42:** مصدر ركلات خارجي أم إبقاء مقفول؟  
4. **4870902:** void / فرض نهائي / إبقاء CONFLICT؟  
5. **OTA vs cherry-pick vs store build** لعميل King.  
6. **PREDICTION_VOID_ENABLED:** يبقى off (موصى حتى بعد re-settle) أم dry-run PST/ABD؟  
7. **تأكيد/إصلاح Sentry DSN backend.**

---

## افتراضات هذا التقرير بلا دليل كامل

- `.env` المحلي `DATABASE_URL` يشير لنفس إنتاج Railway (مُعزَّز بتطابق migration timestamps مع اللوج، لكنه ليس شهادة).  
- فلتر لوجات MCP قد يُسقِط أحداثاً خارج الـ 500.  
- «لا settle بعد 00:17» قد يعني ببساطة عدم وجود توقعات على النهائيات الجديدة — لم يُثبت عكس ذلك بتتبع مباراة عليها صفوف.  
- D12 لا يحتاج native — استنتاج من أن التغيير JS فقط.  
- ErrorCode.CONFLICT = 409 — شائع في المشروع؛ لم يُقرأ mapper في هذا المرور.

---

## ماذا جُرِّب لكسر الثقة الزائفة

- استعلامات READ ONLY مباشرة لا الاعتماد على تقارير سابقة.  
- تطابق لوج SETTLE_COMPLETE مع صفوف DB (كشف revert 4870902).  
- EXPLAIN على فهرس pending.  
- Reconcile كامل لأعداد التراث.  
- 137 اختبار backend + 22 front.  
- Mutation: كسر قاعدة draw-on-PEN → فشل اختبار واحد متوقع ثم restore.  

**لا يُقال «سليم» عن ملك اللعبة كمنتج للمستخدم النهائي.** يُقال: **مسار التسوية بعد U1 يعمل بوابةً رافضةً بأمان للنهائيات غير الصالحة، لكن إثبات النجاح الحي ضعيف، والتراث الاقتصادي والعميل ما زالا مفتوحين.**
