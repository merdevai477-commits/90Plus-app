/**
 * Complete Legends Quiz Questions
 * أسئلة الأساطير الكاملة - نسخة عربية وإنجليزية لكل سؤال
 */

export interface CompleteQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string; // "0", "1", "2", or "3"
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  points: number;
  imageUrl?: string;
  imageType?: 'player' | 'club' | 'trophy' | 'stadium' | 'flag' | 'general';
  displayMode?: 'NEVER' | 'AFTER_ANSWER' | 'BEFORE_QUESTION' | 'IN_QUESTION' | 'AFTER_WRONG' | 'BLUR_REVEAL';
  hint?: string;
  timeLimit?: number;
  lang?: 'ar' | 'en';
}

export const LEGENDS_COMPLETE_QUESTIONS: CompleteQuizQuestion[] = [

  // ─── سؤال 1 ───────────────────────────────────────────────────────────────
  {
    id: "q1-ar",
    lang: "ar",
    question: "من فاز بكأس العالم 2022 في قطر؟",
    options: ["الأرجنتين", "فرنسا", "البرازيل", "ألمانيا"],
    correctAnswer: "0",
    difficulty: "EASY",
    points: 10,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "كانت النهائية بين الأرجنتين وفرنسا وانتهت بركلات الترجيح",
    timeLimit: 20,
  },
  {
    id: "q1-en",
    lang: "en",
    question: "Who won the 2022 FIFA World Cup in Qatar?",
    options: ["Argentina", "France", "Brazil", "Germany"],
    correctAnswer: "0",
    difficulty: "EASY",
    points: 10,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "The final was between Argentina and France, decided on penalties",
    timeLimit: 20,
  },

  // ─── سؤال 2 ───────────────────────────────────────────────────────────────
  {
    id: "q2-ar",
    lang: "ar",
    question: "كم مرة فاز ريال مدريد بدوري أبطال أوروبا حتى 2024؟",
    options: ["15", "13", "14", "12"],
    correctAnswer: "0",
    difficulty: "MEDIUM",
    points: 15,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "النادي الأكثر تتويجاً في تاريخ البطولة",
    timeLimit: 20,
  },
  {
    id: "q2-en",
    lang: "en",
    question: "How many times has Real Madrid won the UEFA Champions League up to 2024?",
    options: ["15", "13", "14", "12"],
    correctAnswer: "0",
    difficulty: "MEDIUM",
    points: 15,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "The most successful club in Champions League history",
    timeLimit: 20,
  },

  // ─── سؤال 3 ───────────────────────────────────────────────────────────────
  {
    id: "q3-ar",
    lang: "ar",
    question: "من هو أكثر لاعب تسجيلاً للأهداف في تاريخ كأس العالم؟",
    options: ["ميروسلاف كلوزه", "رونالدو البرازيلي", "غيرد مولر", "جاست فونتين"],
    correctAnswer: "0",
    difficulty: "HARD",
    points: 25,
    imageType: "player",
    displayMode: "AFTER_ANSWER",
    hint: "لاعب ألماني سجل 16 هدفاً في كؤوس العالم",
    timeLimit: 25,
  },
  {
    id: "q3-en",
    lang: "en",
    question: "Who is the all-time top scorer in FIFA World Cup history?",
    options: ["Miroslav Klose", "Ronaldo (Brazil)", "Gerd Müller", "Just Fontaine"],
    correctAnswer: "0",
    difficulty: "HARD",
    points: 25,
    imageType: "player",
    displayMode: "AFTER_ANSWER",
    hint: "A German player who scored 16 goals across World Cups",
    timeLimit: 25,
  },

  // ─── سؤال 4 ───────────────────────────────────────────────────────────────
  {
    id: "q4-ar",
    lang: "ar",
    question: "في أي عام فاز البرازيل بآخر كأس عالم له؟",
    options: ["2002", "1998", "2006", "1994"],
    correctAnswer: "0",
    difficulty: "MEDIUM",
    points: 15,
    imageType: "flag",
    displayMode: "AFTER_ANSWER",
    hint: "أُقيمت البطولة في اليابان وكوريا الجنوبية",
    timeLimit: 20,
  },
  {
    id: "q4-en",
    lang: "en",
    question: "In which year did Brazil win their last FIFA World Cup?",
    options: ["2002", "1998", "2006", "1994"],
    correctAnswer: "0",
    difficulty: "MEDIUM",
    points: 15,
    imageType: "flag",
    displayMode: "AFTER_ANSWER",
    hint: "The tournament was held in Japan and South Korea",
    timeLimit: 20,
  },

  // ─── سؤال 5 ───────────────────────────────────────────────────────────────
  {
    id: "q5-ar",
    lang: "ar",
    question: "من فاز بجائزة الكرة الذهبية أكثر مرة في التاريخ؟",
    options: ["ليونيل ميسي", "كريستيانو رونالدو", "رونالدينيو", "زيدان"],
    correctAnswer: "0",
    difficulty: "EASY",
    points: 10,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "لاعب أرجنتيني فاز بها 8 مرات",
    timeLimit: 15,
  },
  {
    id: "q5-en",
    lang: "en",
    question: "Who has won the Ballon d'Or the most times in history?",
    options: ["Lionel Messi", "Cristiano Ronaldo", "Ronaldinho", "Zidane"],
    correctAnswer: "0",
    difficulty: "EASY",
    points: 10,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "An Argentine player who won it 8 times",
    timeLimit: 15,
  },
];

/**
 * دالة للحصول على سؤال حسب المعرف
 */
export function getCompleteQuestionById(id: string): CompleteQuizQuestion | undefined {
  return LEGENDS_COMPLETE_QUESTIONS.find(q => q.id === id);
}

/**
 * دالة للحصول على عدد معين من الأسئلة العشوائية
 */
export function getRandomCompleteQuestions(count: number = 10): CompleteQuizQuestion[] {
  const shuffled = [...LEGENDS_COMPLETE_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * دالة للحصول على الأسئلة حسب اللغة
 */
export function getQuestionsByLang(lang: 'ar' | 'en'): CompleteQuizQuestion[] {
  return LEGENDS_COMPLETE_QUESTIONS.filter(q => q.lang === lang);
}

/**
 * دالة للحصول على الإجابات فقط
 */
export function getCompleteAnswers(): Record<string, string> {
  const answers: Record<string, string> = {};
  LEGENDS_COMPLETE_QUESTIONS.forEach(q => {
    answers[q.id] = q.correctAnswer;
  });
  return answers;
}
