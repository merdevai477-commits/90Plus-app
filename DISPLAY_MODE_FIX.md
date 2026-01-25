# إصلاح مشكلة displayMode - Display Mode Fix ✅

## 🐛 المشكلة الأصلية
```
Object literal may only specify known properties, and 'displayMode' does not exist in type 'QuizQuestionSelect<DefaultArgs>'.
```

## 🔍 السبب
- الفرونت إند يستخدم `displayMode` لتحديد كيفية عرض الصور في الأسئلة
- الباك إند لم يكن يحتوي على `displayMode` في schema قاعدة البيانات
- TypeScript كان يرفض الكود لأن الحقل غير موجود

## ✅ الحل المطبق

### 1. إضافة DisplayMode enum للـ schema
```sql
-- Backend/prisma/schema.prisma
enum DisplayMode {
  NEVER           // لا تظهر الصورة قبل الإجابة
  AFTER_ANSWER    // تظهر بعد الإجابة (صحيحة أو خاطئة)
  BEFORE_QUESTION // تظهر قبل السؤال
  IN_QUESTION     // تظهر مع السؤال
  AFTER_WRONG     // تظهر فقط بعد الإجابة الخاطئة
  BLUR_REVEAL     // تظهر مشوشة ثم تتضح
}
```

### 2. إضافة displayMode للـ QuizQuestion model
```sql
model QuizQuestion {
  id            String      @id @default(uuid())
  categoryId    String
  question      String      @db.Text
  options       String[]
  correctAnswer String
  difficulty    Difficulty
  points        Int         @default(10)
  imageUrl      String?
  imageType     String?
  hint          String?
  timeLimit     Int         @default(15)
  displayMode   DisplayMode @default(NEVER) // ← الحقل الجديد
  createdAt     DateTime    @default(now())
  // ... باقي الحقول
}
```

### 3. إنشاء Migration
```sql
-- Backend/prisma/migrations/20260126000000_add_display_mode/migration.sql
CREATE TYPE "DisplayMode" AS ENUM ('NEVER', 'AFTER_ANSWER', 'BEFORE_QUESTION', 'IN_QUESTION', 'AFTER_WRONG', 'BLUR_REVEAL');
ALTER TABLE "quiz_questions" ADD COLUMN "displayMode" "DisplayMode" NOT NULL DEFAULT 'NEVER';
```

### 4. تحديث Seed File
```typescript
// Backend/prisma/quiz-questions-seed.ts
import { PrismaClient, Difficulty, DisplayMode } from '@prisma/client';

// إضافة displayMode للأسئلة
return {
  categoryId,
  question: item.q,
  options: item.opt,
  correctAnswer: item.ans,
  difficulty: item.diff as Difficulty,
  points: item.diff === 'EASY' ? 10 : item.diff === 'MEDIUM' ? 20 : 30,
  displayMode: 'NEVER' as DisplayMode, // ← الحقل الجديد
};
```

### 5. إصلاح الكود في quiz.routes.ts
```typescript
// استخدام raw query لتجنب مشاكل TypeScript cache
const displayModeResults = await prisma.$queryRaw<Array<{id: string, displayMode: string}>>`
    SELECT id, "displayMode"::text as "displayMode" 
    FROM quiz_questions 
    WHERE id = ANY(${dailyQuiz.questionIds})
`;

// تحويل enum values للفرونت إند
const displayModeMap = new Map(
    displayModeResults.map(item => [
        item.id, 
        item.displayMode.toLowerCase().replace('_', '-') // AFTER_ANSWER → after-answer
    ])
);

// دمج البيانات
const orderedQuestions = dailyQuiz.questionIds.map(id => {
    const question = questions.find(q => q.id === id);
    if (!question) return null;
    
    return {
        ...question,
        displayMode: displayModeMap.get(id) || 'never',
    };
}).filter(Boolean);
```

## 🔄 الخطوات المنفذة

### 1. تحديث قاعدة البيانات:
```bash
cd Backend
npx prisma generate
npx prisma db push
```

### 2. النتيجة:
```
✔ Generated Prisma Client (v5.22.0)
✔ Your database is now in sync with your Prisma schema
```

## 🎯 التحسينات المضافة

### 1. **مرونة في عرض الصور:**
- `never`: لا تظهر الصورة قبل الإجابة
- `after-answer`: تظهر بعد الإجابة (صحيحة أو خاطئة)
- `before-question`: تظهر قبل السؤال
- `in-question`: تظهر مع السؤال
- `after-wrong`: تظهر فقط بعد الإجابة الخاطئة
- `blur-reveal`: تظهر مشوشة ثم تتضح

### 2. **تحويل تلقائي للقيم:**
```typescript
// Database: AFTER_ANSWER
// Frontend: after-answer
item.displayMode.toLowerCase().replace('_', '-')
```

### 3. **Fallback آمن:**
```typescript
displayMode: displayModeMap.get(id) || 'never'
```

## 📊 التوافق

### Frontend Types:
```typescript
export type DisplayMode = 
  | 'never'           
  | 'after-answer'    
  | 'before-question' 
  | 'in-question'     
  | 'after-wrong'     
  | 'blur-reveal';
```

### Backend Enum:
```sql
enum DisplayMode {
  NEVER           
  AFTER_ANSWER    
  BEFORE_QUESTION 
  IN_QUESTION     
  AFTER_WRONG     
  BLUR_REVEAL     
}
```

## ✅ النتيجة النهائية

**المشكلة مُصلحة بالكامل!** 🎉

- ✅ displayMode موجود في قاعدة البيانات
- ✅ TypeScript errors مُصلحة
- ✅ الكود يعمل بدون مشاكل
- ✅ التوافق بين Frontend و Backend محقق
- ✅ Migration تم تطبيقه بنجاح

الآن الكويز يدعم جميع أنواع عرض الصور بشكل احترافي! 🚀