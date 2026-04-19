export interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  image?: string;
  imageType?: 'player' | 'club' | 'stadium' | 'trophy' | 'manager' | 'flag';
  hint?: string;
  timeLimit?: number; // بالثواني
}

export const QUIZ_QUESTIONS: Question[] = [
  // أسئلة سهلة (50 نقطة)
  {
    id: 1,
    question: "كم عدد اللاعبين في فريق كرة القدم على أرض الملعب؟",
    options: ["9", "10", "11", "12"],
    correctAnswer: 2,
    category: "قوانين كرة القدم",
    difficulty: "easy",
    points: 50,
    timeLimit: 15
  },
  {
    id: 2,
    question: "ما هو اسم ملعب برشلونة؟",
    options: ["سانتياغو برنابيو", "كامب نو", "سان سيرو", "الاتحاد"],
    correctAnswer: 1,
    category: "الملاعب",
    difficulty: "easy",
    points: 50,
    image: "https://media.api-sports.io/football/venues/18.png",
    imageType: "stadium",
    timeLimit: 15
  },
  {
    id: 3,
    question: "أي نادي إنجليزي يُلقب بـ 'الشياطين الحمر'؟",
    options: ["ليفربول", "أرسنال", "مانشستر يونايتد", "تشيلسي"],
    correctAnswer: 2,
    category: "الأندية",
    difficulty: "easy",
    points: 50,
    image: "https://media.api-sports.io/football/teams/33.png",
    imageType: "club",
    timeLimit: 15
  },
  {
    id: 4,
    question: "كم دقيقة مدة مباراة كرة القدم الرسمية؟",
    options: ["80 دقيقة", "90 دقيقة", "100 دقيقة", "120 دقيقة"],
    correctAnswer: 1,
    category: "قوانين كرة القدم",
    difficulty: "easy",
    points: 50,
    timeLimit: 15
  },
  {
    id: 5,
    question: "من هو هذا اللاعب؟",
    options: ["ليونيل ميسي", "كريستيانو رونالدو", "نيمار", "كيليان مبابي"],
    correctAnswer: 0,
    category: "تعرف على اللاعب",
    difficulty: "easy",
    points: 50,
    image: "https://media.api-sports.io/football/players/154.png",
    imageType: "player",
    timeLimit: 10
  },

  // أسئلة متوسطة (100 نقطة)
  {
    id: 6,
    question: "من هو اللاعب الذي سجل أكثر الأهداف في تاريخ كأس العالم؟",
    options: ["بيليه", "ميروسلاف كلوزه", "رونالدو البرازيلي", "جيرد مولر"],
    correctAnswer: 1,
    category: "كأس العالم",
    difficulty: "medium",
    points: 100,
    hint: "لاعب ألماني",
    timeLimit: 20
  },
  {
    id: 7,
    question: "في أي عام فازت فرنسا بكأس العالم لأول مرة؟",
    options: ["1994", "1998", "2002", "2006"],
    correctAnswer: 1,
    category: "كأس العالم",
    difficulty: "medium",
    points: 100,
    timeLimit: 20
  },
  {
    id: 8,
    question: "من سجل هدف 'يد الله' الشهير؟",
    options: ["بيليه", "دييغو مارادونا", "زين الدين زيدان", "رونالدينهو"],
    correctAnswer: 1,
    category: "لحظات تاريخية",
    difficulty: "medium",
    points: 100,
    timeLimit: 20
  },
  {
    id: 9,
    question: "كم مرة فازت البرازيل بكأس العالم؟",
    options: ["3 مرات", "4 مرات", "5 مرات", "6 مرات"],
    correctAnswer: 2,
    category: "كأس العالم",
    difficulty: "medium",
    points: 100,
    image: "https://media.api-sports.io/football/teams/6.png",
    imageType: "flag",
    timeLimit: 20
  },
  {
    id: 10,
    question: "من هو الهداف التاريخي لدوري أبطال أوروبا؟",
    options: ["ليونيل ميسي", "كريستيانو رونالدو", "روبرت ليفاندوفسكي", "راؤول"],
    correctAnswer: 1,
    category: "دوري أبطال أوروبا",
    difficulty: "medium",
    points: 100,
    timeLimit: 20
  },
  {
    id: 11,
    question: "أي لاعب يُلقب بـ 'الظاهرة'؟",
    options: ["رونالدو البرازيلي", "كريستيانو رونالدو", "رونالدينهو", "ريفالدو"],
    correctAnswer: 0,
    category: "ألقاب اللاعبين",
    difficulty: "medium",
    points: 100,
    image: "https://media.api-sports.io/football/players/1100.png",
    imageType: "player",
    timeLimit: 20
  },
  {
    id: 12,
    question: "من هو مدرب منتخب الأرجنتين الفائز بكأس العالم 2022؟",
    options: ["دييغو سيميوني", "ليونيل سكالوني", "خورخي سامباولي", "أليخاندرو ساباييا"],
    correctAnswer: 1,
    category: "المدربون",
    difficulty: "medium",
    points: 100,
    timeLimit: 20
  },
  {
    id: 13,
    question: "ما هو عدد بطولات كأس العالم التي أقيمت حتى 2022؟",
    options: ["20", "21", "22", "23"],
    correctAnswer: 2,
    category: "كأس العالم",
    difficulty: "medium",
    points: 100,
    timeLimit: 20
  },
  {
    id: 14,
    question: "من هو هذا النادي؟",
    options: ["ريال مدريد", "برشلونة", "بايرن ميونخ", "مانشستر سيتي"],
    correctAnswer: 0,
    category: "تعرف على النادي",
    difficulty: "medium",
    points: 100,
    image: "https://media.api-sports.io/football/teams/541.png",
    imageType: "club",
    timeLimit: 15
  },
  {
    id: 15,
    question: "في أي نادي بدأ محمد صلاح مسيرته الأوروبية؟",
    options: ["بازل", "تشيلسي", "روما", "فيورنتينا"],
    correctAnswer: 0,
    category: "اللاعبون العرب",
    difficulty: "medium",
    points: 100,
    timeLimit: 20
  },

  // أسئلة صعبة (150 نقطة)
  {
    id: 16,
    question: "من هو أصغر لاعب سجل في نهائي كأس العالم؟",
    options: ["بيليه", "كيليان مبابي", "مايكل أوين", "ليونيل ميسي"],
    correctAnswer: 0,
    category: "أرقام قياسية",
    difficulty: "hard",
    points: 150,
    hint: "كان عمره 17 عاماً",
    timeLimit: 25
  },
  {
    id: 17,
    question: "ما هو لقب نادي يوفنتوس الإيطالي؟",
    options: ["الروسونيري", "السيدة العجوز", "النيراتزوري", "البيانكونيري"],
    correctAnswer: 1,
    category: "ألقاب الأندية",
    difficulty: "hard",
    points: 150,
    timeLimit: 25
  },
  {
    id: 18,
    question: "في أي عام تأسس الاتحاد الدولي لكرة القدم (فيفا)؟",
    options: ["1894", "1904", "1914", "1924"],
    correctAnswer: 1,
    category: "تاريخ كرة القدم",
    difficulty: "hard",
    points: 150,
    timeLimit: 25
  },
  {
    id: 19,
    question: "من هو حارس المرمى الوحيد الذي فاز بالكرة الذهبية؟",
    options: ["جيانلويجي بوفون", "ليف ياشين", "مانويل نوير", "إيكر كاسياس"],
    correctAnswer: 1,
    category: "الكرة الذهبية",
    difficulty: "hard",
    points: 150,
    timeLimit: 25
  },
  {
    id: 20,
    question: "كم هدفاً سجل جاست فونتين في كأس العالم 1958؟",
    options: ["10 أهداف", "11 هدفاً", "12 هدفاً", "13 هدفاً"],
    correctAnswer: 3,
    category: "أرقام قياسية",
    difficulty: "hard",
    points: 150,
    hint: "رقم قياسي في بطولة واحدة",
    timeLimit: 25
  },
  {
    id: 21,
    question: "من هو اللاعب الذي سجل أسرع هاتريك في الدوري الإنجليزي؟",
    options: ["روبي فاولر", "ساديو ماني", "سيرجيو أغويرو", "آلان شيرر"],
    correctAnswer: 1,
    category: "الدوري الإنجليزي",
    difficulty: "hard",
    points: 150,
    hint: "سجله في 2 دقيقة و56 ثانية",
    timeLimit: 25
  },
  {
    id: 22,
    question: "ما هو النادي الذي لم يهبط أبداً من الدوري الإسباني؟",
    options: ["ريال مدريد وبرشلونة وأتلتيك بيلباو", "ريال مدريد وبرشلونة فقط", "ريال مدريد وأتلتيكو مدريد وبرشلونة", "جميع الأندية هبطت مرة واحدة على الأقل"],
    correctAnswer: 0,
    category: "الدوري الإسباني",
    difficulty: "hard",
    points: 150,
    timeLimit: 30
  },
  {
    id: 23,
    question: "من سجل هدف الفوز في نهائي كأس العالم 2010؟",
    options: ["دافيد فيا", "أندريس إنييستا", "فرناندو توريس", "شافي هيرنانديز"],
    correctAnswer: 1,
    category: "كأس العالم",
    difficulty: "hard",
    points: 150,
    timeLimit: 25
  },
  {
    id: 24,
    question: "كم عدد الأهداف التي سجلها بيليه في مسيرته الاحترافية؟",
    options: ["1000 هدف", "1150 هدفاً", "1281 هدفاً", "1363 هدفاً"],
    correctAnswer: 2,
    category: "أرقام قياسية",
    difficulty: "hard",
    points: 150,
    hint: "أكثر من 1200 هدف",
    timeLimit: 25
  },
  {
    id: 25,
    question: "من هو أول لاعب أفريقي يفوز بالكرة الذهبية؟",
    options: ["صامويل إيتو", "جورج ويا", "ديدييه دروغبا", "ال صلاح"],
    correctAnswer: 1,
    category: "الكرة الذهبية",
    difficulty: "hard",
    points: 150,
    timeLimit: 25
  },
  {
    id: 26,
    question: "ما هو النادي الذي فاز بأول دوري أبطال أوروبا عام 1956؟",
    options: ["ميلان", "ريال مدريد", "بنفيكا", "برشلونة"],
    correctAnswer: 1,
    category: "دوري أبطال أوروبا",
    difficulty: "hard",
    points: 150,
    timeLimit: 25
  },
  {
    id: 27,
    question: "من هو اللاعب الذي يحمل الرقم القياسي لأكثر عدد مباريات في كأس العالم؟",
    options: ["باولو مالديني", "لوثار ماتيوس", "كافو", "ميروسلاف كلوزه"],
    correctAnswer: 1,
    category: "أرقام قياسية",
    difficulty: "hard",
    points: 150,
        hint: "لعب 25 مباراة في 5 بطولات",
    timeLimit: 25
  },
  {
    id: 28,
    question: "ما هي أكبر نتيجة في تاريخ كأس العالم؟",
    options: ["البرازيل 7-1 ألمانيا", "المجر 10-1 السلفادور", "يوغوسلافيا 9-0 زائير", "ألمانيا 8-0 السعودية"],
    correctAnswer: 1,
    category: "كأس العالم",
    difficulty: "hard",
    points: 150,
    timeLimit: 25
  },
  {
    id: 29,
    question: "من هو اللاعب العربي الوحيد الذي فاز بدوري أبطال أوروبا؟",
    options: ["محمد صلاح", "رياض محرز", "رابح ماجر", "أشرف حكيمي"],
    correctAnswer: 2,
    category: "اللاعبون العرب",
    difficulty: "hard",
    points: 150,
    hint: "فاز مع بورتو عام 1987",
    timeLimit: 25
  },
  {
    id: 30,
    question: "كم عدد الأندية التي دربها كارلو أنشيلوتي وفاز معها بدوري أبطال أوروبا؟",
    options: ["نادي واحد", "ناديان", "3 أندية", "4 أندية"],
    correctAnswer: 1,
    category: "المدربون",
    difficulty: "hard",
    points: 150,
    hint: "ميلان وريال مدريد",
    timeLimit: 25
  },

  // أسئلة متنوعة إضافية
  {
    id: 31,
    question: "من هو هذا الملعب الشهير؟",
    options: ["ويمبلي", "سانتياغو برنابيو", "أليانز أرينا", "سان سيرو"],
    correctAnswer: 0,
    category: "تعرف على الملعب",
    difficulty: "medium",
    points: 100,
    image: "https://media.api-sports.io/football/venues/504.png",
    imageType: "stadium",
    timeLimit: 15
  },
  {
    id: 32,
    question: "من هو أول لاعب يسجل 100 هدف دولي؟",
    options: ["بيليه", "علي دائي", "كريستيانو رونالدو", "ليونيل ميسي"],
    correctAnswer: 1,
    category: "أرقام قياسية",
    difficulty: "hard",
    points: 150,
    hint: "لاعب إيراني",
    timeLimit: 25
  },
  {
    id: 33,
    question: "ما هو النادي الذي يُلقب بـ 'البلوز'؟",
    options: ["مانشستر سيتي", "إيفرتون", "تشيلسي", "كل ما سبق"],
    correctAnswer: 2,
    category: "ألقاب الأندية",
    difficulty: "medium",
    points: 100,
    timeLimit: 20
  },
  {
    id: 34,
    question: "من فاز بجائزة أفضل لاعب شاب في كأس العالم 2018؟",
    options: ["كيليان مبابي", "ترينت ألكسندر أرنولد", "بنجامين بافارد", "لوكا مودريتش"],
    correctAnswer: 0,
    category: "كأس العالم",
    difficulty: "medium",
    points: 100,
    image: "https://media.api-sports.io/football/players/278.png",
    imageType: "player",
    timeLimit: 20
  },
  {
    id: 35,
    question: "كم عدد البطاقات الصفراء التي تؤدي للإيقاف في معظم البطولات؟",
    options: ["3 بطاقات", "4 بطاقات", "5 بطاقات", "6 بطاقات"],
    correctAnswer: 2,
    category: "قوانين كرة القدم",
    difficulty: "medium",
    points: 100,
    timeLimit: 20
  },
  {
    id: 36,
    question: "من هو المدرب الذي فاز بدوري أبطال أوروبا 3 مرات متتالية؟",
    options: ["بيب غوارديولا", "زين الدين زيدان", "كارلو أنشيلوتي", "أليكس فيرغسون"],
    correctAnswer: 1,
    category: "المدربون",
    difficulty: "hard",
    points: 150,
    hint: "مع ريال مدريد 2016-2018",
    timeLimit: 25
  },
  {
    id: 37,
    question: "ما هي الدولة التي فازت بأول كأس عالم للسيدات؟",
    options: ["البرازيل", "الولايات المتحدة", "ألمانيا", "النرويج"],
    correctAnswer: 1,
    category: "كرة القدم النسائية",
    difficulty: "hard",
    points: 150,
    timeLimit: 25
  },
  {
    id: 38,
    question: "من هو اللاعب الذي سجل في 5 بطولات كأس عالم مختلفة؟",
    options: ["بيليه", "دييغو مارادونا", "كريستيانو رونالدو", "ليونيل ميسي"],
    correctAnswer: 2,
    category: "أرقام قياسية",
    difficulty: "hard",
    points: 150,
    hint: "من 2006 إلى 2022",
    timeLimit: 25
  },
  {
    id: 39,
    question: "ما هو النادي الذي فاز بالثلاثية التاريخية مرتين؟",
    options: ["بايرن ميونخ", "برشلونة", "مانشستر يونايتد", "إنتر ميلان"],
    correctAnswer: 1,
    category: "إنجازات الأندية",
    difficulty: "hard",
    points: 150,
    hint: "2009 و 2015",
    timeLimit: 25
  },
  {
    id: 40,
    question: "من هو أغلى حارس مرمى في التاريخ؟",
    options: ["أليسون بيكر", "كيبا أريزابالاغا", "إدوارد ميندي", "جيانلويجي دوناروما"],
    correctAnswer: 1,
    category: "انتقالات",
    difficulty: "hard",
    points: 150,
    hint: "انتقل إلى تشيلسي بـ 80 مليون يورو",
    timeLimit: 25
  },
  {
    id: 41,
    question: "من هو هذا المدرب الأسطوري؟",
    options: ["أليكس فيرغسون", "أرسين فينغر", "جوزيه مورينيو", "بيب غوارديولا"],
    correctAnswer: 0,
    category: "تعرف على المدرب",
    difficulty: "medium",
    points: 100,
    image: "https://media.api-sports.io/football/coachs/2.png",
    imageType: "manager",
    timeLimit: 15
  },
  {
    id: 42,
    question: "ما هي أطول مباراة في تاريخ كرة القدم؟",
    options: ["150 دقيقة", "173 دقيقة", "195 دقيقة", "210 دقائق"],
    correctAnswer: 1,
    category: "حقائق غريبة",
    difficulty: "hard",
    points: 150,
    hint: "كانت في عام 1946",
    timeLimit: 30
  },
  {
    id: 43,
    question: "من هو اللاعب الذي فاز بدوري أبطال أوروبا مع 3 أندية مختلفة؟",
    options: ["كلارنس سيدورف", "كريستيانو رونالدو", "صامويل إيتو", "أ و ج صحيحان"],
    correctAnswer: 3,
    category: "دوري أبطال أوروبا",
    difficulty: "hard",
    points: 150,
    timeLimit: 25
  },
  {
    id: 44,
    question: "كم مرة استضافت إيطاليا كأس العالم؟",
    options: ["مرة واحدة", "مرتان", "3 مرات", "4 مرات"],
    correctAnswer: 1,
    category: "كأس العالم",
    difficulty: "medium",
    points: 100,
    hint: "1934 و 1990",
    timeLimit: 20
  },
  {
    id: 45,
    question: "من هو أصغر مدرب فاز بدوري أبطال أوروبا؟",
    options: ["بيب غوارديولا", "جوليان ناجلزمان", "أندريه فيلاش بواش", "جوزيه مورينيو"],
    correctAnswer: 2,
    category: "المدربون",
    difficulty: "hard",
    points: 150,
    hint: "كان عمره 33 عاماً",
    timeLimit: 25
  },
  {
    id: 46,
    question: "ما هو النادي الذي سجل أكبر عدد من الأهداف في موسم واحد بالدوري الإنجليزي؟",
    options: ["مانشستر سيتي", "ليفربول", "تشيلسي", "مانشستر يونايتد"],
    correctAnswer: 0,
    category: "الدوري الإنجليزي",
    difficulty: "hard",
    points: 150,
    hint: "106 أهداف في موسم 2017-18",
    timeLimit: 25
  },
  {
    id: 47,
    question: "من هو اللاعب الذي يحمل الرقم القياسي لأسرع هدف في تاريخ الدوري الإنجليزي؟",
    options: ["ليدلي كينغ", "آلان شيرر", "شين لونغ", "ثيو والكوت"],
    correctAnswer: 2,
    category: "أرقام قياسية",
    difficulty: "hard",
    points: 150,
    hint: "7.69 ثانية",
    timeLimit: 25
  },
  {
    id: 48,
    question: "كم عدد الكرات الذهبية التي فاز بها ميشيل بلاتيني؟",
    options: ["2", "3", "4", "5"],
    correctAnswer: 1,
    category: "الكرة الذهبية",
    difficulty: "medium",
    points: 100,
    hint: "فاز بها 3 مرات متتالية",
    timeLimit: 20
  },
  {
    id: 49,
    question: "ما هي أول دولة عربية تأهلت لكأس العالم؟",
    options: ["المغرب", "مصر", "تونس", "الجزائر"],
    correctAnswer: 1,
    category: "الكرة العربية",
    difficulty: "medium",
    points: 100,
    hint: "في عام 1934",
    timeLimit: 20
  },
  {
    id: 50,
    question: "من هو اللاعب الذي سجل أكثر عدد من الأهداف في مباراة واحدة بكأس العالم؟",
    options: ["جاست فونتين", "أوليغ سالينكو", "ساندور كوتشيش", "إيمريه شلوسر"],
    correctAnswer: 1,
    category: "كأس العالم",
    difficulty: "hard",
    points: 150,
    hint: "سجل 5 أهداف ضد الكاميرون 1994",
    timeLimit: 30
  }
];

// دالة مساعدة لخلط الأسئلة
export function shuffleQuestions(questions: Question[]): Question[] {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// دالة للحصول على أسئلة حسب الصعوبة
export function getQuestionsByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): Question[] {
  return QUIZ_QUESTIONS.filter(q => q.difficulty === difficulty);
}

// دالة للحصول على أسئلة حسب الفئة
export function getQuestionsByCategory(category: string): Question[] {
  return QUIZ_QUESTIONS.filter(q => q.category === category);
}

// الفئات المتاحة
export const CATEGORIES = [
  "كأس العالم",
  "دوري أبطال أوروبا",
  "الدوري الإنجليزي",
  "الدوري الإسباني",
  "قوانين كرة القدم",
  "أرقام قياسية",
  "الكرة الذهبية",
  "المدربون",
  "الأندية",
  "الملاعب",
  "اللاعبون العرب",
  "الكرة العربية",
  "كرة القدم النسائية",
  "ألقاب الأندية",
  "ألقاب اللاعبين",
  "لحظات تاريخية",
  "انتقالات",
  "إنجازات الأندية",
  "حقائق غريبة",
    "تعرف على اللاعب",
  "تعرف على النادي",
  "تعرف على الملعب",
  "تعرف على المدرب"
];

// دالة لإنشاء مسابقة مخصصة
export function createCustomQuiz(options: {
  numberOfQuestions: number;
  difficulties?: ('easy' | 'medium' | 'hard')[];
  categories?: string[];
  includeImages?: boolean;
}): Question[] {
  let filteredQuestions = [...QUIZ_QUESTIONS];
  
  // تصفية حسب الصعوبة
  if (options.difficulties && options.difficulties.length > 0) {
    filteredQuestions = filteredQuestions.filter(q => 
      options.difficulties!.includes(q.difficulty)
    );
  }
  
  // تصفية حسب الفئات
  if (options.categories && options.categories.length > 0) {
    filteredQuestions = filteredQuestions.filter(q => 
      options.categories!.includes(q.category)
    );
  }
  
  // تصفية حسب وجود الصور
  if (options.includeImages === false) {
    filteredQuestions = filteredQuestions.filter(q => !q.image);
  } else if (options.includeImages === true) {
    filteredQuestions = filteredQuestions.filter(q => q.image);
  }
  
  // خلط الأسئلة واختيار العدد المطلوب
  const shuffled = shuffleQuestions(filteredQuestions);
  return shuffled.slice(0, Math.min(options.numberOfQuestions, shuffled.length));
}

// دالة للحصول على تلميح للسؤال
export function getQuestionHint(questionId: number): string | undefined {
  const question = QUIZ_QUESTIONS.find(q => q.id === questionId);
  return question?.hint;
}

// دالة لحساب النقاط مع مضاعف الوقت
export function calculatePoints(
  basePoints: number, 
  timeRemaining: number, 
  totalTime: number
): number {
  const timeBonus = Math.floor((timeRemaining / totalTime) * basePoints * 0.5);
  return basePoints + timeBonus;
}

// أنواع المسابقات المختلفة
export const QUIZ_MODES = {
  CLASSIC: {
    name: "الوضع الكلاسيكي",
    description: "20 سؤال من جميع الفئات",
    questions: 20,
    timePerQuestion: null
  },
  SPEED: {
    name: "التحدي السريع",
    description: "أجب على أكبر عدد من الأسئلة في 60 ثانية",
    questions: null,
    totalTime: 60
  },
  EXPERT: {
    name: "وضع الخبير",
    description: "15 سؤال صعب فقط",
    questions: 15,
    difficulty: ['hard']
  },
  CATEGORY: {
    name: "تحدي الفئة",
    description: "10 أسئلة من فئة واحدة",
    questions: 10,
    singleCategory: true
  },
  PICTURE: {
    name: "تحدي الصور",
    description: "تعرف على اللاعبين والأندية من الصور",
    questions: 15,
    imageOnly: true
  }
};

// إحصائيات للاعب
export interface PlayerStats {
  totalGames: number;
  totalScore: number;
  perfectGames: number;
  bestStreak: number;
  favoriteCategory: string;
  averageTimePerQuestion: number;
  totalQuestionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
}

// دالة لتحديث إحصائيات اللاعب
export function updatePlayerStats(
  currentStats: PlayerStats,
  gameResult: {
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    streak: number;
    categoryScores: Record<string, number>;
    averageTime: number;
  }
): PlayerStats {
  const newTotalGames = currentStats.totalGames + 1;
  const newTotalScore = currentStats.totalScore + gameResult.score;
  const newTotalQuestions = currentStats.totalQuestionsAnswered + gameResult.totalQuestions;
  const newCorrectAnswers = currentStats.correctAnswers + gameResult.correctAnswers;
  
  // حساب الفئة المفضلة
  const favoriteCategory = Object.entries(gameResult.categoryScores)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || currentStats.favoriteCategory;
  
  return {
    totalGames: newTotalGames,
    totalScore: newTotalScore,
    perfectGames: currentStats.perfectGames + (gameResult.correctAnswers === gameResult.totalQuestions ? 1 : 0),
    bestStreak: Math.max(currentStats.bestStreak, gameResult.streak),
    favoriteCategory,
    averageTimePerQuestion: (currentStats.averageTimePerQuestion * currentStats.totalQuestionsAnswered + 
      gameResult.averageTime * gameResult.totalQuestions) / newTotalQuestions,
    totalQuestionsAnswered: newTotalQuestions,
    correctAnswers: newCorrectAnswers,
    accuracy: (newCorrectAnswers / newTotalQuestions) * 100
  };
}

// دالة للحصول على رتبة اللاعب
export function getPlayerRank(totalScore: number): {
  rank: string;
  icon: string;
  nextRank: string;
  pointsToNext: number;
} {
  const ranks = [
    { score: 0, rank: "مبتدئ", icon: "⚽", next: 500 },
    { score: 500, rank: "هاوي", icon: "🥉", next: 1500 },
    { score: 1500, rank: "محترف", icon: "🥈", next: 3000 },
    { score: 3000, rank: "نجم", icon: "🥇", next: 5000 },
    { score: 5000, rank: "أسطورة", icon: "🏆", next: 10000 },
    { score: 10000, rank: "خبير كرة القدم", icon: "👑", next: null }
  ];
  
  const currentRankIndex = ranks.findIndex((r, i) => 
    totalScore >= r.score && (i === ranks.length - 1 || totalScore < ranks[i + 1].score)
  );
  
  const currentRank = ranks[currentRankIndex];
  const nextRank = ranks[currentRankIndex + 1];
  
  return {
    rank: currentRank.rank,
    icon: currentRank.icon,
    nextRank: nextRank?.rank || "الحد الأقصى",
    pointsToNext: nextRank ? nextRank.score - totalScore : 0
  };
}

// دالة للحصول على إنجازات اللاعب
export function getPlayerAchievements(stats: PlayerStats): Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
}> {
  return [
    {
      id: "first_game",
      name: "البداية",
      description: "أكمل أول مسابقة",
      icon: "🎯",
      unlocked: stats.totalGames >= 1
    },
    {
      id: "perfect_game",
      name: "الكمال",
      description: "أجب على جميع الأسئلة بشكل صحيح",
      icon: "💯",
      unlocked: stats.perfectGames >= 1
    },
    {
      id: "streak_master",
      name: "سلسلة النجاح",
      description: "حقق 10 إجابات صحيحة متتالية",
      icon: "🔥",
      unlocked: stats.bestStreak >= 10
    },
    {
      id: "speed_demon",
      name: "البرق",
      description: "أجب على سؤال في أقل من 5 ثوان",
      icon: "⚡",
      unlocked: stats.averageTimePerQuestion < 5
    },
    {
      id: "expert",
      name: "الخبير",
      description: "حقق دقة 90% أو أكثر",
      icon: "🎓",
      unlocked: stats.accuracy >= 90
    },
    {
      id: "veteran",
      name: "المخضرم",
      description: "العب 50 مسابقة",
      icon: "🏅",
      unlocked: stats.totalGames >= 50
    },
    {
      id: "scorer",
      name: "الهداف",
      description: "اجمع 5000 نقطة",
      icon: "⚽",
      unlocked: stats.totalScore >= 5000
    },
    {
      id: "knowledge_master",
      name: "موسوعة كرة القدم",
      description: "أجب على 500 سؤال",
      icon: "📚",
      unlocked: stats.totalQuestionsAnswered >= 500
    }
  ];
}

// تصدير كل شيء
export default {
  QUIZ_QUESTIONS,
  CATEGORIES,
  QUIZ_MODES,
  shuffleQuestions,
  getQuestionsByDifficulty,
  getQuestionsByCategory,
  createCustomQuiz,
  getQuestionHint,
  calculatePoints,
  updatePlayerStats,
  getPlayerRank,
  getPlayerAchievements
};