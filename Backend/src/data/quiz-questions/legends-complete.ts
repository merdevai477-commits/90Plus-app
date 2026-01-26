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
    imageUrl: "https://media.api-sports.io/football/leagues/1.png",
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
    imageUrl: "https://media.api-sports.io/football/teams/6.png",
    imageType: "flag",
    displayMode: "AFTER_ANSWER",
    hint: "البرازيل هي الأكثر فوزاً بكأس العالم",
    timeLimit: 20
  },
  {
    id: "legends-003",
    question: "من هو أفضل هداف في تاريخ كأس العالم؟",
    options: ["ميروسلاف كلوزه", "رونالدو", "بيليه", "جيرد مولر"],
    correctAnswer: "0", // ميروسلاف كلوزه
    difficulty: "HARD",
    points: 20,
    imageUrl: "https://media.api-sports.io/football/players/1100.png",
    imageType: "player",
    displayMode: "AFTER_ANSWER",
    hint: "لاعب ألماني سجل 16 هدف في كؤوس العالم",
    timeLimit: 25
  },
  {
    id: "legends-004",
    question: "في أي عام فاز ليونيل ميسي بأول كأس عالم؟",
    options: ["2018", "2022", "2014", "2026"],
    correctAnswer: "1", // 2022
    difficulty: "EASY",
    points: 10,
    imageUrl: "https://media.api-sports.io/football/players/154.png",
    imageType: "player",
    displayMode: "AFTER_ANSWER",
    hint: "كان في قطر",
    timeLimit: 15
  },
  {
    id: "legends-005",
    question: "من هو اللاعب الملقب بـ 'الملك'؟",
    options: ["بيليه", "مارادونا", "كريستيانو رونالدو", "ليونيل ميسي"],
    correctAnswer: "0", // بيليه
    difficulty: "MEDIUM",
    points: 15,
    imageUrl: "https://media.api-sports.io/football/players/276.png",
    imageType: "player",
    displayMode: "AFTER_ANSWER",
    hint: "لاعب برازيلي أسطوري",
    timeLimit: 20
  },
  {
    id: "legends-007",
    question: "في أي نادي لعب زين الدين زيدان؟",
    options: ["ريال مدريد", "برشلونة", "يوفنتوس", "مارسيليا"],
    correctAnswer: "0", // ريال مدريد
    difficulty: "EASY",
    points: 10,
    imageUrl: "https://media.api-sports.io/football/players/1100.png",
    imageType: "player",
    displayMode: "AFTER_ANSWER",
    hint: "النادي الملكي الإسباني",
    timeLimit: 15
  },
  {
    id: "legends-008",
    question: "من هو أفضل حارس مرمى في التاريخ؟",
    options: ["جيانلويجي بوفون", "إيكر كاسياس", "مانويل نوير", "لف ياشين"],
    correctAnswer: "3", // لف ياشين
    difficulty: "HARD",
    points: 25,
    imageUrl: "https://media.api-sports.io/football/players/276.png",
    imageType: "player",
    displayMode: "AFTER_ANSWER",
    hint: "حارس مرمى سوفيتي أسطوري",
    timeLimit: 25
  },
  {
    id: "legends-009",
    question: "كم هدف سجل بيليه في مسيرته؟",
    options: ["1000+", "800+", "1200+", "900+"],
    correctAnswer: "0", // 1000+
    difficulty: "MEDIUM",
    points: 15,
    imageUrl: "https://media.api-sports.io/football/players/276.png",
    imageType: "player",
    displayMode: "AFTER_ANSWER",
    hint: "رقم تاريخي يزيد عن الألف",
    timeLimit: 20
  },
  {
    id: "legends-010",
    question: "من فاز بالكرة الذهبية 2021؟",
    options: ["ليونيل ميسي", "روبرت ليفاندوفسكي", "كريم بنزيما", "محمد صلاح"],
    correctAnswer: "0", // ليونيل ميسي
    difficulty: "EASY",
    points: 10,
    imageUrl: "https://media.api-sports.io/football/players/154.png",
    imageType: "player",
    displayMode: "AFTER_ANSWER",
    hint: "لاعب برشلونة السابق",
    timeLimit: 15
  },
  {
    id: "legends-011",
    question: "في أي عام فاز البرازيل بآخر كأس عالم؟",
    options: ["1998", "2002", "2006", "1994"],
    correctAnswer: "1", // 2002
    difficulty: "MEDIUM",
    points: 15,
    imageUrl: "https://media.api-sports.io/football/teams/6.png",
    imageType: "flag",
    displayMode: "AFTER_ANSWER",
    hint: "في اليابان وكوريا الجنوبية",
    timeLimit: 20
  },
  {
    id: "legends-012",
    question: "من هو أكثر لاعب فوزاً بدوري أبطال أوروبا؟",
    options: ["كريستيانو رونالدو", "ليونيل ميسي", "فرانسيسكو جينتو", "باولو مالديني"],
    correctAnswer: "2", // فرانسيسكو جينتو
    difficulty: "HARD",
    points: 25,
    imageUrl: "https://media.api-sports.io/football/leagues/2.png",
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "لاعب ريال مدريد في الستينات",
    timeLimit: 30
  },
  {
    id: "legends-013",
    question: "من سجل هدف 'يد الله' الشهير؟",
    options: ["دييغو مارادونا", "بيليه", "يوهان كرويف", "ميشيل بلاتيني"],
    correctAnswer: "0", // دييغو مارادونا
    difficulty: "EASY",
    points: 10,
    imageUrl: "https://media.api-sports.io/football/players/276.png",
    imageType: "player",
    displayMode: "AFTER_ANSWER",
    hint: "في كأس العالم 1986 ضد إنجلترا",
    timeLimit: 15
  },
  {
    id: "legends-014",
    question: "أي نادي فاز بأكثر عدد من ألقاب دوري أبطال أوروبا؟",
    options: ["ريال مدريد", "برشلونة", "ميلان", "ليفربول"],
    correctAnswer: "0", // ريال مدريد
    difficulty: "EASY",
    points: 10,
    imageUrl: "https://media.api-sports.io/football/teams/541.png",
    imageType: "club",
    displayMode: "AFTER_ANSWER",
    hint: "النادي الملكي الإسباني",
    timeLimit: 15
  },
  {
    id: "legends-015",
    question: "من هو أصغر لاعب سجل في كأس العالم؟",
    options: ["بيليه", "مايكل أوين", "كيليان مبابي", "ليونيل ميسي"],
    correctAnswer: "0", // بيليه
    difficulty: "MEDIUM",
    points: 15,
    imageUrl: "https://media.api-sports.io/football/players/276.png",
    imageType: "player",
    displayMode: "AFTER_ANSWER",
    hint: "كان عمره 17 سنة في كأس العالم 1958",
    timeLimit: 20
  },
  {
    id: "legends-016",
    question: "من فاز بكأس أمم أوروبا 2021؟",
    options: ["إيطاليا", "إنجلترا", "إسبانيا", "فرنسا"],
    correctAnswer: "0", // إيطاليا
    difficulty: "EASY",
    points: 10,
    imageUrl: "https://media.api-sports.io/football/teams/768.png",
    imageType: "flag",
    displayMode: "AFTER_ANSWER",
    hint: "فازت في النهائي بركلات الترجيح",
    timeLimit: 15
  },
  {
    id: "legends-017",
    question: "من هو أكثر لاعب تسجيلاً للأهداف في تاريخ كرة القدم؟",
    options: ["كريستيانو رونالدو", "ليونيل ميسي", "بيليه", "جوزيف بيكان"],
    correctAnswer: "3", // جوزيف بيكان
    difficulty: "HARD",
    points: 25,
    imageUrl: "https://media.api-sports.io/football/players/276.png",
    imageType: "player",
    displayMode: "AFTER_ANSWER",
    hint: "لاعب تشيكوسلوفاكي سجل أكثر من 5000 هدف",
    timeLimit: 30
  },
  {
    id: "legends-018",
    question: "في أي عام أقيمت أول بطولة كأس عالم؟",
    options: ["1930", "1928", "1932", "1934"],
    correctAnswer: "0", // 1930
    difficulty: "MEDIUM",
    points: 15,
    imageUrl: "https://media.api-sports.io/football/leagues/1.png",
    imageType: "trophy",
    displayMode: "AFTER_ANSWER",
    hint: "في الأوروغواي",
    timeLimit: 20
  },
  {
    id: "legends-019",
    question: "من هو أكثر لاعب مشاركة في كؤوس العالم؟",
    options: ["لوثار ماتيوس", "ميروسلاف كلوزه", "كافو", "جيانلويجي بوفون"],
    correctAnswer: "0", // لوثار ماتيوس
    difficulty: "HARD",
    points: 25,
    imageUrl: "https://media.api-sports.io/football/players/276.png",
    imageType: "player",
    displayMode: "AFTER_ANSWER",
    hint: "لاعب ألماني شارك في 5 كؤوس عالم",
    timeLimit: 30
  },
  {
    id: "legends-020",
    question: "من فاز بكوبا أمريكا 2021؟",
    options: ["الأرجنتين", "البرازيل", "تشيلي", "كولومبيا"],
    correctAnswer: "0", // الأرجنتين
    difficulty: "EASY",
    points: 10,
    imageUrl: "https://media.api-sports.io/football/teams/26.png",
    imageType: "flag",
    displayMode: "AFTER_ANSWER",
    hint: "أول لقب لميسي مع المنتخب",
    timeLimit: 15
  },
  // يمكنك إضافة المزيد من الأسئلة هنا...
  {
    id: "legends-006",
    question: "من هو أفضل لاعب في العالم 2023؟",
    options: ["ليونيل ميسي", "كريستيانو رونالدو", "كيليان مبابي", "إرلينغ هالاند"],
    correctAnswer: "0", // ليونيل ميسي
    difficulty: "MEDIUM",
    points: 15,
    imageUrl: "https://media.api-sports.io/football/players/154.png",
    imageType: "player",
    displayMode: "AFTER_ANSWER",
    hint: "فاز بكأس العالم 2022",
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