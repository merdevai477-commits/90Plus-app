/**
 * Complete Legends Quiz Questions
 * أسئلة الأساطير الكاملة - السؤال والإجابة والصورة في مكان واحد
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
}

/**
 * أسئلة الأساطير الكاملة
 * كل سؤال يحتوي على السؤال والإجابة والصورة في كائن واحد
 */
export const LEGENDS_COMPLETE_QUESTIONS: CompleteQuizQuestion[] = [
  {
    id: "legends-001",
    question: "من فاز بكأس العالم 2022؟",
    options: ["الأرجنتين", "فرنسا", "البرازيل", "ألمانيا"],
    correctAnswer: "0", // الأرجنتين
    difficulty: "EASY",
    points: 10,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "كانت النهائية بين الأرجنتين وفرنسا",
    timeLimit: 20
  },
  {
    id: "legends-002",
    question: "كم عدد كؤوس العالم التي فاز بها البرازيل؟",
    options: ["4", "5", "3", "6"],
    correctAnswer: "1", // 5
    difficulty: "MEDIUM",
    points: 15,
    imageType: "flag",
    displayMode: "AFTER_ANSWER",
    hint: "البرازيل هي الأكثر فوزاً بكأس العالم",
    timeLimit: 20
  },
  {
    id: "legends-003",
    question: "من هو أفضل هداف في تاريخ كأس العالم؟",
    options: ["لاعب ألماني", "لاعب برازيلي", "أسطورة برازيلية", "لاعب ألماني آخر"],
    correctAnswer: "0", // لاعب ألماني
    difficulty: "HARD",
    points: 20,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "لاعب من ألمانيا سجل 16 هدف في كؤوس العالم",
    timeLimit: 25
  },
  {
    id: "legends-004",
    question: "في أي عام فاز المنتخب الأرجنتيني بآخر كأس عالم؟",
    options: ["2018", "2022", "2014", "2026"],
    correctAnswer: "1", // 2022
    difficulty: "EASY",
    points: 10,
    imageType: "flag",
    displayMode: "AFTER_ANSWER",
    hint: "كان في قطر",
    timeLimit: 15
  },
  {
    id: "legends-005",
    question: "من هو اللاعب الملقب بـ 'الملك'؟",
    options: ["أسطورة برازيلية", "أسطورة أرجنتينية", "لاعب برتغالي", "لاعب أرجنتيني"],
    correctAnswer: "0", // أسطورة برازيلية
    difficulty: "MEDIUM",
    points: 15,
    imageType: "flag",
    displayMode: "AFTER_ANSWER",
    hint: "لاعب برازيلي أسطوري من الستينات",
    timeLimit: 20
  },
  {
    id: "legends-007",
    question: "أي نادي إسباني فاز بأكثر ألقاب دوري الأبطال؟",
    options: ["نادي من مدريد", "نادي من برشلونة", "نادي من إشبيلية", "نادي من فالنسيا"],
    correctAnswer: "0", // نادي من مدريد
    difficulty: "EASY",
    points: 10,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "النادي الملكي الإسباني",
    timeLimit: 15
  },
  {
    id: "legends-008",
    question: "من أي دولة كان أفضل حارس مرمى في التاريخ؟",
    options: ["إيطاليا", "إسبانيا", "ألمانيا", "الاتحاد السوفيتي"],
    correctAnswer: "3", // الاتحاد السوفيتي
    difficulty: "HARD",
    points: 25,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "حارس مرمى أسطوري من أوروبا الشرقية",
    timeLimit: 25
  },
  {
    id: "legends-009",
    question: "كم هدف تقريباً سجل أفضل هداف برازيلي في التاريخ؟",
    options: ["1000+", "800+", "1200+", "900+"],
    correctAnswer: "0", // 1000+
    difficulty: "MEDIUM",
    points: 15,
    imageType: "flag",
    displayMode: "AFTER_ANSWER",
    hint: "رقم تاريخي يزيد عن الألف",
    timeLimit: 20
  },
  {
    id: "legends-010",
    question: "من فاز بالكرة الذهبية 2021؟",
    options: ["لاعب أرجنتيني", "لاعب بولندي", "لاعب فرنسي", "لاعب مصري"],
    correctAnswer: "0", // لاعب أرجنتيني
    difficulty: "EASY",
    points: 10,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "لاعب من أمريكا الجنوبية",
    timeLimit: 15
  },
  {
    id: "legends-011",
    question: "في أي عام فاز البرازيل بآخر كأس عالم؟",
    options: ["1998", "2002", "2006", "1994"],
    correctAnswer: "1", // 2002
    difficulty: "MEDIUM",
    points: 15,
    imageType: "flag",
    displayMode: "AFTER_ANSWER",
    hint: "في اليابان وكوريا الجنوبية",
    timeLimit: 20
  },
  {
    id: "legends-012",
    question: "في أي عقد فاز نادي إسباني بأكثر ألقاب دوري الأبطال؟",
    options: ["الثمانينات", "التسعينات", "الستينات", "الألفينات"],
    correctAnswer: "2", // الستينات
    difficulty: "HARD",
    points: 25,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "العصر الذهبي للنادي الملكي",
    timeLimit: 30
  },
  {
    id: "legends-013",
    question: "في أي كأس عالم حدث هدف 'يد الله' الشهير؟",
    options: ["1986", "1982", "1990", "1978"],
    correctAnswer: "0", // 1986
    difficulty: "EASY",
    points: 10,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "في المكسيك ضد إنجلترا",
    timeLimit: 15
  },
  {
    id: "legends-014",
    question: "أي نادي فاز بأكثر عدد من ألقاب دوري أبطال أوروبا؟",
    options: ["ريال مدريد", "برشلونة", "ميلان", "ليفربول"],
    correctAnswer: "0", // ريال مدريد
    difficulty: "EASY",
    points: 10,
    imageType: "club",
    displayMode: "AFTER_ANSWER",
    hint: "النادي الملكي الإسباني",
    timeLimit: 15
  },
  {
    id: "legends-015",
    question: "في أي عام سجل أصغر لاعب في تاريخ كأس العالم؟",
    options: ["1958", "1966", "1970", "1962"],
    correctAnswer: "0", // 1958
    difficulty: "MEDIUM",
    points: 15,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "كان عمره 17 سنة وكان من البرازيل",
    timeLimit: 20
  },
  {
    id: "legends-016",
    question: "من فاز بكأس أمم أوروبا 2021؟",
    options: ["إيطاليا", "إنجلترا", "إسبانيا", "فرنسا"],
    correctAnswer: "0", // إيطاليا
    difficulty: "EASY",
    points: 10,
    imageType: "flag",
    displayMode: "AFTER_ANSWER",
    hint: "فازت في النهائي بركلات الترجيح",
    timeLimit: 15
  },
  {
    id: "legends-017",
    question: "من أي دولة كان أكثر لاعب تسجيلاً للأهداف في التاريخ؟",
    options: ["البرتغال", "الأرجنتين", "البرازيل", "تشيكوسلوفاكيا"],
    correctAnswer: "3", // تشيكوسلوفاكيا
    difficulty: "HARD",
    points: 25,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "لاعب من أوروبا الشرقية سجل أكثر من 5000 هدف",
    timeLimit: 30
  },
  {
    id: "legends-018",
    question: "في أي عام أقيمت أول بطولة كأس عالم؟",
    options: ["1930", "1928", "1932", "1934"],
    correctAnswer: "0", // 1930
    difficulty: "MEDIUM",
    points: 15,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "في الأوروغواي",
    timeLimit: 20
  },
  {
    id: "legends-019",
    question: "كم عدد كؤوس العالم التي شارك فيها أكثر لاعب مشاركة؟",
    options: ["5", "4", "6", "3"],
    correctAnswer: "0", // 5
    difficulty: "HARD",
    points: 25,
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "لاعب ألماني حقق هذا الرقم",
    timeLimit: 30
  },
  {
    id: "legends-020",
    question: "من فاز بكوبا أمريكا 2021؟",
    options: ["الأرجنتين", "البرازيل", "تشيلي", "كولومبيا"],
    correctAnswer: "0", // الأرجنتين
    difficulty: "EASY",
    points: 10,
    imageType: "flag",
    displayMode: "AFTER_ANSWER",
    hint: "منتخب من أمريكا الجنوبية",
    timeLimit: 15
  },
  // يمكنك إضافة المزيد من الأسئلة هنا...
  {
    id: "legends-006",
    question: "من أي دولة كان أفضل لاعب في العالم 2023؟",
    options: ["الأرجنتين", "البرتغال", "فرنسا", "النرويج"],
    correctAnswer: "0", // الأرجنتين
    difficulty: "MEDIUM",
    points: 15,
    imageType: "flag",
    displayMode: "AFTER_ANSWER",
    hint: "فاز منتخبه بكأس العالم 2022",
    timeLimit: 20
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
export function getRandomCompleteQuestions(count: number = 20): CompleteQuizQuestion[] {
  const shuffled = [...LEGENDS_COMPLETE_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
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