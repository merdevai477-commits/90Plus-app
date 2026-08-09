/**
 * TEMPORARY static fallback pack for the main daily quiz (/api/quiz/daily).
 *
 * ⚠️ TEMPORARY — remove once Gemini is confirmed reliably available. This is
 * the last-resort tier: used only when BOTH fresh AI generation fails AND
 * there is no previous valid pack in the DB to recycle (e.g. brand-new
 * environment, first day ever, or Gemini down before any pack ever built).
 *
 * Without this, a Gemini outage on day one leaves the daily quiz completely
 * unplayable with no fallback at all ("No fallback pack available").
 *
 * Exactly QUIZ_PACK_SIZE (15) questions per language, generic football
 * trivia — safe placeholder content, not tied to any specific date's real
 * matches/results.
 */

import type { QuizLanguage, QuizOptionKey, StoredQuizQuestion } from '../types/quiz.types';
import { QUIZ_PACK_SIZE } from '../constants/quiz.constants';

interface StaticQuestionSeed {
  question: { ar: string; en: string };
  options: { ar: [string, string, string, string]; en: [string, string, string, string] };
  correctKey: QuizOptionKey;
  difficulty: StoredQuizQuestion['difficulty'];
  hint?: { ar: string; en: string };
}

const SEEDS: StaticQuestionSeed[] = [
  {
    question: { ar: 'أي دولة استضافت كأس العالم 2022؟', en: 'Which country hosted the 2022 World Cup?' },
    options: { ar: ['قطر', 'روسيا', 'البرازيل', 'ألمانيا'], en: ['Qatar', 'Russia', 'Brazil', 'Germany'] },
    correctKey: 'A',
    difficulty: 'EASY',
  },
  {
    question: { ar: 'كم عدد لاعبي كرة القدم في الملعب لكل فريق؟', en: 'How many players does each football team have on the field?' },
    options: { ar: ['9', '10', '11', '12'], en: ['9', '10', '11', '12'] },
    correctKey: 'C',
    difficulty: 'EASY',
  },
  {
    question: { ar: 'ما هو النادي الحاصل على أكبر عدد من ألقاب دوري أبطال أوروبا؟', en: 'Which club has won the most UEFA Champions League titles?' },
    options: { ar: ['ريال مدريد', 'برشلونة', 'بايرن ميونخ', 'ميلان'], en: ['Real Madrid', 'Barcelona', 'Bayern Munich', 'AC Milan'] },
    correctKey: 'A',
    difficulty: 'MEDIUM',
  },
  {
    question: { ar: 'كم دقيقة مدة شوطي مباراة كرة القدم الرسمية؟', en: 'How many minutes are in each half of a standard football match?' },
    options: { ar: ['30', '40', '45', '50'], en: ['30', '40', '45', '50'] },
    correctKey: 'C',
    difficulty: 'EASY',
  },
  {
    question: { ar: 'أي لاعب يلقب بـ "الدون"؟', en: 'Which player is nicknamed "The Don"?' },
    options: { ar: ['كريستيانو رونالدو', 'ليونيل ميسي', 'نيمار', 'مبابي'], en: ['Cristiano Ronaldo', 'Lionel Messi', 'Neymar', 'Mbappé'] },
    correctKey: 'B',
    difficulty: 'MEDIUM',
  },
  {
    question: { ar: 'ما اسم الجائزة السنوية لأفضل لاعب في العالم؟', en: 'What is the name of the annual award for the world\'s best player?' },
    options: { ar: ['الكرة الذهبية', 'كرة الفضة', 'درع الأبطال', 'كأس القارات'], en: ["Ballon d'Or", 'Silver Ball', "Champions Shield", 'Confederations Cup'] },
    correctKey: 'A',
    difficulty: 'EASY',
  },
  {
    question: { ar: 'أي دولة فازت بأكبر عدد من كؤوس العالم؟', en: 'Which country has won the most World Cups?' },
    options: { ar: ['ألمانيا', 'الأرجنتين', 'البرازيل', 'إيطاليا'], en: ['Germany', 'Argentina', 'Brazil', 'Italy'] },
    correctKey: 'C',
    difficulty: 'MEDIUM',
  },
  {
    question: { ar: 'كم عدد اللاعبين الاحتياطيين المسموح تبديلهم في المباريات الرسمية الحديثة؟', en: 'How many substitutions are typically allowed in modern official matches?' },
    options: { ar: ['3', '5', '7', 'غير محدود'], en: ['3', '5', '7', 'Unlimited'] },
    correctKey: 'B',
    difficulty: 'MEDIUM',
  },
  {
    question: { ar: 'أي نادي يلعب مبارياته على ملعب "أولد ترافورد"؟', en: 'Which club plays its home matches at "Old Trafford"?' },
    options: { ar: ['ليفربول', 'مانشستر يونايتد', 'تشيلسي', 'أرسنال'], en: ['Liverpool', 'Manchester United', 'Chelsea', 'Arsenal'] },
    correctKey: 'B',
    difficulty: 'EASY',
  },
  {
    question: { ar: 'ما هو أقصى عدد من البطاقات الصفراء يحصل عليها اللاعب قبل الطرد؟', en: 'How many yellow cards result in a red card for a player?' },
    options: { ar: ['1', '2', '3', '4'], en: ['1', '2', '3', '4'] },
    correctKey: 'B',
    difficulty: 'EASY',
  },
  {
    question: { ar: 'أي لاعب سجل أكثر الأهداف في تاريخ كأس العالم؟', en: 'Which player has scored the most goals in World Cup history?' },
    options: { ar: ['بيليه', 'ميروسلاف كلوزه', 'رونالدو البرازيلي', 'مارادونا'], en: ['Pelé', 'Miroslav Klose', 'Ronaldo Nazário', 'Maradona'] },
    correctKey: 'B',
    difficulty: 'HARD',
  },
  {
    question: { ar: 'ما اسم البطولة القارية لكرة القدم في أفريقيا؟', en: 'What is the name of the continental football tournament in Africa?' },
    options: { ar: ['كوبا أمريكا', 'كأس أمم أفريقيا', 'كأس آسيا', 'يورو'], en: ['Copa América', 'Africa Cup of Nations', 'Asian Cup', 'Euro'] },
    correctKey: 'B',
    difficulty: 'EASY',
  },
  {
    question: { ar: 'أي نادي إسباني يعرف باسم "الملكي"؟', en: 'Which Spanish club is nicknamed "The Royal One"?' },
    options: { ar: ['برشلونة', 'أتلتيكو مدريد', 'ريال مدريد', 'إشبيلية'], en: ['Barcelona', 'Atlético Madrid', 'Real Madrid', 'Sevilla'] },
    correctKey: 'C',
    difficulty: 'EASY',
  },
  {
    question: { ar: 'كم عدد الحكام الرئيسيين داخل الملعب في المباراة الواحدة؟', en: 'How many main referees officiate inside the pitch during a match?' },
    options: { ar: ['1', '2', '3', '4'], en: ['1', '2', '3', '4'] },
    correctKey: 'A',
    difficulty: 'EASY',
  },
  {
    question: { ar: 'ما هي أول دولة استضافت كأس العالم؟', en: 'Which country hosted the first-ever World Cup?' },
    options: { ar: ['البرازيل', 'الأوروغواي', 'فرنسا', 'إيطاليا'], en: ['Brazil', 'Uruguay', 'France', 'Italy'] },
    correctKey: 'B',
    difficulty: 'HARD',
  },
];

function buildQuestion(
  seed: StaticQuestionSeed,
  language: QuizLanguage,
  index: number,
  packDateYmd: string,
): StoredQuizQuestion {
  const optionTexts = seed.options[language];
  const keys: QuizOptionKey[] = ['A', 'B', 'C', 'D'];
  return {
    id: `static-fallback-${packDateYmd}-${language}-${index + 1}`,
    question: seed.question[language],
    type: 'normal',
    options: keys.map((key, i) => ({ key, text: optionTexts[i] })),
    correctKey: seed.correctKey,
    difficulty: seed.difficulty,
    imageUrl: null,
    imageLayout: 'square',
    imageType: null,
    hint: seed.hint?.[language] ?? null,
  };
}

/**
 * Build a full QUIZ_PACK_SIZE-length static pack. Loops the seed list if it's
 * shorter than the pack size (it currently has 15 unique seeds = exact fit).
 */
export function buildStaticFallbackQuizPack(language: QuizLanguage, packDateYmd: string): StoredQuizQuestion[] {
  const pack: StoredQuizQuestion[] = [];
  for (let i = 0; i < QUIZ_PACK_SIZE; i += 1) {
    const seed = SEEDS[i % SEEDS.length];
    pack.push(buildQuestion(seed, language, i, packDateYmd));
  }
  return pack;
}
