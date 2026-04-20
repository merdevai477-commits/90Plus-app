# 🚀 Postman Testing Guide - 90Plus Reels API

## ✅ تم الإعداد بنجاح!

تم إنشاء collection كامل لاختبار endpoints الريلز في Postman.

---

## 📦 ما تم إنشاؤه

### 1. **Workspace**
- **Name:** محمود فتحي's Workspace
- **ID:** `a13f5335-b315-45ca-8d77-43dafb162b4c`

### 2. **Collection: 90Plus Reels API**
- **ID:** `bcdc4967-491f-47d6-a835-91ed4af38de6`
- **UID:** `54140869-bcdc4967-491f-47d6-a835-91ed4af38de6`
- **URL:** [Open in Postman](https://www.postman.com/blackandwight625-5095867/90plus-reels-api/collection/bcdc4967-491f-47d6-a835-91ed4af38de6)

### 3. **Environment: 90Plus Production**
- **ID:** `037385a0-8eac-4f78-b0aa-8c3dd8c84e6f`
- **Variables:**
  - `base_url`: `https://90plus-app-production-b28d.up.railway.app/api`
  - `clerk_token`: (فارغ - يجب إضافته)
  - `test_reel_id`: (يتم ملؤه تلقائياً من أول request)

---

## 🔑 الخطوات للبدء

### 1. افتح Postman
اذهب إلى: https://www.postman.com

### 2. اختر Workspace
- اذهب إلى **Workspaces** → **محمود فتحي's Workspace**

### 3. افتح Collection
- اختر **90Plus Reels API** من القائمة الجانبية

### 4. اختر Environment
- من القائمة العلوية، اختر **90Plus Production**

### 5. أضف Clerk Token
**مهم جداً:** يجب إضافة token للمصادقة:

#### 🎯 الطريقة الأسهل: استخدام Debug Screen

1. **افتح التطبيق** على الموبايل/محاكي
2. **سجل دخول** بحسابك
3. **اذهب إلى:** `/debug-token` في التطبيق
   - أو أضف زر في Settings يفتح هذه الصفحة
4. **اضغط "Get & Copy Token"**
5. **الـ token سيُنسخ تلقائياً** للـ clipboard
6. **في Postman:**
   - اضغط على **Environments** → **90Plus Production**
   - ابحث عن `clerk_token`
   - الصق الـ token في خانة **Current Value**
   - احفظ

#### 📱 طرق بديلة:

**الطريقة 1: من Console Logs**
```typescript
// أضف هذا في أي screen بعد تسجيل الدخول:
import { useClerkTokenLogger } from '../scripts/get-clerk-token';

function MyScreen() {
  useClerkTokenLogger(); // سيطبع الـ token في console
  // ... rest of your code
}
```

**الطريقة 2: من React Native Debugger**
1. افتح React Native Debugger
2. اذهب إلى Console
3. اكتب:
```javascript
// في أي component يستخدم useAuth
const { getToken } = useAuth();
getToken().then(token => console.log('Token:', token));
```

**الطريقة 3: من AsyncStorage (Advanced)**
1. افتح React Native Debugger
2. اذهب إلى AsyncStorage tab
3. ابحث عن مفتاح يبدأ بـ `clerk-`
4. انسخ الـ token

**الطريقة 4: من Network Tab**
1. افتح React Native Debugger
2. اذهب إلى Network tab
3. شاهد أي request للـ API
4. انسخ الـ `Authorization` header
5. احذف `Bearer ` من البداية

---

## 📋 Reels Endpoints (7 endpoints)

### 1️⃣ Get Reels Feed
- **Method:** `GET`
- **URL:** `/reels/feed?limit=5`
- **Description:** جلب feed الريلز
- **Tests:**
  - ✅ Status code is 200
  - ✅ Response has reels array
  - ✅ Auto-save first reel ID to `test_reel_id`

**كيفية الاستخدام:**
1. اضغط **Send**
2. سيتم حفظ أول reel ID تلقائياً في `test_reel_id`
3. باقي الـ requests ستستخدم هذا الـ ID

---

### 2️⃣ View Reel
- **Method:** `POST`
- **URL:** `/reels/{{test_reel_id}}/view`
- **Description:** زيادة عداد المشاهدات
- **Tests:**
  - ✅ Status code is 200 or 201

---

### 3️⃣ Like Reel
- **Method:** `POST`
- **URL:** `/reels/{{test_reel_id}}/like`
- **Description:** الإعجاب بالريل
- **Tests:**
  - ✅ Status code is 200 or 201

---

### 4️⃣ Unlike Reel
- **Method:** `DELETE`
- **URL:** `/reels/{{test_reel_id}}/like`
- **Description:** إلغاء الإعجاب
- **Tests:**
  - ✅ Status code is 200 or 204

---

### 5️⃣ Get Reel Comments
- **Method:** `GET`
- **URL:** `/reels/{{test_reel_id}}/comments?limit=20`
- **Description:** جلب التعليقات
- **Tests:**
  - ✅ Status code is 200
  - ✅ Response has comments array

---

### 6️⃣ Add Comment
- **Method:** `POST`
- **URL:** `/reels/{{test_reel_id}}/comments`
- **Body:**
```json
{
  "content": "Great video! 🔥",
  "parentId": null,
  "mentions": []
}
```
- **Tests:**
  - ✅ Status code is 201
  - ✅ Response has comment data

---

### 7️⃣ Retry Failed Reel
- **Method:** `POST`
- **URL:** `/reels/{{test_reel_id}}/retry`
- **Description:** إعادة معالجة Mux للريل الفاشل
- **Tests:**
  - ✅ Status code is 200 or 400

---

## 🧪 كيفية تشغيل الاختبارات

### اختبار endpoint واحد:
1. اختر الـ request
2. اضغط **Send**
3. شاهد النتائج في **Test Results** tab

### اختبار كل الـ collection:
1. اضغط على **90Plus Reels API** (اسم الـ collection)
2. اضغط **Run**
3. اختر **90Plus Production** environment
4. اضغط **Run 90Plus Reels API**
5. شاهد النتائج لكل الـ requests

---

## 📊 Test Results

بعد تشغيل الـ collection، ستحصل على:
- ✅ عدد الـ tests الناجحة
- ❌ عدد الـ tests الفاشلة
- ⏱️ وقت التنفيذ لكل request
- 📈 تقرير مفصل لكل test

---

## 🔧 Troubleshooting

### ❌ Error: 401 Unauthorized
**الحل:** تأكد من إضافة `clerk_token` صحيح في Environment

### ❌ Error: 404 Not Found
**الحل:** تأكد من:
1. تشغيل request "Get Reels Feed" أولاً
2. وجود ريلز في الـ database
3. صحة الـ `test_reel_id`

### ❌ Error: 500 Internal Server Error
**الحل:** تحقق من:
1. الـ backend server شغال
2. الـ database متصل
3. الـ logs في Railway

---

## 📝 ملاحظات مهمة

1. **الترتيب مهم:** شغل "Get Reels Feed" أولاً لملء `test_reel_id`
2. **Authentication:** كل الـ requests تحتاج Bearer Token
3. **Rate Limiting:** لا تشغل الـ requests بسرعة كبيرة
4. **Test Data:** استخدم test user لتجنب التأثير على production data

---

## 🎯 Next Steps

1. ✅ أضف `clerk_token` في Environment
2. ✅ شغل "Get Reels Feed" للحصول على test data
3. ✅ اختبر باقي الـ endpoints واحد تلو الآخر
4. ✅ شغل الـ collection كاملة للتأكد من كل شيء
5. ✅ راجع الـ test results وصلح أي errors

---

## 📞 Support

إذا واجهت أي مشاكل:
1. تحقق من الـ logs في Railway
2. راجع الـ response body في Postman
3. تأكد من الـ environment variables
4. تحقق من الـ database connection

---

**Happy Testing! 🚀**
