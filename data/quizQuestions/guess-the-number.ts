/**
 * Guess the Number Quiz Questions
 * أسئلة "خمن الرقم"
 */

import { QuizQuestion } from './index';

export const GUESS_THE_NUMBER_QUESTIONS: QuizQuestion[] = [
  {
    id: "f6f99e65-a393-4a7a-979e-722705f8f856",
    categoryId: "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    question: "How many World Cups has Brazil won?",
    options: [
      "3",
      "4",
      "5",
      "6"
    ],
    difficulty: "EASY",
    points: 10,
    imageUrl: "https://media.api-sports.io/football/teams/541.png",
    imageType: "club",
    hint: null,
    timeLimit: 15,
    displayMode: 'after-answer' // الصورة تظهر بعد الإجابة (صحيحة أو خاطئة)
  }
];

