# 🧪 دليل اختبار الـ API - شامل

## 📋 نظرة عامة

هذا الدليل يشرح كيفية اختبار جميع endpoints في الـ API الخاص بـ 90Plus.

---

## 🚀 الاختبار السريع

### 1. اختبار محلي (Local)

```bash
cd Backend

# بدون authentication
npx ts-node test-all-endpoints.ts

# مع user token
export TEST_USER_TOKEN="your_clerk_token_here"
npx ts-node test-all-endpoints.ts

# مع user و admin tokens
export TEST_USER_TOKEN="your_user_token"
export ADMIN_TOKEN="your_admin_token"
npx ts-node test-all-endpoints.ts
```

### 2. اختبار على Railway

```bash
cd Backend

# Set API URL
export API_URL="https://your-app.railway.app"
export TEST_USER_TOKEN="your_clerk_token"
npx ts-node test-all-endpoints.ts
```

### 3. استخدام PowerShell

```powershell
cd Backend

# اختبار محلي
.\test-all-endpoints.ps1

# اختبار على Railway
.\test-all-endpoints.ps1 -ApiUrl "https://your-app.railway.app"

# مع tokens
.\test-all-endpoints.ps1 `
  -ApiUrl "https://your-app.railway.app" `
  -UserToken "your_user_token" `
  -AdminToken "your_admin_token"
```

---

## 📊 الـ Endpoints المختبرة

### 1. Health & Info (4 endpoints)
- ✅ `GET /` - Root endpoint
- ✅ `GET /api` - API info
- ✅ `GET /api/health` - Health check
- ✅ `GET /api/metrics` - Metrics

### 2. Users (2 endpoints)
- ✅ `GET /api/users` - List users
- ✅ `GET /api/users/:username` - Search user

### 3. Authentication (2 endpoints)
- ✅ `POST /api/clerk/sync` - Sync with Clerk
- ✅ `GET /api/clerk/user` - Get current user

### 4. Profile (3 endpoints)
- 🔐 `GET /api/profile` - Get profile
- 🔐 `PUT /api/profile` - Update profile
- 🔐 `GET /api/profile/completion` - Profile completion

### 5. GDPR (3 endpoints)
- 🔐 `GET /api/gdpr/consent` - Get consent
- 🔐 `POST /api/gdpr/consent` - Update consent
- 🔐 `GET /api/gdpr/deletion-status` - Deletion status

### 6. Football (4 endpoints)
- ✅ `GET /api/football/leagues` - Get leagues
- ✅ `GET /api/football/fixtures/live` - Live matches
- ✅ `GET /api/football/fixtures/today` - Today's matches
- ✅ `GET /api/football/standings/:leagueId` - League standings

### 7. Matches (3 endpoints)
- ✅ `GET /api/matches/live` - Live matches
- ✅ `GET /api/matches/today` - Today's matches
- ✅ `GET /api/matches/upcoming` - Upcoming matches

### 8. Predictions (2 endpoints)
- 🔐 `GET /api/predictions/my-predictions` - My predictions
- ✅ `GET /api/predictions/leaderboard` - Leaderboard

### 9. Quiz (4 endpoints)
- ✅ `GET /api/quiz/health` - Quiz health
- ✅ `GET /api/quiz/categories` - Quiz categories
- 🔐 `GET /api/quiz/daily-status` - Daily quiz status
- 🔐 `GET /api/quiz/stats` - Quiz stats

### 10. Reels (3 endpoints)
- ✅ `GET /api/reels` - Get reels
- ✅ `GET /api/reels/trending` - Trending reels
- ✅ `GET /api/reels/rankings` - Reels rankings

### 11. Coins (2 endpoints)
- 🔐 `GET /api/coins/balance` - Coin balance
- 🔐 `GET /api/coins/transactions` - Transactions

### 12. Daily Spin (1 endpoint)
- 🔐 `GET /api/daily-spin/status` - Spin status

### 13. Notifications (2 endpoints)
- 🔐 `GET /api/notifications` - Get notifications
- 🔐 `GET /api/notifications/unread-count` - Unread count

### 14. Analytics (1 endpoint)
- 🔐 `POST /api/analytics/track` - Track event

### 15. Admin (3 endpoints)
- 👑 `GET /api/admin/reports` - Get reports
- 👑 `GET /api/admin/strikes` - Get strikes
- 👑 `GET /api/admin/audit` - Audit logs

### 16. Reports (1 endpoint)
- 🔐 `GET /api/reports/my-reports` - My reports

### 17. App Version (2 endpoints)
- ✅ `GET /api/app/version` - App version
- ✅ `GET /api/app/check-update` - Check update

### 18. Legal Pages (3 endpoints)
- ✅ `GET /privacy-policy.html` - Privacy policy
- ✅ `GET /terms-of-service.html` - Terms of service
- ✅ `GET /support.html` - Support page

### 19. Authentication Tests (3 tests)
- ✅ Test endpoints without auth (should return 401)

**Legend:**
- ✅ Public endpoint (no auth required)
- 🔐 Requires user authentication
- 👑 Requires admin authentication

---

## 🔑 الحصول على Tokens

### User Token (Clerk)

1. افتح تطبيق 90Plus
2. سجل دخول
3. افتح Developer Tools في المتصفح
4. اذهب إلى Network tab
5. ابحث عن أي request للـ API
6. انسخ الـ `Authorization` header
7. الـ token هو الجزء بعد `Bearer `

### Admin Token

1. تحتاج حساب admin
2. نفس الخطوات السابقة
3. تأكد أن الحساب له صلاحيات admin

---

## 📈 فهم النتائج

### نتيجة ناجحة
```
✅ GET /api/health - Status: 200
```

### نتيجة فاشلة
```
❌ GET /api/profile - Status: 401
Error: Authentication required
```

### نتيجة متخطاة
```
⚠️  GET /api/profile - SKIPPED (no token)
```

---

## 🎯 أمثلة الاستخدام

### مثال 1: اختبار سريع محلي

```bash
cd Backend
npm start  # في terminal آخر
npx ts-node test-all-endpoints.ts
```

### مثال 2: اختبار كامل على Railway

```bash
cd Backend

# Set environment variables
export API_URL="https://ninetyplusapp-production.up.railway.app"
export TEST_USER_TOKEN="eyJhbGc..."
export ADMIN_TOKEN="eyJhbGc..."

# Run tests
npx ts-node test-all-endpoints.ts
```

### مثال 3: اختبار endpoints محددة

يمكنك تعديل الملف `test-all-endpoints.ts` وتعليق الأقسام التي لا تريد اختبارها.

---

## 🐛 حل المشاكل

### مشكلة: "Cannot find module 'axios'"

```bash
cd Backend
npm install axios
```

### مشكلة: "Network error"

- تأكد أن السيرفر شغال
- تأكد من الـ API URL صحيح
- تحقق من الـ firewall

### مشكلة: "401 Unauthorized"

- تأكد أن الـ token صحيح
- تأكد أن الـ token لم ينتهي
- تحقق من الـ Clerk configuration

### مشكلة: "404 Not Found"

- تأكد أن الـ endpoint موجود
- تحقق من الـ API_PREFIX
- راجع الـ routes في `main.ts`

---

## 📊 تقرير الاختبار

بعد تشغيل الاختبارات، ستحصل على تقرير مثل:

```
📊 Overall Results:
Total tests: 50
✅ Passed: 45
❌ Failed: 2
⚠️  Skipped: 3

Pass rate: 90.0%

📋 Results by Category:

Health:
  ✅ Passed: 4
  📊 Pass Rate: 100%

GDPR:
  ✅ Passed: 2
  ⚠️  Skipped: 1
  📊 Pass Rate: 100%

...
```

---

## 🔄 الاختبار المستمر

### اختبار بعد كل deployment

```bash
# في CI/CD pipeline
export API_URL="https://your-app.railway.app"
export TEST_USER_TOKEN="$CLERK_TEST_TOKEN"
npx ts-node test-all-endpoints.ts
```

### اختبار دوري

يمكنك إعداد cron job لاختبار الـ API بشكل دوري:

```bash
# كل ساعة
0 * * * * cd /path/to/Backend && npx ts-node test-all-endpoints.ts
```

---

## 📝 ملاحظات مهمة

1. **Rate Limiting**: بعض endpoints لها rate limiting، قد تحتاج انتظار بين الاختبارات
2. **Test Data**: الاختبارات تستخدم بيانات حقيقية، تأكد من استخدام test environment
3. **Tokens**: لا تشارك الـ tokens في الكود أو Git
4. **Cleanup**: بعض الاختبارات قد تنشئ بيانات، قد تحتاج تنظيفها

---

## 🎉 الخلاصة

- ✅ 50+ endpoint مختبر
- ✅ اختبار authentication
- ✅ اختبار authorization
- ✅ اختبار error handling
- ✅ تقرير مفصل
- ✅ سهل الاستخدام

---

## 📞 الدعم

إذا واجهت مشاكل:
1. راجع الـ logs
2. تحقق من الـ environment variables
3. تأكد من الـ server شغال
4. راجع الـ documentation

---

**تم إنشاؤه بواسطة:** Kiro AI Assistant  
**التاريخ:** 31 مارس 2026  
**الإصدار:** 1.0.0
