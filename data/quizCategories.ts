/**
 * Quiz Categories
 * جميع أنواع الاختبارات موجودة محلياً في الفرونت إند
 */

export interface QuizCategoryLocal {
    id: string;
    name: string;
    icon: string;
    description: string;
}

export const QUIZ_CATEGORIES: QuizCategoryLocal[] = [
    {
        id: 'in-common',
        name: 'In Common',
        icon: '🔗',
        description: 'What do they have in common?',
    },
    {
        id: 'flash',
        name: 'Flash',
        icon: '⚡',
        description: 'Quick fire questions',
    },
    {
        id: 'who-am-i',
        name: 'Who Am I?',
        icon: '🎭',
        description: 'Guess the player from clues',
    },
    {
        id: 'high-five',
        name: 'High Five',
        icon: '🖐️',
        description: 'Name 5 things',
    },
    {
        id: 'qa',
        name: 'Q&A',
        icon: '❓',
        description: 'Multiple choice questions',
    },
    {
        id: 'teammates',
        name: 'Teammates',
        icon: '👥',
        description: 'Questions about teammates',
    },
    {
        id: 'guess-number',
        name: 'Guess the Number',
        icon: '🔢',
        description: 'Guess numbers and statistics',
    },
    {
        id: 'legends',
        name: 'Legends',
        icon: '👑',
        description: 'Questions about football legends',
    },
];

/**
 * Map category name to ID
 */
export const CATEGORY_NAME_TO_ID: Record<string, string> = {
    'In Common': 'in-common',
    'Flash': 'flash',
    'Who Am I?': 'who-am-i',
    'High Five': 'high-five',
    'Q&A': 'qa',
    'Teammates': 'teammates',
    'Guess the Number': 'guess-number',
    'Legends': 'legends',
};

/**
 * Get category by ID
 */
export function getCategoryById(id: string): QuizCategoryLocal | undefined {
    return QUIZ_CATEGORIES.find((cat) => cat.id === id);
}

/**
 * Get category by name
 */
export function getCategoryByName(name: string): QuizCategoryLocal | undefined {
    const id = CATEGORY_NAME_TO_ID[name];
    return id ? getCategoryById(id) : undefined;
}

