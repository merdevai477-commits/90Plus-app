---
name: Fix Rate Limiting and Video Upload Timeout
overview: "حل مشكلتين رئيسيتين: زيادة rate limits لتقليل 429 errors وتحسين timeout settings لرفع الفيديو"
todos: []
---

# إصلاح Rate Limiting و Video Upload Timeout و Caching

## المشاكل

1. **Quiz Categories 404**: `/api/quiz/categories` يعيد 404

- تم إصلاح ترتيب الـ routes بالفعل
- قد يحتاج فقط إلى redeploy على Railway

2. **Rate Limiting (429 errors)**: الكثير من 429 errors على endpoints مختلفة

- الـ `generalLimiter` يطبق 500 requests per 15 minutes - قليل جداً
- التطبيق يحتاج إلى الكثير من API calls (live matches, notifications, rankings, etc.)

3. **Video Upload Timeout (499)**: رفع الفيديو يستغرق 10 دقائق ويتوقف عند 30%

- Frontend timeout: 15 seconds (قليل جداً للفيديو)
- Backend: لا يوجد timeout محدد للـ upload routes
- يجب زيادة timeout للـ upload إلى 10-15 دقيقة

4. **Football API Caching**: الـ API بيعمل عدد كبير من الـ requests بدون استخدام الـ cache

- `/api/football/fixtures/live` لا يستخدم الـ cache
- الـ frontend يستخدم `/fixtures/live` مباشرة بدلاً من cached endpoints
- يجب تحديث `/api/football/fixtures/live` لاستخدام الـ cache أو تحديث الـ frontend

## الحل

### 1. التأكد من Quiz Categories Route

**في `Backend/src/routes/quiz.routes.ts`:**

- تم إصلاح ترتيب الـ routes بالفعل (static قبل dynamic)
- التأكد من أن الـ route مسجل بشكل صحيح في `main.ts`
- قد يحتاج فقط إلى redeploy على Railway

### 2. زيادة Rate Limits

**في `Backend/src/middleware/rateLimit.middleware.ts`:**

- زيادة `generalLimiter` من 500 إلى 2000 requests per 15 minutes في production
- إضافة `lenientLimiter` للـ endpoints التي تحتاج requests كثيرة (live matches, notifications)
- إزالة rate limiting من بعض الـ endpoints المهمة (health checks, WebSocket, upload routes)

### 3. إصلاح Football API Caching

**في `Backend/src/controllers/football.controller.ts`:**

- تحديث `getLiveFixtures` لاستخدام الـ cache service
- استخدام `footballDataCacheService` أو `matchCacheService` للـ live fixtures
- إضافة memory cache للـ live fixtures (5 دقائق TTL)

**في `front/services/apiFootball.ts`:**

- تحديث `getLiveFixtures` لاستخدام `/cached/matches/:date` بدلاً من `/fixtures/live` عندما يكون ذلك ممكناً
- أو إضافة caching layer في الـ frontend

### 4. إضافة Upload Timeout Middleware

**في `Backend/src/main.ts`:**

- إضافة timeout middleware للـ upload routes (10-15 دقيقة)
- زيادة `keepAliveTimeout` للـ HTTP server

**في `Backend/src/routes/upload.routes.ts`:**

- إضافة timeout handling للـ upload operations
- إضافة progress tracking (اختياري)

### 5. زيادة Frontend Timeout للـ Upload

**في `front/config/api.config.ts`:**

- إضافة `uploadTimeout` منفصل: 15 دقيقة (900000ms)
- استخدام timeout أطول للـ upload requests فقط

**في `front/services/` (حيث يتم رفع الفيديو):**

- استخدام timeout أطول للـ upload requests
- إضافة retry logic للـ upload

## الملفات التي سيتم تعديلها

1. `Backend/src/routes/quiz.routes.ts`

- التأكد من أن الـ routes مرتبة بشكل صحيح (تم بالفعل)

2. `Backend/src/middleware/rateLimit.middleware.ts`

- زيادة `generalLimiter` limits
- إضافة `lenientLimiter` للـ endpoints المهمة
- إزالة rate limiting من upload routes

3. `Backend/src/controllers/football.controller.ts`

- تحديث `getLiveFixtures` لاستخدام الـ cache

4. `Backend/src/main.ts`

- إضافة timeout middleware للـ upload routes
- زيادة server timeout settings
- إزالة rate limiting من upload routes

5. `Backend/src/routes/upload.routes.ts`

- إضافة timeout handling

6. `front/config/api.config.ts`

- إضافة `uploadTimeout` configuration

7. `front/services/apiFootball.ts`

- تحديث `getLiveFixtures` لاستخدام cached endpoints عندما يكون ذلك ممكناً

8. `front/services/` (ملف رفع الفيديو)

- استخدام timeout أطول للـ upload

## التفاصيل التقنية

### Rate Limiting

- `generalLimiter`: 2000 requests per 15 minutes (بدلاً من 500)
- `lenientLimiter`: 5000 requests per 15 minutes للـ endpoints المهمة
- إزالة rate limiting من `/api/upload/reel` (يستخدم cooldown بدلاً منه)

### Upload Timeout

- Backend: 15 دقيقة (900000ms) للـ upload routes
- Frontend: 15 دقيقة (900000ms) للـ upload requests
- Server keepAlive: 10 دقائق

## التحقق

بعد التعديل:

- يجب أن يعمل `/api/quiz/categories` بدون 404 ✅
- يجب أن تقل 429 errors بشكل كبير ✅
- يجب أن تقل عدد الـ API requests للـ football API (باستخدام الـ cache) ✅
- يجب أن يكتمل رفع الفيديو بدون timeout ✅
- يجب أن يعمل التطبيق بشكل أسرع وأكثر موثوقية ✅