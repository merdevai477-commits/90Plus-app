# مكان الأسئلة والإجابات في الباك إند

## 🗄️ **قاعدة البيانات (PostgreSQL)**

### جدول الأسئلة: `quiz_questions`
```sql
model QuizQuestion {
  id            String     @id @default(uuid())
  categoryId    String     -- معرف الفئة
  question      String     -- نص السؤال
  options       String[]   -- الخيارات الأربعة
  correctAnswer String     -- الإجابة الصحيحة (0, 1, 2, 3)
  difficulty    Difficulty -- EASY, MEDIUM, HARD
  points        Int        -- النقاط (افتراضي 10)
  imageUrl      String?    -- رابط الصورة (اختياري)
  imageType     String?    -- نوع الصورة (player, club, etc.)
  hint          String?    -- تلميح (اختياري)
  timeLimit     Int        -- الوقت المحدد (افتراضي 15 ثانية)
  createdAt     DateTime   -- تاريخ الإنشاء
}
```

### جدول الفئات: `quiz_categories`
```sql
model QuizCategory {
  id          String  @id @default(uuid())
  name        String  -- اسم الفئة
  icon        String? -- أيقونة الفئة
  description String? -- وصف الفئة
  isLocked    Boolean -- مقفلة أم لا
  unlockLevel Int     -- المستوى المطلوب للفتح
}
```

## 📁 **ملفات البيانات**

### 1. ملف Seed الأسئلة
```
📍 Backend/prisma/quiz-questions-seed.ts
```
- **المحتوى:** 800 سؤال موزعة على 8 فئات
- **كل فئة:** 100 سؤال فريد
- **الفئات:**
  - In Common (المشترك)
  - Flash (البرق)
  - Who Am I (من أنا)
  - High Five (الخمسة العالية)
  - Q&A (سؤال وجواب)
  - Teammates (زملاء الفريق)
  - Guess Number (خمن الرقم)
  - **Legends (الأساطير)** ← الكويز اليومي

### 2. ملفات الإجابات
```
📍 Backend/src/data/quiz-answers/
├── index.ts           -- فهرس جميع الإجابات
├── legends.ts         -- 100 إجابة للأساطير
├── flash.ts           -- 100 إجابة للبرق
├── who-am-i.ts        -- 100 إجابة لمن أنا
├── high-five.ts       -- 100 إجابة للخمسة العالية
├── q-a.ts             -- 100 إجابة لسؤال وجواب
├── teammates.ts       -- 100 إجابة لزملاء الفريق
├── guess-the-number.ts -- 100 إجابة لخمن الرقم
└── in-common.ts       -- 100 إجابة للمشترك
```

### 3. مثال على بنية الإجابات
```typescript
// Backend/src/data/quiz-answers/legends.ts
export const LEGENDS_ANSWERS: Record<string, string> = {
  "ef58f584-8135-4a57-8615-8835473a4665": "Midfielder",
  "e909aa88-24b4-4d3a-85cb-d15445e26638": "Goalkeeper",
  "bc85dc91-d388-48d6-a4ae-9bcf8fc17db9": "Vincent Kompany",
  // ... 100 إجابة
};
```

## 🔄 **خدمات الكويز**

### 1. خدمة الكويز اليومي
```
📍 Backend/src/services/daily-quiz.service.ts
```

**الوظائف الرئيسية:**
- `getOrCreateDailyQuiz()` - إنشاء/جلب الكويز اليومي
- `getCurrentDailyQuiz()` - جلب الكويز الحالي فقط
- `canUserTakeDailyQuiz()` - فحص إمكانية أخذ الكويز

### 2. Routes الكويز
```
📍 Backend/src/routes/quiz.routes.ts
```

**الـ Endpoints:**
- `POST /api/quiz/daily` - جلب الكويز اليومي
- `GET /api/quiz/daily-status` - حالة الكويز اليومي
- `POST /api/quiz/daily/answers` - جلب إجابات الكويز اليومي
- `POST /api/quiz/answers` - جلب إجابات أي كويز

## 🎯 **كيف يعمل النظام**

### 1. إنشاء الكويز اليومي
```typescript
// كل يوم في الساعة 00:00 UTC
// يتم إنشاء كويز جديد تلقائياً من فئة "الأساطير"
// 20 سؤال عشوائي من 100 سؤال متاح

const dailyQuiz = await getOrCreateDailyQuiz();
// Result: {
//   id: "uuid",
//   categoryId: "legends-category-id",
//   questionIds: ["q1", "q2", ..., "q20"],
//   date: "2026-01-26",
//   expiresAt: "2026-01-27T00:00:00Z"
// }
```

### 2. جلب الأسئلة
```typescript
// من قاعدة البيانات PostgreSQL
const questions = await prisma.quizQuestion.findMany({
  where: {
    id: { in: dailyQuiz.questionIds },
    categoryId: dailyQuiz.categoryId,
  },
  select: {
    id: true,
    question: true,
    options: true,
    difficulty: true,
    points: true,
    imageUrl: true,
    imageType: true,
    hint: true,
    timeLimit: true,
  }
});
```

### 3. جلب الإجابات
```typescript
// من ملفات البيانات المحلية
import { ANSWERS_BY_CATEGORY_ID } from '../data/quiz-answers';

const categoryAnswers = ANSWERS_BY_CATEGORY_ID[categoryId];
const answers = questionIds.reduce((acc, questionId) => {
  acc[questionId] = categoryAnswers[questionId] || '0';
  return acc;
}, {});
```

## 📊 **إحصائيات البيانات**

### الأسئلة في قاعدة البيانات:
- **المجموع:** 800 سؤال
- **الأساطير:** 100 سؤال (للكويز اليومي)
- **باقي الفئات:** 700 سؤال (7 × 100)

### الإجابات في الملفات:
- **المجموع:** 800 إجابة
- **كل ملف:** 100 إجابة
- **التنسيق:** `{ questionId: correctAnswer }`

### الكويز اليومي:
- **الفئة:** الأساطير فقط
- **عدد الأسئلة:** 20 سؤال يومياً
- **التجديد:** كل 24 ساعة تلقائياً
- **الاختيار:** عشوائي من 100 سؤال متاح

## 🔧 **إضافة أسئلة جديدة**

### 1. إضافة للقاعدة:
```sql
INSERT INTO quiz_questions (
  id, categoryId, question, options, 
  correctAnswer, difficulty, points, imageUrl
) VALUES (
  uuid_generate_v4(),
  'legends-category-id',
  'من فاز بكأس العالم 2022؟',
  ARRAY['الأرجنتين', 'فرنسا', 'البرازيل', 'ألمانيا'],
  '0',
  'EASY',
  10,
  'https://example.com/image.jpg'
);
```

### 2. إضافة الإجابة:
```typescript
// Backend/src/data/quiz-answers/legends.ts
export const LEGENDS_ANSWERS: Record<string, string> = {
  // ... الإجابات الموجودة
  "new-question-id": "0", // الإجابة الجديدة
};
```

## 🚀 **الخلاصة**

**الأسئلة:** في قاعدة البيانات PostgreSQL  
**الإجابات:** في ملفات TypeScript محلية  
**الكويز اليومي:** 20 سؤال من الأساطير، يتجدد كل 24 ساعة  
**النظام:** احترافي مع caching و error handling شامل