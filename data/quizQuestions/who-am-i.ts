/**
 * Who Am I? Quiz Questions
 * أسئلة "خمن من اللاعب"
 */

import { QuizQuestion } from './index';

export const WHO_AM_I_QUESTIONS: QuizQuestion[] = [
  {
    id: "5532b838-727c-4ac8-bc6f-3c4f8ceb1353",
    categoryId: "5bd54170-2e8f-402c-a4da-bf1d09098027",
    question: "I am German, I am the youngest player to score in World Cup for Germany, and I play for Bayern Munich. Who am I?",
    options: [
      "Jamal Musiala",
      "Florian Wirtz",
      "Kai Havertz",
      "Leroy Sané"
    ],
    difficulty: "HARD",
    points: 15,
    imageUrl: "https://media.api-sports.io/football/players/357.png",
    imageType: "player",
    hint: null,
    timeLimit: 15,
    displayMode: 'in-question' // الصورة في السؤال بدون hint overlay
  }
];

