# 🧠 صفحة الأسئلة (Quiz) - دليل شامل

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [نظام اللعبة](#نظام-اللعبة)
3. [أنواع الأسئلة](#أنواع-الأسئلة)
4. [نظام النقاط](#نظام-النقاط)
5. [الواجهة والتصميم](#الواجهة-والتصميم)
6. [الأنيميشن والتأثيرات](#الأنيميشن-والتأثيرات)
7. [نظام المكافآت](#نظام-المكافآت)
8. [الإحصائيات](#الإحصائيات)
9. [التفاصيل التقنية](#التفاصيل-التقنية)

---

## 🎯 نظرة عامة

صفحة الأسئلة هي لعبة تفاعلية تختبر معرفة المستخدم بكرة القدم من خلال:
- 🎮 **20 سؤال** متنوع
- ⏱️ **15 ثانية** لكل سؤال
- 💰 **عملات ذهبية** كمكافآت
- 🏆 **نظام نقاط** متقدم
- 📊 **إحصائيات** تفصيلية

### المسار
```
app/(tabs)/quiz.tsx
```

---

## 🎮 نظام اللعبة

### قواعد اللعبة

**1. عدد الأسئلة**
```typescript
const MAX_QUESTIONS = 20;
```
- 📝 20 سؤال في كل جولة
- 🔀 عشوائية من بنك أسئلة كبير
- 🎯 تنوع في الصعوبة

**2. الوقت المحدد**
```typescript
const TIME_PER_QUESTION = 15; // ثانية
```
- ⏱️ 15 ثانية لكل سؤال
- ⏰ عداد تنازلي مرئي
- 🔴 تحذير عند 5 ثوان متبقية

**3. نظام الإجابة**
- ✅ إجابة واحدة صحيحة
- ❌ 3 إجابات خاطئة
- 🎯 4 خيارات لكل سؤال
- 🚫 لا يمكن التراجع

---

## 📚 أنواع الأسئلة

### 1. أسئلة اللاعبين
```typescript
{
  question: "من هو أفضل لاعب في العالم 2023؟",
  options: ["ميسي", "رونالدو", "مبابي", "هالاند"],
  correctAnswer: 0,
  category: "players",
  difficulty: "medium"
}
```

**مواضيع:**
- 🏆 أفضل لاعب
- ⚽ الهدافين
- 🎯 الأرقام القياسية
- 📊 الإحصائيات

### 2. أسئلة الأندية
```typescript
{
  question: "كم مرة فاز ريال مدريد بدوري أبطال أوروبا؟",
  options: ["13", "14", "15", "16"],
  correctAnswer: 1,
  category: "clubs",
  difficulty: "hard"
}
```

**مواضيع:**
- 🏆 البطولات
- 📅 التاريخ
- 🎨 الشعارات
- 🏟️ الملاعب

### 3. أسئلة المنتخبات
```typescript
{
  question: "من فاز بكأس العالم 2022؟",
  options: ["الأرجنتين", "فرنسا", "البرازيل", "ألمانيا"],
  correctAnswer: 0,
  category: "national",
  difficulty: "easy"
}
```

**مواضيع:**
- 🌍 كأس العالم
- 🏆 البطولات القارية
- 🎖️ الإنجازات
- 📊 الإحصائيات

### 4. أسئلة القوانين
```typescript
{
  question: "كم عدد اللاعبين في الفريق الواحد؟",
  options: ["10", "11", "12", "13"],
  correctAnswer: 1,
  category: "rules",
  difficulty: "easy"
}
```

**مواضيع:**
- 📜 قوانين اللعبة
- 🟨 البطاقات
- ⚽ ركلات الجزاء
- 🏃 التسلل

---

## 💰 نظام النقاط

### حساب النقاط

**1. الإجابة الصحيحة**
```typescript
const basePoints = 10;
const timeBonus = Math.floor(timeLeft / 3);
const totalPoints = basePoints + timeBonus;
```

**مثال:**
- ⏱️ أجبت في 12 ثانية → متبقي 3 ثوان
- 🎯 نقاط أساسية: 10
- ⚡ بونص الوقت: 1 نقطة
- 💰 **المجموع: 11 نقطة**

**2. الإجابة الخاطئة**
```typescript
points = 0;
streak = 0; // تصفير السلسلة
```

### نظام السلسلة (Streak)

**كيف يعمل:**
```typescript
correctAnswer → streak++
wrongAnswer → streak = 0
```

**المكافآت:**
- 🔥 **3 متتالية** → +5 نقاط إضافية
- 🔥 **5 متتالية** → +10 نقاط إضافية
- 🔥 **10 متتالية** → +20 نقاط إضافية

### العملات الذهبية

**التحويل:**
```typescript
goldCoins = Math.floor(totalScore / 10);
```

**مثال:**
- 📊 النقاط: 150
- 💰 العملات: 15 عملة ذهبية

---

## 🎨 الواجهة والتصميم

### شاشة اللعب

```
┌─────────────────────────────────────┐
│  ⏱️ 12s    السؤال 5/20    🔥 3     │
├─────────────────────────────────────┤
│                                     │
│  من هو أفضل لاعب في العالم 2023؟  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  A. ليونيل ميسي            │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  B. كريستيانو رونالدو      │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  C. كيليان مبابي           │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  D. إيرلينج هالاند         │   │
│  └─────────────────────────────┘   │
│                                     │
│         💎 النقاط: 45              │
└─────────────────────────────────────┘
```

### المكونات الرئيسية

**1. Header**
- ⏱️ **Timer** - عداد تنازلي
- 📊 **Progress** - رقم السؤال
- 🔥 **Streak** - السلسلة الحالية

**2. Question Card**
- 📝 **السؤال** - نص واضح
- 🎨 **Background** - gradient جذاب
- 💫 **Animation** - fade in

**3. Options**
- 🔘 **4 خيارات** - A, B, C, D
- 🎯 **Tap to select** - سهل الاستخدام
- ✅ **Visual feedback** - تغيير اللون

**4. Footer**
- 💎 **النقاط** - العرض الحالي
- ⏸️ **Pause** - زر الإيقاف

---

## ✨ الأنيميشن والتأثيرات

### 1. دخول السؤال
```typescript
Animated.sequence([
  Animated.timing(fadeAnim, {
    toValue: 0,
    duration: 200,
  }),
  Animated.parallel([
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
    }),
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
    }),
  ]),
]).start();
```

**التأثير:**
- 📉 Fade out السؤال القديم
- 📈 Fade in السؤال الجديد
- 🎢 Slide من الأسفل

### 2. اختيار الإجابة
```typescript
Animated.sequence([
  Animated.timing(scaleAnim, {
    toValue: 0.95,
    duration: 100,
  }),
  Animated.spring(scaleAnim, {
    toValue: 1,
    tension: 100,
  }),
]).start();
```

**التأثير:**
- 📉 Scale down عند الضغط
- 📈 Spring back للحجم الطبيعي

### 3. الإجابة الصحيحة
```typescript
// ✅ لون أخضر
backgroundColor: '#22c55e'

// 🎉 Confetti animation
// 🔊 Success sound
// 📳 Haptic feedback (success)
```

### 4. الإجابة الخاطئة
```typescript
// ❌ لون أحمر
backgroundColor: '#ef4444'

// 💥 Shake animation
// 🔊 Error sound
// 📳 Haptic feedback (error)
```

### 5. Timer Warning
```typescript
if (timeLeft <= 5) {
  // 🔴 لون أحمر
  // 💓 Pulse animation
  // ⚠️ تحذير بصري
}
```

---

## 🏆 نظام المكافآت

### شاشة النتائج

```
┌─────────────────────────────────────┐
│                                     │
│         🎉 مبروك!                   │
│    لقد أكملت الاختبار بنجاح         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  📊 النقاط: 150             │   │
│  │  🎯 الدقة: 75%              │   │
│  │  ✅ صحيحة: 15/20            │   │
│  │  🔥 أفضل سلسلة: 7           │   │
│  │  💰 عملات ذهبية: 15         │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      🔄 لعب مرة أخرى        │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### الإنجازات

**1. Perfect Score**
- 🏆 20/20 إجابة صحيحة
- 💎 +50 عملة ذهبية إضافية
- 🎖️ شارة "العبقري"

**2. Speed Master**
- ⚡ إجابة سريعة (< 5 ثوان)
- 💎 +10 عملات إضافية
- 🎖️ شارة "السريع"

**3. Streak King**
- 🔥 سلسلة 10+ متتالية
- 💎 +20 عملة إضافية
- 🎖️ شارة "الملك"

---

## 📊 الإحصائيات

### البيانات المحفوظة

```typescript
interface QuizStats {
  totalGames: number;           // إجمالي الألعاب
  totalQuestions: number;       // إجمالي الأسئلة
  correctAnswers: number;       // الإجابات الصحيحة
  wrongAnswers: number;         // الإجابات الخاطئة
  averageScore: number;         // متوسط النقاط
  bestScore: number;            // أفضل نقاط
  bestStreak: number;           // أفضل سلسلة
  totalCoins: number;           // إجمالي العملات
  accuracy: number;             // نسبة الدقة
  averageTime: number;          // متوسط الوقت
}
```

### حساب الدقة
```typescript
accuracy = (correctAnswers / totalQuestions) × 100
```

### الترتيب
```typescript
// حسب النقاط
rank = position in global leaderboard
```

---

## 🎮 ميزات إضافية

### 1. Pause/Resume
```typescript
const [isPaused, setIsPaused] = useState(false);

// عند الإيقاف:
- ⏸️ إيقاف العداد
- 🔒 تعطيل الإجابات
- 📱 عرض شاشة الإيقاف
```

### 2. Sound Effects
```typescript
// ✅ صوت الإجابة الصحيحة
await Audio.Sound.createAsync(correctSound);

// ❌ صوت الإجابة الخاطئة
await Audio.Sound.createAsync(wrongSound);

// ⏱️ صوت انتهاء الوقت
await Audio.Sound.createAsync(timeoutSound);
```

### 3. Haptic Feedback
```typescript
// عند الإجابة الصحيحة
Haptics.notificationAsync(
  Haptics.NotificationFeedbackType.Success
);

// عند الإجابة الخاطئة
Haptics.notificationAsync(
  Haptics.NotificationFeedbackType.Error
);
```

### 4. Progress Saving
```typescript
// حفظ التقدم تلقائياً
await AsyncStorage.setItem('quiz_progress', JSON.stringify({
  currentQuestion: index,
  score: score,
  answers: answers,
}));
```

---

## 🔧 التفاصيل التقنية

### State Management
```typescript
const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
const [isAnswered, setIsAnswered] = useState(false);
const [score, setScore] = useState(0);
const [correctAnswers, setCorrectAnswers] = useState(0);
const [isPaused, setIsPaused] = useState(false);
const [showResult, setShowResult] = useState(false);
const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
const [streak, setStreak] = useState(0);
const [bestStreak, setBestStreak] = useState(0);
```

### Timer Logic
```typescript
useEffect(() => {
  if (isPaused || isAnswered) return;
  
  const timer = setInterval(() => {
    setTimeLeft(prev => {
      if (prev <= 1) {
        handleTimeout();
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  
  return () => clearInterval(timer);
}, [isPaused, isAnswered]);
```

### Answer Validation
```typescript
const handleAnswer = (selectedIndex: number) => {
  const correct = selectedIndex === currentQuestion.correctAnswer;
  
  if (correct) {
    const timeBonus = Math.floor(timeLeft / 3);
    const points = 10 + timeBonus;
    setScore(prev => prev + points);
    setCorrectAnswers(prev => prev + 1);
    setStreak(prev => prev + 1);
  } else {
    setStreak(0);
  }
  
  setIsAnswered(true);
  setSelectedAnswer(selectedIndex);
};
```

---

## 📱 الأداء

### Optimization
- ✅ **Memoization** للأسئلة
- ✅ **useCallback** للـ handlers
- ✅ **useMemo** للحسابات
- ✅ **Native animations** للسرعة

### Memory Management
- 🗑️ تنظيف الـ timers
- 🗑️ تنظيف الـ animations
- 🗑️ تنظيف الـ sounds
- 🗑️ تنظيف الـ subscriptions

---

## 🌍 الترجمة

### اللغات المدعومة
- 🇸🇦 العربية - 100%
- 🇬🇧 الإنجليزية - 100%

### النصوص المترجمة
```typescript
t.quiz.congratulations
t.quiz.quizCompleted
t.quiz.points
t.quiz.accuracy
t.quiz.correct
t.quiz.bestStreak
t.quiz.goldCoins
t.quiz.playAgain
t.quiz.excellent
t.quiz.wrong
t.quiz.gamePaused
t.quiz.pressToResume
t.quiz.continue
```

---

## 📊 الإحصائيات النهائية

### الكود
- **~800 سطر** من الكود
- **20 سؤال** في كل جولة
- **15 ثانية** لكل سؤال
- **100% TypeScript**

### الميزات
- ✅ **نظام نقاط** متقدم
- ✅ **Streak system** محفز
- ✅ **Animations** سلسة
- ✅ **Sound effects** احترافية
- ✅ **Haptic feedback** تفاعلي
- ✅ **Progress saving** تلقائي

---

**تم التوثيق بواسطة:** MrDev
**التاريخ:** 20 نوفمبر 2024
**الإصدار:** 1.0.0
**الحالة:** ✅ مكتمل ومختبر
