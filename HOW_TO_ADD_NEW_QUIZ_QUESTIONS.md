# كيفية إضافة أسئلة جديدة للكويز 📝

## 🎯 **الخطوات الكاملة لإضافة سؤال جديد**

### 1️⃣ **إضافة السؤال لقاعدة البيانات**

#### A. باستخدام Prisma Studio (الأسهل):
```bash
cd Backend
npx prisma studio
```
ثم:
1. اذهب لجدول `QuizQuestion`
2. اضغط `Add record`
3. املأ البيانات:
   - `question`: نص السؤال
   - `options`: الخيارات الأربعة `["خيار 1", "خيار 2", "خيار 3", "خيار 4"]`
   - `correctAnswer`: رقم الإجابة الصحيحة `"0"` أو `"1"` أو `"2"` أو `"3"`
   - `categoryId`: معرف الفئة (للأساطير: `b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36`)
   - `difficulty`: `EASY` أو `MEDIUM` أو `HARD`
   - `points`: النقاط (10 للسهل، 20 للمتوسط، 30 للصعب)
   - `imageUrl`: رابط الصورة (اختياري)
   - `imageType`: نوع الصورة (`player`, `club`, `stadium`, etc.)
   - `displayMode`: كيفية عرض الصورة (`NEVER`, `AFTER_ANSWER`, etc.)
   - `hint`: تلميح (اختياري)
   - `timeLimit`: الوقت بالثواني (افتراضي 15)

#### B. باستخدام SQL مباشرة:
```sql
INSERT INTO quiz_questions (
    id, "categoryId", question, options, "correctAnswer", 
    difficulty, points, "imageUrl", "imageType", "displayMode", 
    hint, "timeLimit", "createdAt"
) VALUES (
    gen_random_uuid(),
    'b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36', -- معرف فئة الأساطير
    'من فاز بكأس العالم 2022؟',
    ARRAY['الأرجنتين', 'فرنسا', 'البرازيل', 'ألمانيا'],
    '0', -- الأرجنتين (الخيار الأول)
    'EASY',
    10,
    'https://example.com/world-cup-2022.jpg',
    'trophy',
    'AFTER_ANSWER',
    'كانت النهائية بين الأرجنتين وفرنسا',
    20,
    NOW()
);
```

### 2️⃣ **إضافة الإجابة للملف المحلي**

افتح الملف: `Backend/src/data/quiz-answers/legends.ts`

```typescript
export const LEGENDS_ANSWERS: Record<string, string> = {
  // ... الإجابات الموجودة
  
  // إضافة الإجابة الجديدة
  "معرف-السؤال-الجديد": "0", // رقم الإجابة الصحيحة
};
```

**مثال كامل:**
```typescript
export const LEGENDS_ANSWERS: Record<string, string> = {
  "ef58f584-8135-4a57-8615-8835473a4665": "Midfielder",
  "e909aa88-24b4-4d3a-85cb-d15445e26638": "Goalkeeper",
  // ... باقي الإجابات
  
  // السؤال الجديد
  "12345678-1234-1234-1234-123456789abc": "0", // الأرجنتين
};
```

### 3️⃣ **معرفات الفئات المهمة**

```typescript
const CATEGORY_IDS = {
  legends: 'b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36',    // الأساطير (الكويز اليومي)
  flash: '4fa29ec6-3a01-4452-a28a-8d38113efb0e',      // البرق
  whoAmI: '5bd54170-2e8f-402c-a4da-bf1d09098027',     // من أنا
  highFive: '476c5563-2e0d-406b-b103-60784b120624',   // الخمسة العالية
  qa: '867da722-843e-4ef5-851c-9c64e4ca96ba',         // سؤال وجواب
  teammates: '04025ae4-15ac-4165-8113-e4b3f75d4145',  // زملاء الفريق
  guessNumber: '623f7528-7cb8-44a1-891c-a970e62a8b8b', // خمن الرقم
  inCommon: '0c64124c-0479-48d5-a315-c5ca16852635',   // المشترك
};
```

## 🖼️ **إضافة الصور**

### 1. **رفع الصورة:**
- استخدم خدمة مثل Cloudinary, AWS S3, أو أي خدمة تخزين صور
- احصل على الرابط المباشر للصورة

### 2. **أنواع الصور المدعومة:**
```typescript
type ImageType = 
  | 'player'    // صورة لاعب
  | 'club'      // شعار نادي
  | 'stadium'   // صورة ملعب
  | 'trophy'    // صورة كأس/جائزة
  | 'manager'   // صورة مدرب
  | 'flag'      // علم دولة
  | 'general';  // صورة عامة
```

### 3. **أنماط عرض الصور:**
```typescript
type DisplayMode = 
  | 'NEVER'           // لا تظهر الصورة قبل الإجابة
  | 'AFTER_ANSWER'    // تظهر بعد الإجابة (صحيحة أو خاطئة)
  | 'BEFORE_QUESTION' // تظهر قبل السؤال
  | 'IN_QUESTION'     // تظهر مع السؤال
  | 'AFTER_WRONG'     // تظهر فقط بعد الإجابة الخاطئة
  | 'BLUR_REVEAL';    // تظهر مشوشة ثم تتضح
```

## 📋 **مثال كامل: إضافة سؤال جديد**

### 1. إضافة للقاعدة (SQL):
```sql
INSERT INTO quiz_questions (
    id, "categoryId", question, options, "correctAnswer", 
    difficulty, points, "imageUrl", "imageType", "displayMode", 
    hint, "timeLimit", "createdAt"
) VALUES (
    'new-question-2026-001',
    'b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36',
    'من هو أفضل لاعب في العالم 2023؟',
    ARRAY['ليونيل ميسي', 'كريستيانو رونالدو', 'كيليان مبابي', 'إرلينغ هالاند'],
    '0',
    'MEDIUM',
    20,
    'https://example.com/messi-2023.jpg',
    'player',
    'AFTER_ANSWER',
    'فاز بكأس العالم 2022',
    25,
    NOW()
);
```

### 2. إضافة الإجابة (legends.ts):
```typescript
export const LEGENDS_ANSWERS: Record<string, string> = {
  // ... الإجابات الموجودة
  "new-question-2026-001": "0", // ليونيل ميسي
};
```

## 🔄 **بعد الإضافة**

### لا حاجة لإعادة تشغيل التطبيق!
- الأسئلة تأتي من قاعدة البيانات مباشرة
- الإجابات تأتي من الملفات المحلية
- التحديث فوري

### للتأكد من الإضافة:
```bash
# فحص قاعدة البيانات
cd Backend
npx prisma studio

# أو استعلام SQL
SELECT id, question, options, "correctAnswer" 
FROM quiz_questions 
WHERE "categoryId" = 'b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36'
ORDER BY "createdAt" DESC
LIMIT 5;
```

## 🎯 **نصائح مهمة**

### 1. **للكويز اليومي (الأساطير):**
- استخدم `categoryId`: `b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36`
- الأسئلة الجديدة ستظهر في الكويز اليومي تلقائياً

### 2. **للصور:**
- استخدم روابط HTTPS
- تأكد من أن الصورة متاحة دائماً
- حجم مناسب (لا يزيد عن 1MB)

### 3. **للإجابات:**
- استخدم أرقام: "0", "1", "2", "3"
- تأكد من صحة رقم الإجابة
- أضف الإجابة للملف المحلي فوراً

### 4. **للاختبار:**
- جرب السؤال في الكويز اليومي
- تأكد من ظهور الصورة بشكل صحيح
- تأكد من صحة الإجابة

## 🚀 **الخلاصة**

**إضافة سؤال جديد = خطوتان فقط:**
1. **إضافة السؤال** لقاعدة البيانات
2. **إضافة الإجابة** للملف المحلي

**النتيجة:** السؤال يظهر في الكويز اليومي فوراً! 🎉