/**
 * Quiz Categories Data
 * بيانات كاتيجوريز الكويز
 */

export interface QuizCategoryLocal {
  id: string;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  icon: string;
  isLocked: boolean;
  unlockLevel: number;
  imageUrl?: string;
}

export const QUIZ_CATEGORIES: QuizCategoryLocal[] = [
  {
    id: 'legends',
    name: 'Legends',
    nameAr: 'الأساطير',
    description: 'Questions about football legends',
    descriptionAr: 'أسئلة عن أساطير كرة القدم',
    icon: '👑',
    isLocked: false,
    unlockLevel: 1,
    imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
  },
  {
    id: 'flash',
    name: 'Flash',
    nameAr: 'البرق',
    description: 'Quick fire questions',
    descriptionAr: 'أسئلة سريعة',
    icon: '⚡',
    isLocked: true,
    unlockLevel: 2,
    imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
  },
  {
    id: 'who-am-i',
    name: 'Who Am I?',
    nameAr: 'من أنا؟',
    description: 'Guess the player from clues',
    descriptionAr: 'خمن اللاعب من الأدلة',
    icon: '🎭',
    isLocked: true,
    unlockLevel: 2,
    imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
  },
  {
    id: 'high-five',
    name: 'High Five',
    nameAr: 'الخمسة العالية',
    description: 'Name 5 things',
    descriptionAr: 'اذكر 5 أشياء',
    icon: '🖐️',
    isLocked: true,
    unlockLevel: 3,
    imageUrl: 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800&q=80',
  },
  {
    id: 'qa',
    name: 'Q&A',
    nameAr: 'سؤال وجواب',
    description: 'Multiple choice questions',
    descriptionAr: 'أسئلة متعددة الخيارات',
    icon: '❓',
    isLocked: true,
    unlockLevel: 1,
    imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
  },
  {
    id: 'teammates',
    name: 'Teammates',
    nameAr: 'زملاء الفريق',
    description: 'Questions about teammates',
    descriptionAr: 'أسئلة عن زملاء الفريق',
    icon: '👥',
    isLocked: true,
    unlockLevel: 3,
    imageUrl: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80',
  },
  {
    id: 'guess-number',
    name: 'Guess the Number',
    nameAr: 'خمن الرقم',
    description: 'Guess numbers and statistics',
    descriptionAr: 'خمن الأرقام والإحصائيات',
    icon: '🔢',
    isLocked: true,
    unlockLevel: 2,
    imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
  },
];

/**
 * جلب كاتيجوري حسب المعرف
 */
export function getCategoryById(categoryId: string): QuizCategoryLocal | undefined {
  return QUIZ_CATEGORIES.find(cat => cat.id === categoryId);
}

/**
 * جلب الكاتيجوريز المفتوحة
 */
export function getUnlockedCategories(): QuizCategoryLocal[] {
  return QUIZ_CATEGORIES.filter(cat => !cat.isLocked);
}

/**
 * جلب الكاتيجوريز المقفلة
 */
export function getLockedCategories(): QuizCategoryLocal[] {
  return QUIZ_CATEGORIES.filter(cat => cat.isLocked);
}