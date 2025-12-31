/**
 * In Common Quiz Questions
 * أسئلة عن العلاقات المشتركة
 */

import { QuizQuestion } from './index';

export const IN_COMMON_QUESTIONS: QuizQuestion[] = [
  {
    id: "af09bae9-c899-442e-bdab-f53d7f977077",
    categoryId: "0c64124c-0479-48d5-a315-c5ca16852635",
    question: "What do these players have in common?",
    options: [
      "They all played for Real Madrid",
      "They all won the World Cup",
      "They all won the Champions League",
      "They all won the Ballon d'Or"
    ],
    difficulty: "MEDIUM",
    points: 20,
    imageUrl: "https://media.api-sports.io/football/teams/541.png",
    imageType: "club",
    hint: null,
    timeLimit: 15,
    displayMode: 'after-wrong' // الصورة تظهر فقط بعد الإجابة الخاطئة
  }
];

