/**
 * High Five Quiz Questions
 * أسئلة "اذكر 5 أشياء"
 */

import { QuizQuestion } from './index';

export const HIGH_FIVE_QUESTIONS: QuizQuestion[] = [
  {
    id: "8bfaa35f-7941-48ff-8c43-cb33b7405be9",
    categoryId: "476c5563-2e0d-406b-b103-60784b120624",
    question: "Name 5 players who won the World Cup and Champions League",
    options: [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    difficulty: "HARD",
    points: 30,
    imageUrl: "https://media.api-sports.io/football/teams/541.png",
    imageType: "club",
    hint: null,
    timeLimit: 15, // وقت أقصر للسرعة
    displayMode: 'in-question' // الصورة في السؤال بدون hint
  }
];

