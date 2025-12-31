/**
 * Teammates Quiz Questions
 * أسئلة عن زملاء الفريق
 */

import { QuizQuestion } from './index';

export const TEAMMATES_QUESTIONS: QuizQuestion[] = [
  {
    id: "ae650428-7086-49d5-8e82-6787f5d67052",
    categoryId: "04025ae4-15ac-4165-8113-e4b3f75d4145",
    question: "Which players formed the \"BBC\" trio at Real Madrid?",
    options: [
      "Benzema, Bale, Cristiano",
      "Benzema, Bale, Casemiro",
      "Benzema, Bale, Busquets",
      "Benzema, Bale, Beckham"
    ],
    difficulty: "MEDIUM",
    points: 15,
    imageUrl: "https://media.api-sports.io/football/teams/541.png",
    imageType: "club",
    hint: null,
    timeLimit: 15,
    displayMode: 'in-question' // الصورة في السؤال
  }
];

