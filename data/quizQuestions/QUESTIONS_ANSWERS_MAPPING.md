# ربط الأسئلة بالإجابات - Questions & Answers Mapping

هذا الملف يوضح الربط بين الأسئلة في الفرونت إند والإجابات في الباك إند.

## ✅ جميع الأسئلة مرتبطة بإجاباتها

### 1. Teammates (زملاء الفريق)
- **السؤال ID**: `ae650428-7086-49d5-8e82-6787f5d67052`
- **السؤال**: "Which players formed the \"BBC\" trio at Real Madrid?"
- **الخيارات**: 
  - [0] Benzema, Bale, Cristiano ✅
  - [1] Benzema, Bale, Casemiro
  - [2] Benzema, Bale, Busquets
  - [3] Benzema, Bale, Beckham
- **الإجابة الصحيحة**: `"0"` (Benzema, Bale, Cristiano)
- **الملف في الباك إند**: `Backend/src/data/quiz-answers/teammates.ts`

### 2. Who Am I? (خمن من اللاعب)
- **السؤال ID**: `5532b838-727c-4ac8-bc6f-3c4f8ceb1353`
- **السؤال**: "I am German, I am the youngest player to score in World Cup for Germany, and I play for Bayern Munich. Who am I?"
- **الخيارات**: 
  - [0] Jamal Musiala ✅
  - [1] Florian Wirtz
  - [2] Kai Havertz
  - [3] Leroy Sané
- **الإجابة الصحيحة**: `"0"` (Jamal Musiala)
- **الملف في الباك إند**: `Backend/src/data/quiz-answers/who-am-i.ts`

### 3. Legends (احذر من الأسطورة)
- **السؤال ID**: `2eea17af-5a42-427d-9220-b326b4255389`
- **السؤال**: "Which legendary player is known as \"The King\"?"
- **الخيارات**: 
  - [0] Pelé ✅
  - [1] Diego Maradona
  - [2] Johan Cruyff
  - [3] Franz Beckenbauer
- **الإجابة الصحيحة**: `"0"` (Pelé)
- **الملف في الباك إند**: `Backend/src/data/quiz-answers/legends.ts`

### 4. In Common (العلاقات المشتركة)
- **السؤال ID**: `af09bae9-c899-442e-bdab-f53d7f977077`
- **السؤال**: "What do these players have in common?"
- **الخيارات**: 
  - [0] They all played for Real Madrid
  - [1] They all won the World Cup ✅
  - [2] They all won the Champions League
  - [3] They all won the Ballon d'Or
- **الإجابة الصحيحة**: `"1"` (They all won the World Cup)
- **الملف في الباك إند**: `Backend/src/data/quiz-answers/in-common.ts`

### 5. Flash (أسئلة سريعة)
- **السؤال ID**: `afd77bba-77c9-4a8f-b363-769f4c773bb6`
- **السؤال**: "Which country won the 2018 FIFA World Cup?"
- **الخيارات**: 
  - [0] Brazil
  - [1] Germany
  - [2] France ✅
  - [3] Argentina
- **الإجابة الصحيحة**: `"2"` (France)
- **الملف في الباك إند**: `Backend/src/data/quiz-answers/flash.ts`

### 6. High Five (اذكر 5 أشياء)
- **السؤال ID**: `8bfaa35f-7941-48ff-8c43-cb33b7405be9`
- **السؤال**: "Name 5 players who won the World Cup and Champions League"
- **الخيارات**: 
  - [0] Option A ✅
  - [1] Option B
  - [2] Option C
  - [3] Option D
- **الإجابة الصحيحة**: `"0"` (Option A)
- **الملف في الباك إند**: `Backend/src/data/quiz-answers/high-five.ts`

### 7. Q&A (أسئلة متعددة الخيارات)
- **السؤال ID**: `c83ef579-2c10-4a03-b692-5225d5d39875`
- **السؤال**: "Which player has won the most Ballon d'Or awards?"
- **الخيارات**: 
  - [0] Cristiano Ronaldo
  - [1] Lionel Messi ✅
  - [2] Pelé
  - [3] Diego Maradona
- **الإجابة الصحيحة**: `"1"` (Lionel Messi)
- **الملف في الباك إند**: `Backend/src/data/quiz-answers/q-a.ts`

### 8. Guess the Number (خمن الرقم)
- **السؤال ID**: `f6f99e65-a393-4a7a-979e-722705f8f856`
- **السؤال**: "How many World Cups has Brazil won?"
- **الخيارات**: 
  - [0] 3
  - [1] 4
  - [2] 5 ✅
  - [3] 6
- **الإجابة الصحيحة**: `"2"` (5)
- **الملف في الباك إند**: `Backend/src/data/quiz-answers/guess-the-number.ts`

---

## 📁 هيكل الملفات

### Frontend (الفرونت إند)
```
front/data/quizQuestions/
├── index.ts                    # الفهرس الرئيسي
├── teammates.ts               # أسئلة زملاء الفريق
├── in-common.ts               # أسئلة العلاقات المشتركة
├── high-five.ts               # أسئلة "اذكر 5 أشياء"
├── flash.ts                   # أسئلة سريعة
├── who-am-i.ts               # أسئلة "خمن من اللاعب"
├── guess-the-number.ts        # أسئلة "خمن الرقم"
├── qa.ts                      # أسئلة متعددة الخيارات
└── legends.ts                 # أسئلة "احذر من الأسطورة"
```

### Backend (الباك إند)
```
Backend/src/data/quiz-answers/
├── index.ts                    # الفهرس الرئيسي
├── teammates.ts               # إجابات زملاء الفريق
├── in-common.ts               # إجابات العلاقات المشتركة
├── high-five.ts               # إجابات "اذكر 5 أشياء"
├── flash.ts                   # إجابات سريعة
├── who-am-i.ts               # إجابات "خمن من اللاعب"
├── guess-the-number.ts        # إجابات "خمن الرقم"
├── q-a.ts                     # إجابات متعددة الخيارات
└── legends.ts                 # إجابات "احذر من الأسطورة"
```

---

## ✅ التحقق من الربط

جميع الأسئلة في الفرونت إند مرتبطة بإجاباتها في الباك إند باستخدام:
- **Question ID**: معرف فريد لكل سؤال
- **Answer Index**: رقم الخيار الصحيح (0, 1, 2, أو 3)

كل سؤال في الفرونت إند له إجابة مقابلة في الباك إند بنفس الـ ID.

