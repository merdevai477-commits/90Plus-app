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
        id: '0c64124c-0479-48d5-a315-c5ca16852635', // In Common
        name: 'In Common',
        icon: '🔗',
        description: 'What do they have in common?',
    },
    {
        id: '4fa29ec6-3a01-4452-a28a-8d38113efb0e', // Flash
        name: 'Flash',
        icon: '⚡',
        description: 'Quick fire questions',
    },
    {
        id: '5bd54170-2e8f-402c-a4da-bf1d09098027', // Who Am I?
        name: 'Who Am I?',
        icon: '🎭',
        description: 'Guess the player from clues',
    },
    {
        id: '476c5563-2e0d-406b-b103-60784b120624', // High Five
        name: 'High Five',
        icon: '🖐️',
        description: 'Name 5 things',
    },
    {
        id: '867da722-843e-4ef5-851c-9c64e4ca96ba', // Q&A
        name: 'Q&A',
        icon: '❓',
        description: 'Multiple choice questions',
    },
    {
        id: '04025ae4-15ac-4165-8113-e4b3f75d4145', // Teammates
        name: 'Teammates',
        icon: '👥',
        description: 'Questions about teammates',
    },
    {
        id: '623f7528-7cb8-44a1-891c-a970e62a8b8b', // Guess the Number
        name: 'Guess the Number',
        icon: '🔢',
        description: 'Guess numbers and statistics',
    },
    {
        id: 'b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36', // Legends
        name: 'Legends',
        icon: '👑',
        description: 'Questions about football legends',
    },
];

/**
 * Map category name to ID (UUIDs)
 */
export const CATEGORY_NAME_TO_ID: Record<string, string> = {
    'In Common': '0c64124c-0479-48d5-a315-c5ca16852635',
    'Flash': '4fa29ec6-3a01-4452-a28a-8d38113efb0e',
    'Who Am I?': '5bd54170-2e8f-402c-a4da-bf1d09098027',
    'High Five': '476c5563-2e0d-406b-b103-60784b120624',
    'Q&A': '867da722-843e-4ef5-851c-9c64e4ca96ba',
    'Teammates': '04025ae4-15ac-4165-8113-e4b3f75d4145',
    'Guess the Number': '623f7528-7cb8-44a1-891c-a970e62a8b8b',
    'Legends': 'b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36',
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

