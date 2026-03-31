# 🧪 اختبار الـ API - دليل سريع

## 🚀 البدء السريع

### 1. اختبار محلي (بدون tokens)

```bash
cd Backend
npx ts-node test-all-endpoints.ts
```

### 2. اختبار محلي (مع tokens)

```bash
cd Backend
export TEST_USER_TOKEN="your_clerk_token"
npx ts-node test-all-endpoints.ts
```

### 3. اختبار على Railway

```bash
cd Backend
export API_URL="https://your-app.railway.app"
export TEST_USER_TOKEN="your_token"
npx ts-node test-all-endpoints.ts
```

### 4. PowerShell (Windows)

```powershell
cd Backend
.\test-all-endpoints.ps1 -ApiUrl "https://your-app.railway.app"
```

---

## 📊 ما يتم اختباره

- ✅ **50+ endpoint** في الـ API
- ✅ Health & Info endpoints
- ✅ User endpoints
- ✅ Authentication
- ✅ Profile management
- ✅ GDPR compliance
- ✅ Football data
- ✅ Matches & Predictions
- ✅ Quiz system
- ✅ Reels & Social
- ✅ Coins & Rewards
- ✅ Notifications
- ✅ Admin panel
- ✅ Legal pages

---

## 🔑 الحصول على Token

### من التطبيق:
1. سجل دخول في التطبيق
2. افتح Developer Tools (F12)
3. اذهب لـ Network tab
4. ابحث عن أي API request
5. انسخ الـ Authorization header

### من Clerk Dashboard:
1. اذهب لـ Clerk Dashboard
2. Users → اختر user
3. Generate test token

---

## 📈 فهم النتائج

```
✅ Passed: 45    - نجح
❌ Failed: 2     - فشل
⚠️  Skipped: 3   - متخطى (بسبب عدم وجود token)

Pass rate: 90.0%
```

---

## 🎯 أمثلة سريعة

### اختبار endpoint واحد

```bash
# Health check
curl http://localhost:3000/api/health

# With auth
curl http://localhost:3000/api/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### اختبار GDPR endpoints

```bash
export TEST_USER_TOKEN="your_token"
npx ts-node test-all-endpoints.ts
# سيختبر جميع GDPR endpoints تلقائياً
```

---

## 🐛 حل المشاكل

### السيرفر مش شغال
```bash
cd Backend
npm start
```

### مفيش axios
```bash
npm install axios
```

### Token expired
احصل على token جديد من التطبيق

---

## 📚 المزيد من المعلومات

راجع `TESTING_GUIDE.md` للدليل الكامل.

---

**نصيحة:** شغل الاختبارات بعد كل deployment للتأكد أن كل حاجة شغالة! 🚀
