# ربط الملفات - Files Mapping

هذا الملف يوضح الربط بين كل ملف أسئلة في الفرونت إند وملف الإجابات المقابل في الباك إند.

## ✅ جدول الربط الكامل

| # | الفرونت إند (Frontend) | الباك إند (Backend) | Category ID | الحالة |
|---|----------------------|-------------------|-------------|--------|
| 1 | `teammates.ts` | `teammates.ts` | `04025ae4-15ac-4165-8113-e4b3f75d4145` | ✅ مرتبط |
| 2 | `in-common.ts` | `in-common.ts` | `0c64124c-0479-48d5-a315-c5ca16852635` | ✅ مرتبط |
| 3 | `high-five.ts` | `high-five.ts` | `476c5563-2e0d-406b-b103-60784b120624` | ✅ مرتبط |
| 4 | `flash.ts` | `flash.ts` | `4fa29ec6-3a01-4452-a28a-8d38113efb0e` | ✅ مرتبط |
| 5 | `who-am-i.ts` | `who-am-i.ts` | `5bd54170-2e8f-402c-a4da-bf1d09098027` | ✅ مرتبط |
| 6 | `guess-the-number.ts` | `guess-the-number.ts` | `623f7528-7cb8-44a1-891c-a970e62a8b8b` | ✅ مرتبط |
| 7 | `qa.ts` | `q-a.ts` | `867da722-843e-4ef5-851c-9c64e4ca96ba` | ✅ مرتبط |
| 8 | `legends.ts` | `legends.ts` | `b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36` | ✅ مرتبط |

## 📋 التفاصيل

### 1. Teammates (زملاء الفريق)
- **الفرونت إند**: `front/data/quizQuestions/teammates.ts`
- **الباك إند**: `Backend/src/data/quiz-answers/teammates.ts`
- **Category ID**: `04025ae4-15ac-4165-8113-e4b3f75d4145`
- **السؤال الموجود**: `ae650428-7086-49d5-8e82-6787f5d67052` → الإجابة: `"0"`

### 2. In Common (العلاقات المشتركة)
- **الفرونت إند**: `front/data/quizQuestions/in-common.ts`
- **الباك إند**: `Backend/src/data/quiz-answers/in-common.ts`
- **Category ID**: `0c64124c-0479-48d5-a315-c5ca16852635`
- **السؤال الموجود**: `af09bae9-c899-442e-bdab-f53d7f977077` → الإجابة: `"1"`

### 3. High Five (اذكر 5 أشياء)
- **الفرونت إند**: `front/data/quizQuestions/high-five.ts`
- **الباك إند**: `Backend/src/data/quiz-answers/high-five.ts`
- **Category ID**: `476c5563-2e0d-406b-b103-60784b120624`
- **السؤال الموجود**: `8bfaa35f-7941-48ff-8c43-cb33b7405be9` → الإجابة: `"0"`

### 4. Flash (أسئلة سريعة)
- **الفرونت إند**: `front/data/quizQuestions/flash.ts`
- **الباك إند**: `Backend/src/data/quiz-answers/flash.ts`
- **Category ID**: `4fa29ec6-3a01-4452-a28a-8d38113efb0e`
- **السؤال الموجود**: `afd77bba-77c9-4a8f-b363-769f4c773bb6` → الإجابة: `"2"`

### 5. Who Am I? (خمن من اللاعب)
- **الفرونت إند**: `front/data/quizQuestions/who-am-i.ts`
- **الباك إند**: `Backend/src/data/quiz-answers/who-am-i.ts`
- **Category ID**: `5bd54170-2e8f-402c-a4da-bf1d09098027`
- **السؤال الموجود**: `5532b838-727c-4ac8-bc6f-3c4f8ceb1353` → الإجابة: `"0"`

### 6. Guess the Number (خمن الرقم)
- **الفرونت إند**: `front/data/quizQuestions/guess-the-number.ts`
- **الباك إند**: `Backend/src/data/quiz-answers/guess-the-number.ts`
- **Category ID**: `623f7528-7cb8-44a1-891c-a970e62a8b8b`
- **السؤال الموجود**: `f6f99e65-a393-4a7a-979e-722705f8f856` → الإجابة: `"2"`

### 7. Q&A (أسئلة متعددة الخيارات)
- **الفرونت إند**: `front/data/quizQuestions/qa.ts`
- **الباك إند**: `Backend/src/data/quiz-answers/q-a.ts` ⚠️ (ملاحظة: اسم الملف مختلف قليلاً)
- **Category ID**: `867da722-843e-4ef5-851c-9c64e4ca96ba`
- **السؤال الموجود**: `c83ef579-2c10-4a03-b692-5225d5d39875` → الإجابة: `"1"`

### 8. Legends (احذر من الأسطورة)
- **الفرونت إند**: `front/data/quizQuestions/legends.ts`
- **الباك إند**: `Backend/src/data/quiz-answers/legends.ts`
- **Category ID**: `b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36`
- **السؤال الموجود**: `2eea17af-5a42-427d-9220-b326b4255389` → الإجابة: `"0"`

## ✅ الخلاصة

**نعم، كل ملف أسئلة في الفرونت إند مرتبط بملف إجابات مقابل في الباك إند!**

- ✅ **8 ملفات** في الفرونت إند
- ✅ **8 ملفات** في الباك إند
- ✅ **كل ملف مرتبط** باستخدام نفس `Category ID`
- ✅ **كل سؤال له إجابة** باستخدام `Question ID`

### ملاحظة مهمة:
- ملف `qa.ts` في الفرونت إند يقابله `q-a.ts` في الباك إند (اسم مختلف قليلاً لكن مرتبط بنفس Category ID)

