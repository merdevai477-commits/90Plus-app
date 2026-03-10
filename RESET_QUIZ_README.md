# كيفية إعادة تعيين الكويز اليومي

## ⚡ الطريقة الأسهل: استخدام Secret Key (موصى بها)

يمكنك استخدام Secret Key من environment variable بدون الحاجة لـ authentication:

### 1. إضافة Secret Key في Railway:

1. اذهب إلى Railway Dashboard
2. اختر مشروعك
3. اذهب إلى Variables
4. أضف متغير جديد:
   - **Name**: `QUIZ_RESET_SECRET_KEY`
   - **Value**: أي قيمة سرية (مثل: `my-secret-quiz-key-2025`)

### 2. استخدام PowerShell Script:

```powershell
.\reset-daily-quiz.ps1 -ApiKey "my-secret-quiz-key-2025"
```

### 3. استخدام cURL مباشرة:

```bash
curl -X POST "https://90plus-app-production.up.railway.app/api/quiz/reset-daily" \
  -H "X-API-Key: my-secret-quiz-key-2025" \
  -H "Content-Type: application/json"
```

### 4. استخدام من التطبيق (Frontend):

يمكنك إضافة زر في التطبيق يستدعي الـ endpoint مباشرة:

```typescript
const resetDailyQuiz = async () => {
  const response = await fetch('https://90plus-app-production.up.railway.app/api/quiz/reset-daily', {
    method: 'POST',
    headers: {
      'X-API-Key': 'my-secret-quiz-key-2025', // أو من environment variable
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  console.log('Quiz reset:', data);
};
```

---

## الطريقة 2: استخدام PowerShell Script مع Token (Windows)

1. افتح PowerShell في مجلد `Backend`
2. احصل على Clerk Token من التطبيق أو من Clerk Dashboard
3. شغل الأمر:

```powershell
.\reset-daily-quiz.ps1 -Token "your-clerk-token-here"
```

## الطريقة 2: استخدام Bash Script (Linux/Mac)

1. افتح Terminal في مجلد `Backend`
2. اجعل الملف قابل للتنفيذ:
```bash
chmod +x reset-daily-quiz.sh
```

3. شغل الأمر:
```bash
./reset-daily-quiz.sh your-clerk-token-here
```

## الطريقة 3: استخدام cURL مباشرة

```bash
curl -X POST "https://90plus-app-production.up.railway.app/api/quiz/reset-daily" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json"
```

## الطريقة 4: استخدام Postman أو أي HTTP Client

1. Method: `POST`
2. URL: `https://90plus-app-production.up.railway.app/api/quiz/reset-daily`
3. Headers:
   - `Authorization: Bearer YOUR_CLERK_TOKEN`
   - `Content-Type: application/json`

## الطريقة 5: من خلال التطبيق (Frontend)

يمكنك إضافة زر في لوحة التحكم (Admin Panel) لاستدعاء هذا الـ endpoint.

## كيفية الحصول على Clerk Token

### من التطبيق:
1. افتح التطبيق
2. افتح Developer Tools (F12)
3. اذهب إلى Network tab
4. قم بأي عملية في التطبيق
5. ابحث عن أي request وستجد الـ token في Header `Authorization`

### من Clerk Dashboard:
1. اذهب إلى [Clerk Dashboard](https://dashboard.clerk.com)
2. اختر تطبيقك
3. اذهب إلى API Keys
4. يمكنك استخدام Session Token أو API Key

## ملاحظات

- هذا الـ endpoint يتطلب authentication (يجب أن تكون مسجل دخول)
- بعد استدعاء الـ endpoint، سيتم:
  - إنشاء كويز يومي جديد يبدأ من الوقت الحالي
  - حذف جميع المحاولات القديمة (إعادة تعيين cooldown لجميع المستخدمين)
  - اختيار كاتيجوري عشوائية و20 سؤال عشوائي

## Response Example

```json
{
  "status": "SUCCESS",
  "message": "Daily quiz reset successfully",
  "data": {
    "quizId": "uuid-here",
    "categoryId": "category-uuid",
    "categoryName": "Q&A",
    "questionCount": 20,
    "expiresAt": "2025-01-01T12:00:00.000Z",
    "usersReset": 0
  }
}
```

