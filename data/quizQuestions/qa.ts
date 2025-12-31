/**
 * Q&A Quiz Questions
 * أسئلة متعددة الخيارات
 */

import { QuizQuestion } from './index';

export const QA_QUESTIONS: QuizQuestion[] = [
  {
    id: "c83ef579-2c10-4a03-b692-5225d5d39875",
    categoryId: "867da722-843e-4ef5-851c-9c64e4ca96ba",
    question: "Which player has won the most Ballon d'Or awards?",
    options: [
      "Cristiano Ronaldo",
      "Lionel Messi",
      "Pelé",
      "Diego Maradona"
    ],
    difficulty: "MEDIUM",
    points: 20,
    imageUrl: "https://media.api-sports.io/football/players/1100.png",
    imageType: "player",
    hint: null,
    timeLimit: 15,
    displayMode: 'after-answer' // لا صورة قبل السؤال، تظهر بعد الإجابة
  }
];

