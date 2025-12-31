/**
 * Flash Quiz Questions
 * أسئلة سريعة
 */

import { QuizQuestion } from './index';

export const FLASH_QUESTIONS: QuizQuestion[] = [
  {
    id: "afd77bba-77c9-4a8f-b363-769f4c773bb6",
    categoryId: "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    question: "Which country won the 2018 FIFA World Cup?",
    options: [
      "Brazil",
      "Germany",
      "France",
      "Argentina"
    ],
    difficulty: "EASY",
    points: 10,
    imageUrl: "https://media.api-sports.io/football/teams/541.png",
    imageType: "club",
    hint: null,
    timeLimit: 3, // 3 ثواني فقط - سؤال سريع جداً
    displayMode: 'before-question' // الصورة تظهر أولاً ثم السؤال يظهر فوقها
  }
];

