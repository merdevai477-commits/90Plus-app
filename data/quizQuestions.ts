/**
 * Quiz Questions
 * جميع أسئلة الكويز من قاعدة البيانات
 * تم تصديرها تلقائياً - لا تعدل هذا الملف يدوياً
 * Generated at: 2025-12-31T00:59:59.990Z
 */

export interface QuizQuestion {
  id: string;
  categoryId: string;
  question: string;
  options: string[];
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  points: number;
  imageUrl?: string | null;
  imageType?: string | null;
  hint?: string | null;
  timeLimit?: number | null;
}

/**
 * Questions grouped by category ID
 */
export const QUIZ_QUESTIONS_BY_CATEGORY: Record<string, QuizQuestion[]> = {
  "04025ae4-15ac-4165-8113-e4b3f75d4145": [
    {
      "id": "ae650428-7086-49d5-8e82-6787f5d67052",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Which players formed the \"BBC\" trio at Real Madrid?",
      "options": [
        "Benzema, Bale, Cristiano",
        "Benzema, Bale, Casemiro",
        "Benzema, Bale, Busquets",
        "Benzema, Bale, Beckham"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8564e4ce-8c21-4089-83b5-c1a66dca9a77",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Which players were teammates at Barcelona in 2015 (MSN trio)?",
      "options": [
        "Messi, Neymar, Suárez",
        "Ronaldo, Bale, Benzema",
        "Salah, Mané, Firmino",
        "Mbappé, Neymar, Cavani"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ceeded91-6e6a-47b0-a55c-d6a1b8ca2a83",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Which players played together at Manchester City?",
      "options": [
        "De Bruyne, Agüero, Silva",
        "Messi, Iniesta, Xavi",
        "Ronaldo, Benzema, Modrić",
        "Neymar, Mbappé, Cavani"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/50.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b2f72abd-0b12-49b4-9070-5af6e39ae5ea",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Which players were teammates at PSG in 2021 (MNM)?",
      "options": [
        "Mbappé, Neymar, Messi",
        "Ronaldo, Benzema, Bale",
        "Salah, Mané, Firmino",
        "Messi, Suárez, Neymar"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/85.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3e3a0e87-a2de-407b-8aa0-27ab1170e90d",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 6: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "9957a28e-2136-4ae8-ae79-1b484921ea51",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 7: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e89aa649-25d8-49fb-9b6a-29e9a6f17abb",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 8: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "bba98d28-8421-43ba-a6cd-9daa1edab930",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 9: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6b40e355-365e-4be4-8a13-7e6a8e8d7e2d",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 10: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6ce5c592-9766-4e16-9f4e-9e50df956554",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 11: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3a6748e1-defe-4ec8-a06f-3e5e89bc42de",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 12: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6ee4b1b9-44b9-451f-9f45-5f46dd8279c1",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 13: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b15e236f-f4ca-48d4-a448-fa22cd8481e2",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 14: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ea1217b2-7d41-4c52-9faf-a5abe2ee0f25",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 15: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "33df23a3-29ba-485d-bf8e-05867f36888e",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 16: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b1282ada-ff38-464d-a285-6dcece97969a",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 17: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b4fd8056-ea9d-4ef7-9cc9-e4903dda5c0a",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 18: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a5a063c8-ea42-4fd9-b4cd-ecdf3486b193",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 19: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2944934f-1045-410e-b688-288daa6b2019",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 20: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a9546e25-1f08-4105-a886-31a8ee88aa24",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 21: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b47c4474-a381-4eb6-b7c0-5ec242c78f1e",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 22: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "01bd1e44-1672-42c5-b08d-3ffaa78d72c0",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 23: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f4c7506c-83f3-4802-a770-e3f7e8c60f15",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 24: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "318f24ba-a5b3-491f-a97c-5a7eb2784150",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 25: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "78190532-a5fa-4589-be42-faf30419c4c3",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 26: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7fe2db6a-df48-4b95-aee8-4552bfd1c60b",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 27: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "507c4c99-cc64-4f05-b5e0-60cf00fd94c1",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 28: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1e56cecf-677b-4dc2-b3c5-f369adf5d616",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 29: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "55ca1ecb-839b-4862-9f52-a15e7c96ace1",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 30: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "acc3aac5-a50e-4e03-8a34-8d1212ee9f8e",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 31: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5a272069-d364-4cbe-8f19-c796381871a0",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 32: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "669318d0-8fa9-42c3-bd9c-41add5d85059",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 33: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a7283dc7-2993-49a6-9cbd-da08a632efcc",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 34: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5052c468-7710-4734-8e20-7d18eb0dcac5",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 35: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a57b6dd1-d2ca-482b-bf43-5477fc7fa290",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 36: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0935f6c1-ac83-4a59-8fe6-1200de0be396",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 37: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "679ac8b1-0c92-405e-b5ef-88fbe524cc7b",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 38: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1bb77c0d-7cc7-4eac-8c9e-0ab0defacbcf",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 39: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "62d0c923-2685-4a9d-8283-4e1bb1ff0edf",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 40: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "bf31254f-4726-4896-917f-e85032946245",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 41: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "26d388d6-a83e-499f-9ad4-009ff0e544d8",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 42: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1a2aa260-27f6-4f22-ad1d-1564b3efbef2",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 43: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "28a96e51-ed8b-40df-9396-53649348d139",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 44: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "31794cdc-1d4d-411a-b277-54240f2078d5",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 45: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c4e56ed0-601d-4344-9e4b-fd9607f1cee4",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 46: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "586fbee6-3177-4214-9ff6-8bf0d8f3210a",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 47: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ee787746-c155-4f71-bcc4-dcc4265891a0",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 48: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5103279b-517b-45f4-9d4f-99cde6c5265c",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 49: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "fdadc21b-c442-4024-8512-ec14002568f7",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 50: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3542c381-6ff9-47e1-8a2f-ec84cfd0a451",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 51: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ce188f51-d1f3-475e-a4d9-1bdd72f78673",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 52: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "bd8701a3-e8cf-4fe5-b1c6-90bf3ad3bf61",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 53: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "957d53a7-437a-40e3-b72c-4973a30a5376",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 54: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "cd0a2774-81f6-42d4-a998-1dc657abfae4",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 55: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "41b33444-33c5-4339-8459-e1be06b8b263",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 56: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e021ae8d-47b5-4493-9636-a056588793de",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 57: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "981f9a40-f257-47e4-82a4-ca7f6d8dca52",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 58: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8d4e3dc7-3262-4ddd-bb93-7d5f32849937",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 59: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6da4e5c2-bfc4-4589-aadf-31003ec11404",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 60: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "fff52fb4-e63d-4ece-8593-4cff78745d13",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 61: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "af821e41-5719-4c22-84de-46592b6b2f6b",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 62: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "95f5634a-94ce-4a6c-ab2c-5c30f2670c76",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 63: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "25396f7f-49e3-4841-b1a0-be194be1fb9f",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 64: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "de78f9e7-5729-49dc-84da-3238ead2d788",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 65: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "182e71ba-90eb-451f-b811-24ce57400c81",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 66: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b392b61a-654c-4713-854d-dfcae4a25002",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 67: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0f8c294e-a336-4df8-a659-93cb3d1dbe4c",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 68: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3192e305-5226-4821-8c08-7bdc71271de6",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 69: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "94f9e31f-2356-45d6-b27c-2cbfa4b0f723",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 70: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e04fdb32-decd-4829-9307-cb5221d18e3e",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 71: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e414ee66-c40e-4b5c-8e25-ea714a51eaca",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 72: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2c6738f1-bcbd-47da-be4f-be641688aa92",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 73: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8046d087-51eb-4168-b305-9229feb71d72",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 74: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b438e1f2-af64-4765-9b85-315335c9cbd3",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 75: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "447acf82-5e6c-458d-9a95-eff2d4871113",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 76: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1245e15b-b9e2-4762-a510-e78e0e58a102",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 77: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "dc6f036c-f818-4039-827e-450e02fac745",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 78: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e5911555-b6e8-492d-bc56-b92fa90fb80f",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 79: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c37034fc-0b30-4f4d-8d6d-bc1fd28ef252",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 80: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c5a2c270-9d1e-4a03-9695-79e9cab39696",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 81: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "28ffb796-e366-42b9-a23d-265dd321e346",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 82: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b42c25c8-fa59-4bec-b33b-ac3807c8d761",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 83: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8fb741e9-447b-44bc-974d-a8db16a90507",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 84: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d0a65b0a-9bd0-4fda-a231-f030a44b31c3",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 85: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "edd60298-a350-4c9c-9f5a-aed70456ccbc",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 86: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "43ae0102-e354-44d3-8e5c-fa4f1f17e1c1",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 87: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ec251005-2988-44ae-a314-f89aae6ea571",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 88: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "fbd5ad8b-4b26-42b8-b6ad-cc7d5f132be0",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Which players were teammates at Liverpool in 2020?",
      "options": [
        "Salah, Mané, Firmino",
        "Messi, Suárez, Neymar",
        "Ronaldo, Modrić, Kroos",
        "Mbappé, Neymar, Di María"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/40.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "105d5001-8d63-49ce-a9e0-32059114bf05",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 89: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "cdc79b1c-adc5-4201-a6b8-76f308686785",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 90: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f6d1ec5c-ade2-4836-89b5-68514a38cd0b",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 91: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "37161f64-7eb5-431d-a8c9-74a1c0360ecd",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 92: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c918fcad-6b23-46c0-962b-dabde529a9cf",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 93: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6323bfd8-bba1-43e9-98bc-84cfb443bc8d",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 94: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7590682c-55eb-4475-aa1c-bd30a4ec185f",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 95: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "883ce695-d2b9-47d0-b290-acdf75701a09",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 96: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "de275f8f-2af0-48fd-bc17-fb3541689cd8",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 97: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "da5256e9-3e35-4547-aea0-a13c0d8c2c70",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 98: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f9a07b74-3572-40a1-a0c6-771fdb6376ac",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 99: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "965c5f36-fa76-4bdf-b25d-f9937e25fd60",
      "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
      "question": "Teammates question 100: Which players were teammates?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/teams/541.png",
      "imageType": "club",
      "hint": null,
      "timeLimit": 15
    }
  ],
  "0c64124c-0479-48d5-a315-c5ca16852635": [
    {
      "id": "af09bae9-c899-442e-bdab-f53d7f977077",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 88)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2e1c1aee-4b15-4734-abe1-c98ffbb47968",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Cristiano Ronaldo and Lionel Messi have in common?",
      "options": [
        "Both won World Cup",
        "Both won Ballon d'Or",
        "Both played for Barcelona",
        "Both are from Brazil"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f06b8124-1cd8-48a5-aced-c9969de605c7",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Mohamed Salah and Sadio Mané have in common?",
      "options": [
        "Both play for Liverpool",
        "Both won Champions League together",
        "Both are Egyptian",
        "Both won Ballon d'Or"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2f5c1098-35b5-40b1-9fe6-416ad3fba423",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Real Madrid and Barcelona have in common?",
      "options": [
        "Both from Madrid",
        "Both won Champions League",
        "Both from Catalonia",
        "Both founded in 1900"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1febc236-c0ff-4761-ba30-5c9bafd3ad5a",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Pelé and Diego Maradona have in common?",
      "options": [
        "Both won World Cup",
        "Both Brazilian",
        "Both played for Barcelona",
        "Both won Ballon d'Or"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "bbc57ae0-aa03-4e81-a3a5-9ecafd180024",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Manchester United and Liverpool have in common?",
      "options": [
        "Both from London",
        "Both won Premier League",
        "Both from Manchester",
        "Both founded in 1900"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d6733dd0-1607-40f0-87d0-692749bad170",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Kylian Mbappé and Erling Haaland have in common?",
      "options": [
        "Both Norwegian",
        "Both play for PSG",
        "Both born in 2000",
        "Both won World Cup"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3d1939e1-046d-4f96-9616-b156c9ff0c4f",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Manchester City and Chelsea have in common?",
      "options": [
        "Both from Manchester",
        "Both won Premier League",
        "Both owned by Russians",
        "Both founded in 1880"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "11bc268f-7ea5-4c03-acd2-3df86c10a6b0",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Neymar and Vinicius Jr have in common?",
      "options": [
        "Both play for Real Madrid",
        "Both Brazilian",
        "Both won World Cup",
        "Both born in 1992"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6a1ca96f-f8d1-4f18-9584-8dc9226f14ef",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Bayern Munich and Borussia Dortmund have in common?",
      "options": [
        "Both from Munich",
        "Both won Bundesliga",
        "Both from Berlin",
        "Both founded in 1909"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "59b9b2da-5522-4b18-8095-40d33730acb6",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Kevin De Bruyne and Eden Hazard have in common?",
      "options": [
        "Both Belgian",
        "Both play for Chelsea",
        "Both play for Manchester City",
        "Both Spanish"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8f954255-0c08-4196-b05c-db46ab1c1068",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do AC Milan and Inter Milan have in common?",
      "options": [
        "Both from Rome",
        "Both share San Siro",
        "Both from Turin",
        "Both founded in 1899"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0514a298-cf22-4506-bf4e-61581a14ec16",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Zinedine Zidane and Didier Deschamps have in common?",
      "options": [
        "Both French",
        "Both won World Cup as player and coach",
        "Both play for Real Madrid",
        "Both Italian"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d0a294fa-7e88-4fe5-9db5-5cd66e5bcdf3",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Barcelona and PSG have in common?",
      "options": [
        "Both Spanish",
        "Both won Champions League 2021",
        "Both from Catalonia",
        "Both have Messi played for them"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "27e5c53f-8a8d-491c-80be-689ed36083ac",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Luka Modrić and Ivan Rakitić have in common?",
      "options": [
        "Both Croatian",
        "Both play for Real Madrid",
        "Both play for Barcelona",
        "Both Serbian"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3be4d3ef-3bf2-425a-bcc3-38c4773a182d",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Arsenal and Tottenham have in common?",
      "options": [
        "Both from London",
        "Both won Premier League",
        "Both from Manchester",
        "Both founded in 1886"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6c849a3a-913a-4295-97a1-a6c09be91580",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Sergio Ramos and Gerard Piqué have in common?",
      "options": [
        "Both Spanish",
        "Both defenders",
        "Both played for Real Madrid",
        "Both French"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "cc83c751-f845-4065-be00-271a9f080d9f",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Juventus and Napoli have in common?",
      "options": [
        "Both from Milan",
        "Both won Serie A",
        "Both from Turin",
        "Both from Naples"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d37486e3-eea0-46d2-a373-1d3f9fd56a10",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Andrés Iniesta and Xavi Hernández have in common?",
      "options": [
        "Both play for Real Madrid",
        "Both Spanish midfielders",
        "Both play for PSG",
        "Both French"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "68ee9551-a28a-4484-8005-0135cf6365a0",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Atletico Madrid and Sevilla have in common?",
      "options": [
        "Both from Barcelona",
        "Both won La Liga",
        "Both from Madrid",
        "Both from Seville"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0c1ea7d0-91a6-46f4-a222-6e8bc627cef1",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do Virgil van Dijk and Matthijs de Ligt have in common?",
      "options": [
        "Both Dutch defenders",
        "Both play for Liverpool",
        "Both play for Juventus",
        "Both German"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5d997b7f-ca46-4066-9440-42b7b011a2e8",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 21)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8abc9017-5880-408f-ba93-58452c51e781",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 22)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "480854a0-dbb2-4da2-a7e9-263f14c99dbf",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 23)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d84d2590-164e-4523-9e30-ae90a7401fc1",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 24)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "72f87afb-14db-438a-9846-631cd1170f93",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 25)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "36339fb2-b229-4ba2-a74b-f0308a04ff5d",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 26)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f7386408-c445-4998-9868-5e6feebe0396",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 27)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "15aa5eee-c7e1-4d5c-9bee-cd44f5c1653b",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 28)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "bfb5c8bc-dd68-4977-9ee2-3d7395fc4249",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 29)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ff4b1c5d-499b-42b3-8b7d-ac6c4931dbce",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 30)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f067d302-1442-43ee-95a1-58ef0f6b44d4",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 31)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "046afe79-e8d6-495e-b10d-9a043ea7e119",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 32)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "17b3a6ae-458f-49bc-bed7-86fed0b01a8a",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 33)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5eb2f201-31d0-46d0-acb7-e53707d79400",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 34)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ca5a2e51-d4de-4249-8403-52bdb792be5f",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 35)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "53027b93-ff6e-4822-9c8c-41bfa998ffbe",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 36)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2f530d06-f633-4637-9ef3-5896d9d20999",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 37)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2966410d-de21-4d44-af4f-9b6fc73fe7dd",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 38)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "26e471da-1504-4b3a-8a2d-41077cf4ad72",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 39)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "cd924673-7d07-4b1e-a7eb-24e03881f669",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 40)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "cc197a0b-6963-4ce1-8409-e1754991446a",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 41)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3440e745-4288-4251-af8b-a1e08bccd5ea",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 42)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5086cab7-418c-449d-ac67-ada1e07d4612",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 43)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "709ebacd-4f30-4018-b270-7b71bec4fdff",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 44)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e7872fe8-c24d-4690-8db2-96aa36875c49",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 45)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "200758a7-f4f8-4ace-89c4-b8b00196f073",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 46)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b331a40e-0907-477f-8733-c0204b7ab7ac",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 47)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c3bf8fad-0771-49a6-9af2-e92e8b824bb0",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 48)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1e4a1b11-d203-4fa7-b6f8-f5f5dbf5ce47",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 49)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a11fef57-08d2-4b15-bc5a-5d2d41851256",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 50)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1888a5f2-35ad-4063-ab9b-94f2f74a6681",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 51)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "9056b38f-3429-4d93-8389-219e215f32c7",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 52)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "4bb5a96e-84ce-4ea5-a76f-a39a41445d35",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 53)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b6b0e1ed-5264-4e5f-9473-d00dc33b8edf",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 54)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6f47d606-220d-4aff-9608-7371ae970639",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 55)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7f184423-1c52-410a-bf82-f9e339b51da7",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 56)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3cc90335-d5ad-4fc6-94db-c37027b644a0",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 57)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "4532d297-0649-4ee3-99fc-4d2f41c6c4a2",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 58)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e2c7e63a-0828-42ce-b911-836ada490dd6",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 59)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5a592cb4-3b45-4e79-a61a-f224cdfad198",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 60)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a09eb535-3303-478d-be21-fae80ce4beed",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 61)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8520eb5a-ab33-4747-a873-1901afb511b6",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 62)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "40382ebb-ed46-4bfa-8fb4-e7706e097a2c",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 63)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e802158b-9128-4c67-8fd6-eaa97b4ced90",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 64)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b38ec164-0d08-4e23-a6aa-4fe0afdf07ec",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 65)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8e339fa6-10cf-4d5d-add5-5c734cf0ee8e",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 66)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "25245499-7434-463b-9bef-b869304cfc80",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 67)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "dcc4b35f-bf2f-45f7-9236-517e4136c735",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 68)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7156ebec-84fe-49c8-8a36-2ab721a13101",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 69)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6a12fb99-2bbc-4d6b-a425-8b41d46ac1f4",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 70)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "02488500-7ad4-4efa-8ed6-714a53e5d9ae",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 71)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7ccdf496-fa1a-4e92-bc84-847896d3de95",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 72)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "92f9529c-14d0-49fe-9b70-d0001d556ca8",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 73)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d962e321-c044-4b75-9b05-2a3fe163dc1e",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 74)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "103e9cae-8438-42db-91dd-74cec2f5c54c",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 75)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3d81980a-4a59-4cba-bd84-ceccc1fd2724",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 76)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "663a2c88-2a7b-4cc3-8c51-b29414e06b12",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 77)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "bb061134-d41e-467e-a891-6fc9b48dd9de",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 78)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2106ae81-55a7-4f86-a2b0-77ce4f2d2735",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 79)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "fbdd53af-9dea-4894-ad7b-6c5fe7144242",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 80)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "28a403c6-9d1c-4f81-88f6-f5f818fe110a",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 81)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d34f3d7d-4a6b-40b2-b66d-cfa11f6bb779",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 82)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "30a4edc7-f372-4363-9b80-163fc1c8d982",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 83)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "718bc154-3581-4733-a4b0-87e6b5458eb9",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 84)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "92f5258d-2aad-43f5-ad60-3c93e09ae094",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 85)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7c382a48-b386-4b40-91a5-718ee6f31ed7",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 86)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "75d8c127-1d60-454e-838a-c719268913f7",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 87)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "adcb27a7-ccf1-4a1f-86f1-ef31a4c5c5d5",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 89)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "368a33d2-fc70-410c-9f6d-91c92e15d790",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 90)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e8c4455c-b607-40be-a5b1-691f19b546af",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 91)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "cbfa6919-5246-4bae-8621-5cc54120542b",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 92)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7a2dda45-0816-40ef-bf5f-4e66052b948e",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 93)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "93859fa0-9a48-416a-8f40-9709010e30bf",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 94)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5ad3ace1-78ae-47e1-8fa4-e7d52c8e0038",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 95)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1da6a628-4d05-4311-a438-a55fdee0c0dc",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 96)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "24b28ad5-217f-449d-a013-76e399e90ff7",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 97)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ebdec751-5790-4c64-818a-0e371dcd542e",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "What do these players have in common? (Question 98)",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "235af2de-a36a-48d0-919a-92d10abf5568",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which two players share the same nationality? (Question 99)",
      "options": [
        "Player A & B",
        "Player C & D",
        "Player E & F",
        "Player G & H"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1f0d72d6-43b7-4af0-b081-31b9ab8af580",
      "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
      "question": "Which clubs have won the same competition? (Question 100)",
      "options": [
        "Club A & B",
        "Club C & D",
        "Club E & F",
        "Club G & H"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    }
  ],
  "476c5563-2e0d-406b-b103-60784b120624": [
    {
      "id": "8bfaa35f-7941-48ff-8c43-cb33b7405be9",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 99: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "cf4043b1-73ef-4bc6-b4aa-83f0ad8bfe64",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 98: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "4472431b-3a9f-4160-8870-e98337390e9f",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 97: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "ae42ac77-98bb-4662-b5e7-580f54a23072",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 96: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "0afeda0b-bf34-462a-bdb0-36cbc00d4f50",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 95: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "69118b94-2b89-4698-afb4-72903ec4b415",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 94: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "e236e46e-9148-41bc-83ad-730ed39cc7a1",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 93: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "4a04a26e-213e-4f48-8cfa-912f188765f6",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 92: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "d9874586-3b0b-4f50-bcc6-8342989f0ed7",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 91: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "c24fb6f4-87ae-4333-b1ed-3f54ae508266",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 90: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "6cedadf1-c234-4472-855f-3a65fa556430",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 89: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "e98ee0e9-0199-471e-9b1c-b193fc34afdf",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 88: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "854a99dc-e6d2-4e3b-b975-7445dccd7f0a",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 87: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "d14b0f46-d472-4296-bf0b-9e5f673704d7",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 86: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "383ac2ab-40bf-44da-b005-29c7c475254c",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 85: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "155a7586-17c2-4192-9a50-ed520f78da8d",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 84: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "cf0e1541-92f7-4f79-aa22-ed7f5c4d26c1",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 83: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "e58c8b73-472e-4d81-b3ef-5b3dec61aa9e",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 82: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "b604ed9f-a6be-4c2f-bdf3-b8a4f22a5a50",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 81: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "b92275ac-e924-467a-b2ba-a76b08bd1ea9",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 80: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "4737080c-2cee-4b0f-99eb-4f45290a05c3",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 79: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "a5b423a8-bccd-4388-a245-3c1c7d56ce82",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 78: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "f74fe2f0-0874-4d6c-be1e-b10a1658910e",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 77: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "e04f360e-15a5-44db-8675-91f84c743495",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 76: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "a8335cdc-20d8-446e-97a5-385c3e79be02",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 75: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "88b605dd-6005-40f3-bbd0-db1b6ba70aee",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 74: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "81c7c932-7c01-4b3a-a82a-150973d7495f",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 73: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "9ba3d90c-4eec-4e7a-9e5c-65c4fb7c172e",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 72: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "819f0989-1305-4ecb-bdea-e82233c34968",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 71: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "8869a0c2-8766-4990-9b3c-3d99872727ff",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 70: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "795a21b1-3fc2-4d95-84c2-62b871ec4e65",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 69: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "148b51f5-b0ac-48d1-9afe-5ed358242176",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 68: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "91c5d0ed-c15c-452e-897a-ce8e000f7490",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 67: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "bcff004d-8cc0-4164-a1c6-65d6f54cc154",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 66: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "156e6193-90f9-40f9-a3bd-955bd5d0e8aa",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 65: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "4c3df06f-6e82-4856-b504-2420a7304496",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 64: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "47ea1b7b-2005-4f61-b1fa-c21dba9162c9",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 63: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "da55e57f-8b92-4599-b294-133dfa54d618",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 62: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "c273977d-327d-4e73-b88c-4cd9c8447321",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 61: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "a4812390-b01d-4fb8-a604-b1e2f5fd71ec",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 60: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "750edff2-84b8-4a8b-9f5e-c7229bf4271a",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 59: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "b1c7ed93-ed86-4e17-81e2-be564fc783e2",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 58: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "7b65241b-b62a-423f-a980-664aa139ae98",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 57: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "94819ab0-68ad-4b63-a780-921231f10b9d",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 56: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "0711945f-43d5-4370-9cd5-0c7ed488da2f",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 55: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "17c68d85-6a9b-4978-966f-bace8318a23b",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 54: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "a3d8d932-c8aa-4a04-a207-0943ae32c939",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 53: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "cc55ec39-8fbf-4b3a-924c-d345982e959a",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 52: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "6377f17c-e346-4bde-b911-f10e74ab843f",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 51: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "08297516-160f-4304-9ab2-04a674f4b51d",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 50: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "33fbbe69-c690-4e16-91a0-3af7f20af6e7",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 49: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "ca335606-9a74-4ddc-b8e3-741cd54cde9c",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 48: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "6d2d83a3-ea13-4774-9d27-bee80a689745",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 17: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "84b39ee2-4457-40d9-af7e-eaac3930ec09",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 47: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "0ad6d02d-5973-4924-8066-9ff0e2715a9a",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 46: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "a0920c81-3d10-4f99-a15e-48c60e7741b4",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 45: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "5629abd7-c471-489d-aade-36425fab18f6",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 44: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "df2e4acb-4c87-419f-a7c9-75084a046e58",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 43: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "72c98c9e-3320-4f4d-a659-bf3ce200f935",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 42: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "0e552bbd-bd63-463e-ba16-4112f055e8d0",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 41: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "e92b5c06-33e6-43a4-86e0-e70ea169aea9",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 40: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "d83d9a75-6755-44f1-8ffb-6a6ec1f05abf",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 39: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "612e3493-45b9-4a18-95ce-7e7ee13b9075",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 38: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "846be314-ba7c-4b33-99bf-430b30300bb8",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 37: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "dbe80bb5-b27b-4aed-b475-9210ee87deed",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 36: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "d15051ed-2f00-4279-999b-419d900aafc2",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 35: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "5bc994d8-99a0-44af-b4ae-77436a52b5b6",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 34: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "6ef14404-6bfb-434f-9db2-9030d881d131",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 33: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "54c3b659-ae1d-42fc-a466-570688adfc59",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 32: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "0769942c-f79d-46c5-a866-ced111bd730a",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 31: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "9572e6c2-00a9-4ee1-92b6-c0b449a32728",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 30: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "5c23cf62-998b-4d8d-939d-007f5370848f",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 29: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "26131f44-d77b-467e-825e-ab06a16dadd9",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 28: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "3d6e86ae-b722-49c0-ac48-49fa69325604",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 18: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "03ae957e-e144-4845-8311-fc82760ad5a8",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 27: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "36ebea3f-8aa0-4c57-abe3-738af3cce918",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 26: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "22486f94-d20f-4912-b657-e7a98be82bf5",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 25: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "05125f0a-3997-4dcb-88d7-35ca8476a8c2",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 24: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "b3250d25-c203-4d6b-b58d-27748733c2e9",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 23: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "957fcfab-5863-45c8-9834-890cf20df676",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 22: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "20285d0b-ec4f-4a8d-81f9-694f38a893e4",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 21: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "3f37a3da-f1d1-4b75-a9da-b8bb2c1c8d10",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 20: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "980d2438-0aa2-40ae-a6b0-0fb52b23d2cf",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 16: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "c0dd2388-cd98-4e51-8a84-481c7aa8aaa5",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 15: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "6738e2ae-f6af-49a2-9651-ea4a303677f6",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 14: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "22f46dde-e53f-4b0c-b87f-2b998714f745",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 13: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "d036df92-f619-4009-af86-439b7d35bc99",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 12: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "946c572a-fc2e-4f5a-b4a1-c9517a7cb445",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 11: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "13323937-9e28-45ad-a2b6-b39282aece33",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Who scored the fastest hat-trick in Premier League history?",
      "options": [
        "Sadio Mané (2:56)",
        "Mohamed Salah (3:02)",
        "Alan Shearer (4:15)",
        "Robbie Fowler (4:33)"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "7bdc302c-447d-46fd-808c-5f37ba5f5f64",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Which club has the longest unbeaten streak in Champions League?",
      "options": [
        "Real Madrid (17)",
        "Barcelona (15)",
        "Bayern Munich (19)",
        "Arsenal (12)"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "b9c06e01-3b69-4984-82a1-0ccc48d6edde",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Who is the oldest player to score in a World Cup?",
      "options": [
        "Roger Milla (42)",
        "Pelé (37)",
        "Fabio Cannavaro (36)",
        "Buffon (40)"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "bff96265-3dff-4b63-bf88-db8070cfca22",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Which player scored the most goals in a single World Cup tournament?",
      "options": [
        "Just Fontaine (13 goals)",
        "Gerd Müller (10 goals)",
        "Pelé (6 goals)",
        "Ronaldo (8 goals)"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "326339ed-a735-4424-8abe-d5aaadf00d4f",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Who is the only player to score in 4 different Champions League finals?",
      "options": [
        "Cristiano Ronaldo",
        "Lionel Messi",
        "Raúl",
        "Karim Benzema"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "d77a54f3-45df-4796-a812-a0bf2b565861",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Which player has won the most Champions League titles?",
      "options": [
        "Cristiano Ronaldo (5)",
        "Paolo Maldini (5)",
        "Francisco Gento (6)",
        "Lionel Messi (4)"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "98ee5d14-524a-4e3d-88a9-9ad556e51ace",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 19: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "71189020-d923-4970-809e-c2d67db45e0d",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "What is the fastest goal in World Cup history?",
      "options": [
        "7.89 seconds",
        "11 seconds",
        "15 seconds",
        "20 seconds"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "e20c6115-0572-496d-8f80-6110a63db488",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Which player has scored in 5 different World Cups?",
      "options": [
        "Pelé",
        "Diego Maradona",
        "Cristiano Ronaldo",
        "Lionel Messi"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "e1ba75a6-7984-4b2e-afb3-3374f97907da",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Which goalkeeper has won the Ballon d'Or?",
      "options": [
        "Lev Yashin",
        "Gianluigi Buffon",
        "Manuel Neuer",
        "Iker Casillas"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "148f3abb-638d-46dd-bd27-a6dbcf8b38e7",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Who is the youngest player to score in a World Cup final?",
      "options": [
        "Pelé (17 years old)",
        "Kylian Mbappé (19 years old)",
        "Michael Owen (18 years old)",
        "Lionel Messi (21 years old)"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    },
    {
      "id": "a9d41000-ba17-469d-a646-2f92766713f7",
      "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
      "question": "Hard question 100: Advanced football knowledge required.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 25
    }
  ],
  "4fa29ec6-3a01-4452-a28a-8d38113efb0e": [
    {
      "id": "afd77bba-77c9-4a8f-b363-769f4c773bb6",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Which country won the 2018 FIFA World Cup?",
      "options": [
        "Brazil",
        "Germany",
        "France",
        "Argentina"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "bcb51c14-2eeb-4026-9118-cfe8fdfef70f",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Who scored the most goals in World Cup history?",
      "options": [
        "Miroslav Klose",
        "Pelé",
        "Ronaldo Nazário",
        "Lionel Messi"
      ],
      "difficulty": "MEDIUM",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "80dae5c8-4b85-43f4-b26f-9eda1c2c55b2",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Which club has won the most Champions League titles?",
      "options": [
        "Barcelona",
        "Real Madrid",
        "AC Milan",
        "Bayern Munich"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "e70fd482-3245-4acc-9e4e-e5d54200b091",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Who won the 2022 World Cup?",
      "options": [
        "France",
        "Brazil",
        "Argentina",
        "Croatia"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "9294fbaf-2918-4fc5-9ad3-c53749c6fd56",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Which player has won the most Ballon d'Or awards?",
      "options": [
        "Cristiano Ronaldo",
        "Lionel Messi",
        "Pelé",
        "Diego Maradona"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "e2b2707d-4be0-41be-b611-fcc09f05c955",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "How many players on a football team?",
      "options": [
        "9",
        "10",
        "11",
        "12"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "19d8a5e9-42f3-4314-b773-840c0707ec78",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "How long is a football match?",
      "options": [
        "80 minutes",
        "90 minutes",
        "100 minutes",
        "120 minutes"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "c766391c-1a11-4ac0-aa0a-4c6152b0342c",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Which country won Euro 2020?",
      "options": [
        "France",
        "Italy",
        "Spain",
        "England"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "315ca3d9-2368-42b5-98d8-1c295779a0a9",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Who is the all-time top scorer in Champions League?",
      "options": [
        "Cristiano Ronaldo",
        "Lionel Messi",
        "Raúl",
        "Karim Benzema"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "db70b96e-6a1f-4bbc-8e75-27ab4c1225af",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Which league is known as Premier League?",
      "options": [
        "Spain",
        "England",
        "Germany",
        "Italy"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "0d108895-e034-4a18-86e6-838a918967d2",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "How many times did Brazil win the World Cup?",
      "options": [
        "3",
        "4",
        "5",
        "6"
      ],
      "difficulty": "MEDIUM",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "3d8169ae-3000-4b11-871d-9d571676b121",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Who won the Golden Boot in World Cup 2018?",
      "options": [
        "Kylian Mbappé",
        "Harry Kane",
        "Antoine Griezmann",
        "Luka Modrić"
      ],
      "difficulty": "MEDIUM",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "4bc0ecf8-2574-46eb-897b-82b3b384a568",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Which country hosted World Cup 2018?",
      "options": [
        "Qatar",
        "Russia",
        "Brazil",
        "South Africa"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "0568180c-1243-4715-8ae3-c95db77a80d1",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "What does VAR stand for?",
      "options": [
        "Video Assistant Referee",
        "Virtual Action Review",
        "Video Action Replay",
        "Virtual Assistant Referee"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "a8531e15-fb60-42e6-9baa-3125074119e2",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "How many substitutions allowed in a match?",
      "options": [
        "3",
        "5",
        "7",
        "Unlimited"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "665e8e15-c4aa-4e15-a96b-b76bd224f7b4",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Who won Champions League 2023?",
      "options": [
        "Manchester City",
        "Real Madrid",
        "Liverpool",
        "Bayern Munich"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "19dbe924-b036-424a-a7c9-b7146259ddca",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Which player has most goals in Premier League history?",
      "options": [
        "Alan Shearer",
        "Wayne Rooney",
        "Sergio Agüero",
        "Thierry Henry"
      ],
      "difficulty": "MEDIUM",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "bbc82735-ea3d-4b02-a581-3ac97fcdaf35",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "How many teams in Premier League?",
      "options": [
        "18",
        "20",
        "22",
        "24"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "cb7ff592-6384-4201-ba52-c4e179952f98",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Which country won World Cup 2014?",
      "options": [
        "Argentina",
        "Germany",
        "Brazil",
        "Netherlands"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "350f3fb6-58f5-44a9-aca6-80d68a1ecdeb",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Who scored fastest hat-trick in Premier League?",
      "options": [
        "Sadio Mané",
        "Mohamed Salah",
        "Sergio Agüero",
        "Alan Shearer"
      ],
      "difficulty": "HARD",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "a2e46193-6329-4127-a3ff-54cb17a0e9b9",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 21: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "ba972ebb-0a8c-41c2-81be-5167681c7c70",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 22: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "f07f0676-871d-4f3d-910b-a6db487c9539",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 23: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "ad6ee971-64c4-4b58-97c9-b6e96fab4bb4",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 24: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "8b56cded-03e9-4bc1-b079-012935cf8df8",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 25: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "9b9277cd-5fc4-44be-86fb-7f3802859bad",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 26: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "f5acbd9c-9203-4886-b2cb-7fbf7d76b042",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 27: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "cd131b38-3d71-4d02-9b32-38c9bc9dc418",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 28: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "860e7532-22ad-4fca-9262-20992871a2e3",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 29: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "66eb3f43-adcc-468a-bd78-70fd75d32120",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 30: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "92e2faff-a6d0-46d3-a444-730ac318d38f",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 31: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "0628dbe8-0ae8-4897-877b-3449b2e9773b",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 32: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "02bd61ab-d6fa-4e57-a9ab-72e42b8a27dc",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 33: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "b96f49dd-320b-4067-8d5a-e75bf554946a",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 34: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "8eb5485f-5c05-4fd0-8463-85f2800934ed",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 35: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "2bc5c061-91e1-4be2-b645-17a363cced93",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 36: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "91bd1541-4767-4fd6-8e26-d91603614dba",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 37: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "fd998f55-74c1-487b-84b1-640eddddbe24",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 38: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "99556228-a21c-4900-b15f-31e0745299df",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 39: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "7424e5dc-9cfb-45c9-9396-488abadcd761",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 40: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "1280d84f-cf0a-4451-93fc-5e8bc0384086",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 41: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "73380793-1ea5-4aa0-ae17-b74c0f98683d",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 42: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "e8a04dbc-f254-4b83-9190-96be9cda10d5",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 43: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "08657678-bb64-42fc-b120-efff2a6576d4",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 44: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "6202b7fa-bcb1-4be6-bcfc-c860514c7959",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 45: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "7ec7da5d-71b0-4108-abdb-cdbef7536b2e",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 46: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "654211c4-7a00-4c10-87e2-22202220b94a",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 47: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "3d0a2d0b-dcbf-429e-b455-c9bf66423060",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 48: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "69a35eb1-af6c-4eb8-b933-d9f76aa16212",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 49: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "5f8c8186-91c1-41d6-a8f7-80a331a9f511",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 50: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "8844ef14-6f37-468d-b94a-768d12390e60",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 51: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "ee749b46-eb70-4c38-a4d2-8f5a394e7ae3",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 52: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "7143f137-5811-4d8a-b4b4-94ebd3e58894",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 53: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "55e62dc4-fd97-45cd-be41-551135ba8478",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 54: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "d2467b07-566d-4b17-975a-ca24cb9bc14c",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 55: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "b6556e56-bbad-40fc-a766-3c0e7c736bc7",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 56: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "3b9038a8-a681-44d1-bb60-e64c71dd93bd",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 57: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "5988558a-17b0-49e8-803b-53ce4bb32736",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 58: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "e38d3a67-14f5-4ebf-8b44-ef5e39fbf9f0",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 59: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "d5836ab1-61ef-4053-a363-f944c70e6022",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 60: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "2d938e2b-e1c9-410d-84d5-566e54c2bf9b",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 61: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "046ff506-83da-424a-b463-e50c6dcca5fd",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 62: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "f579af48-07d8-40de-9dcf-297437937817",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 63: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "d4804253-67cc-410e-b012-0acbfe2d986a",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 64: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "133d5b40-f118-4590-b24b-47175d2a6d0d",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 65: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "b38cd70c-9e7b-4695-a92d-da3d4c914a65",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 66: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "68673428-d2ff-4fb1-873f-694cedd26878",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 67: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "dc561cc6-9e31-4fb4-b95c-831a59398d75",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 68: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "afc3c582-23e1-4452-a460-0ba4bfb292ea",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 69: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "b8498e05-6cb8-4614-9133-52bfb9960d69",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 70: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "ca52d500-21bb-485a-893b-b9a0425b46d3",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 71: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "7212f0ca-fb00-45bf-bf0a-dc2a53fb1060",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 72: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "9a4b87c6-9f43-41a2-b896-37382fca71a1",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 73: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "5ef98709-39e7-4ea2-8053-7c8fe3778bd3",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 74: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "5969330f-b905-4d86-9f8b-47317a63fc74",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 75: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "1168665e-08be-4342-8aa3-f8b1ca9a9bbf",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 76: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "56af2a23-a394-4031-868e-1205200107fb",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 77: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "1e402aa4-610f-41d2-b144-cb8649a95669",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 78: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "bc3362ae-b66b-47e1-b792-2fc3a888be04",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 79: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "8deb60ec-349d-473c-9d3a-bede272b6d20",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 80: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "a4f6fc16-0c25-4a98-a4e5-3b4c42ca3a0b",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 81: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "fee4bca1-d526-400a-a3a0-b3ea0c952cef",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 82: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "de1e61d8-4983-4cae-bcd9-8e4fa51a9f8d",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 83: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "9125f6af-e25b-4f57-b099-25155362b73d",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 84: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "693392c1-742e-4f54-8871-5adf1431c3a0",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 85: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "95fff26f-e432-4e54-8bdb-82bf0e4b3f54",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 86: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "0e926423-e912-4c54-b10f-9ecc42ab9247",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 87: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "692748d4-9796-4b9f-a3b2-cc311cade4d8",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 88: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "3de170c3-3502-488b-9afa-a76faf6d10fa",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 89: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "39d86921-53bd-49e0-8632-611bd766177b",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 90: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "9c7abdf2-a57f-461b-8a74-69561ea841c2",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 91: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "fa07dfa3-c678-4046-b2b6-b404304dc37c",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 92: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "db5c9105-aa43-452c-b315-a678f69eabb1",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 93: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "aa51057f-7ab5-4562-9fcb-f12946e94b72",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 94: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "4a8239a1-f102-4d11-9f2b-72de3bbb27b3",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 95: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "cdc891cf-4221-4a89-8320-a123e8a7da2f",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 96: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "2769c8bc-a5e7-4e19-8c65-d9b5481cf224",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 97: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "9f07d287-ba2c-4ad0-acd0-381fa5304e28",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 98: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "ca2689da-6c2f-4a63-b55a-91b6a4e88614",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 99: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    },
    {
      "id": "59d8a6fd-0171-441b-9ad6-d6a301410e20",
      "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
      "question": "Quick question 100: Which team?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 10
    }
  ],
  "5bd54170-2e8f-402c-a4da-bf1d09098027": [
    {
      "id": "5532b838-727c-4ac8-bc6f-3c4f8ceb1353",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am German, I am the youngest player to score in World Cup for Germany, and I play for Bayern Munich. Who am I? (Clue 100)",
      "options": [
        "Jamal Musiala",
        "Florian Wirtz",
        "Kai Havertz",
        "Leroy Sané"
      ],
      "difficulty": "HARD",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/357.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5bb8aafe-8a8b-4732-86d1-7324557686c6",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Spanish, I am 20 years old, and I play for Barcelona. Who am I? (Clue 99)",
      "options": [
        "Pedri",
        "Gavi",
        "Ansu Fati",
        "Ferran Torres"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/599.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b0407c0f-c7f0-4395-9982-0deea28b922f",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am Arsenal's star winger, and I won Young Player of the Year. Who am I? (Clue 98)",
      "options": [
        "Bukayo Saka",
        "Emile Smith Rowe",
        "Gabriel Martinelli",
        "Aaron Ramsdale"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/261.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "53345310-9feb-42ea-8cc2-9524f1db45a3",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Brazilian, I scored the winning goal in Champions League 2022 final, and I play for Real Madrid. Who am I? (Clue 97)",
      "options": [
        "Vinícius Júnior",
        "Rodrygo",
        "Neymar",
        "Gabriel Jesus"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/354.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5377d76d-f1b9-4f19-8d54-703aec9c1f50",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am 20 years old, and I play for Real Madrid. Who am I? (Clue 96)",
      "options": [
        "Jude Bellingham",
        "Phil Foden",
        "Bukayo Saka",
        "Declan Rice"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/353.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0c9925d3-cad1-419c-9461-e3e84b30deb0",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am South Korean, I won Premier League Golden Boot, and I play for Tottenham. Who am I? (Clue 95)",
      "options": [
        "Son Heung-min",
        "Park Ji-sung",
        "Lee Kang-in",
        "Kim Min-jae"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/258.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5be60361-f166-4c4d-9093-5c9b57025e4c",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Argentine, I won World Cup 2022, and I play for Inter Milan. Who am I? (Clue 94)",
      "options": [
        "Lautaro Martínez",
        "Paulo Dybala",
        "Giovani Lo Celso",
        "Leandro Paredes"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/594.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6045cf52-7e8f-4138-8bb7-eea51a934746",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am the all-time top scorer for Tottenham, and I am the England captain. Who am I? (Clue 93)",
      "options": [
        "Harry Kane",
        "Raheem Sterling",
        "Marcus Rashford",
        "Jadon Sancho"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/256.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "14069c88-8ca2-4249-b7d6-7a0f6f609ec9",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Senegalese, I won Champions League with Liverpool, and I now play for Bayern Munich. Who am I? (Clue 92)",
      "options": [
        "Sadio Mané",
        "Mohamed Salah",
        "Edouard Mendy",
        "Kalidou Koulibaly"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/349.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "bfc97e84-3b57-49f8-91c2-e02caabd4e04",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Brazilian, I am the most expensive player ever, and I play for PSG. Who am I? (Clue 91)",
      "options": [
        "Neymar",
        "Casemiro",
        "Vinícius Júnior",
        "Antony"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/346.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7a693624-01ad-4030-9edc-8aeb392a11d4",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Dutch, I am considered the best defender in the world, and I play for Liverpool. Who am I? (Clue 90)",
      "options": [
        "Virgil van Dijk",
        "Matthijs de Ligt",
        "Frenkie de Jong",
        "Memphis Depay"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/1440.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "31bfe57c-bdff-445d-bd2c-535832e84ca6",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Croatian, I won Ballon d'Or 2018, and I play for Real Madrid. Who am I? (Clue 89)",
      "options": [
        "Luka Modrić",
        "Ivan Rakitić",
        "Mateo Kovačić",
        "Mario Mandžukić"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/323.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f1bd8577-4be6-40ea-a7cd-36d145a713c6",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Belgian, I am the best playmaker in Premier League, and I play for Manchester City. Who am I? (Clue 88)",
      "options": [
        "Kevin De Bruyne",
        "Eden Hazard",
        "Romelu Lukaku",
        "Thibaut Courtois"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/313.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d0601898-0edf-4adc-a0d0-19fc6c064bb0",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Polish, I scored 41 goals in a Bundesliga season, and I play for Barcelona. Who am I? (Clue 87)",
      "options": [
        "Robert Lewandowski",
        "Wojciech Szczęsny",
        "Arkadiusz Milik",
        "Krzysztof Piątek"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/587.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5849dcad-d1a5-4ad7-b37e-8b2864207258",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am French, I won Ballon d'Or 2022, and I play for Real Madrid. Who am I? (Clue 86)",
      "options": [
        "Karim Benzema",
        "Kylian Mbappé",
        "Antoine Griezmann",
        "Olivier Giroud"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/343.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "70cf389f-7341-41b7-9c9d-d21aa8933318",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Norwegian, I scored 36 goals in Premier League in my first season, and I play for Manchester City. Who am I? (Clue 85)",
      "options": [
        "Erling Haaland",
        "Martin Ødegaard",
        "Mohamed Salah",
        "Harry Kane"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/110126.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7106de57-36ed-4d8c-b333-bde3cc66b8a6",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am French, I won the 2018 World Cup, and I am the youngest player to score in a World Cup final. Who am I? (Clue 84)",
      "options": [
        "Kylian Mbappé",
        "Antoine Griezmann",
        "Paul Pogba",
        "N'Golo Kanté"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/341.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "639a1b96-12c0-4b5a-8f04-11e74fd8b14f",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Argentine, I won 7 Ballon d'Or awards, and I play for PSG. Who am I? (Clue 83)",
      "options": [
        "Lionel Messi",
        "Diego Maradona",
        "Ángel Di María",
        "Sergio Agüero"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/216.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2cb7574a-1e87-4c8a-972b-4fa11bf5ae07",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Portuguese, I won 5 Champions League titles, and I am the all-time top scorer. Who am I? (Clue 82)",
      "options": [
        "Cristiano Ronaldo",
        "Luis Figo",
        "Pepe",
        "Bruno Fernandes"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/337.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "19b842ce-d17b-42b6-bbdc-a71645c05eae",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Egyptian, I play for Liverpool, and I won the Premier League Golden Boot. Who am I? (Clue 81)",
      "options": [
        "Mohamed Salah",
        "Mohamed Elneny",
        "Mahmoud Trezeguet",
        "Ahmed Hegazi"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/336.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2cfd3b05-7d2d-4fdf-bcb5-a0bf68b59c0e",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am German, I am the youngest player to score in World Cup for Germany, and I play for Bayern Munich. Who am I? (Clue 80)",
      "options": [
        "Jamal Musiala",
        "Florian Wirtz",
        "Kai Havertz",
        "Leroy Sané"
      ],
      "difficulty": "HARD",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/337.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "05827fc3-84ac-479e-a6ee-455071ac95f0",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Spanish, I am 20 years old, and I play for Barcelona. Who am I? (Clue 79)",
      "options": [
        "Pedri",
        "Gavi",
        "Ansu Fati",
        "Ferran Torres"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/579.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1548b258-da5a-47ad-9d8a-af731405bf38",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am Arsenal's star winger, and I won Young Player of the Year. Who am I? (Clue 78)",
      "options": [
        "Bukayo Saka",
        "Emile Smith Rowe",
        "Gabriel Martinelli",
        "Aaron Ramsdale"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/241.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3b80e11f-c755-40e7-ac9f-77a7a8b452ae",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Brazilian, I scored the winning goal in Champions League 2022 final, and I play for Real Madrid. Who am I? (Clue 77)",
      "options": [
        "Vinícius Júnior",
        "Rodrygo",
        "Neymar",
        "Gabriel Jesus"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/334.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e2cebafa-2644-46bd-a180-81b062278b0c",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am 20 years old, and I play for Real Madrid. Who am I? (Clue 76)",
      "options": [
        "Jude Bellingham",
        "Phil Foden",
        "Bukayo Saka",
        "Declan Rice"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/333.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "307ed655-9a68-4a9c-9198-fd4cc2b7392e",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am South Korean, I won Premier League Golden Boot, and I play for Tottenham. Who am I? (Clue 75)",
      "options": [
        "Son Heung-min",
        "Park Ji-sung",
        "Lee Kang-in",
        "Kim Min-jae"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/238.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "178a564c-db6f-43bf-a588-b429a7b72a8b",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Argentine, I won World Cup 2022, and I play for Inter Milan. Who am I? (Clue 74)",
      "options": [
        "Lautaro Martínez",
        "Paulo Dybala",
        "Giovani Lo Celso",
        "Leandro Paredes"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/574.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "aec6b271-79b3-43db-8433-2551369ffa9c",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am the all-time top scorer for Tottenham, and I am the England captain. Who am I? (Clue 73)",
      "options": [
        "Harry Kane",
        "Raheem Sterling",
        "Marcus Rashford",
        "Jadon Sancho"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/236.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "4605347b-1eea-4d13-89dd-f49af3f2f05d",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Senegalese, I won Champions League with Liverpool, and I now play for Bayern Munich. Who am I? (Clue 72)",
      "options": [
        "Sadio Mané",
        "Mohamed Salah",
        "Edouard Mendy",
        "Kalidou Koulibaly"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/329.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6abe46f6-eb65-48d8-a30b-b059b0a4972d",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Brazilian, I am the most expensive player ever, and I play for PSG. Who am I? (Clue 71)",
      "options": [
        "Neymar",
        "Casemiro",
        "Vinícius Júnior",
        "Antony"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/326.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b2fef8ab-14c9-4303-b7aa-3d72059df24f",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Dutch, I am considered the best defender in the world, and I play for Liverpool. Who am I? (Clue 70)",
      "options": [
        "Virgil van Dijk",
        "Matthijs de Ligt",
        "Frenkie de Jong",
        "Memphis Depay"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/1420.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b03ff081-ffe4-4950-aa67-a55db5a9bfac",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Croatian, I won Ballon d'Or 2018, and I play for Real Madrid. Who am I? (Clue 69)",
      "options": [
        "Luka Modrić",
        "Ivan Rakitić",
        "Mateo Kovačić",
        "Mario Mandžukić"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/303.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ff29f798-d738-43d1-8e7b-52e6ccce3a45",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Belgian, I am the best playmaker in Premier League, and I play for Manchester City. Who am I? (Clue 68)",
      "options": [
        "Kevin De Bruyne",
        "Eden Hazard",
        "Romelu Lukaku",
        "Thibaut Courtois"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/293.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5fdf9075-dcd5-4a2e-9ea6-4301fe737e61",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Polish, I scored 41 goals in a Bundesliga season, and I play for Barcelona. Who am I? (Clue 67)",
      "options": [
        "Robert Lewandowski",
        "Wojciech Szczęsny",
        "Arkadiusz Milik",
        "Krzysztof Piątek"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/567.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f8f91e7b-168c-41e0-b6fc-51c656d3a3d0",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am French, I won Ballon d'Or 2022, and I play for Real Madrid. Who am I? (Clue 66)",
      "options": [
        "Karim Benzema",
        "Kylian Mbappé",
        "Antoine Griezmann",
        "Olivier Giroud"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/323.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "dd4aebaf-c4ff-4073-9b95-7c12a82aa6e8",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Norwegian, I scored 36 goals in Premier League in my first season, and I play for Manchester City. Who am I? (Clue 65)",
      "options": [
        "Erling Haaland",
        "Martin Ødegaard",
        "Mohamed Salah",
        "Harry Kane"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/110106.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "426e4a7f-4eef-4d4a-a396-210ae4a09f6a",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am French, I won the 2018 World Cup, and I am the youngest player to score in a World Cup final. Who am I? (Clue 64)",
      "options": [
        "Kylian Mbappé",
        "Antoine Griezmann",
        "Paul Pogba",
        "N'Golo Kanté"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/321.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d5d336e2-32b3-4635-8854-621cdd646b54",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Argentine, I won 7 Ballon d'Or awards, and I play for PSG. Who am I? (Clue 63)",
      "options": [
        "Lionel Messi",
        "Diego Maradona",
        "Ángel Di María",
        "Sergio Agüero"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/196.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ee6e87b7-7ae6-4a74-b22d-0eaa13e17923",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Portuguese, I won 5 Champions League titles, and I am the all-time top scorer. Who am I? (Clue 62)",
      "options": [
        "Cristiano Ronaldo",
        "Luis Figo",
        "Pepe",
        "Bruno Fernandes"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/317.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0c63ed0a-197c-4d85-abde-ce18f3523ebc",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Egyptian, I play for Liverpool, and I won the Premier League Golden Boot. Who am I? (Clue 61)",
      "options": [
        "Mohamed Salah",
        "Mohamed Elneny",
        "Mahmoud Trezeguet",
        "Ahmed Hegazi"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/316.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "131ee251-a31b-4dc7-a04a-7fd3eb6433ef",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am German, I am the youngest player to score in World Cup for Germany, and I play for Bayern Munich. Who am I? (Clue 60)",
      "options": [
        "Jamal Musiala",
        "Florian Wirtz",
        "Kai Havertz",
        "Leroy Sané"
      ],
      "difficulty": "HARD",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/317.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1d505988-9155-4e00-8bea-30ab112444db",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Spanish, I am 20 years old, and I play for Barcelona. Who am I? (Clue 59)",
      "options": [
        "Pedri",
        "Gavi",
        "Ansu Fati",
        "Ferran Torres"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/559.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ee132381-9531-4348-ab1a-dec3ad495ea3",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am Arsenal's star winger, and I won Young Player of the Year. Who am I? (Clue 58)",
      "options": [
        "Bukayo Saka",
        "Emile Smith Rowe",
        "Gabriel Martinelli",
        "Aaron Ramsdale"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/221.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3134ed2a-1837-49c2-8c32-156f1937ecbe",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Brazilian, I scored the winning goal in Champions League 2022 final, and I play for Real Madrid. Who am I? (Clue 57)",
      "options": [
        "Vinícius Júnior",
        "Rodrygo",
        "Neymar",
        "Gabriel Jesus"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/314.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7cbcc246-5ae4-4556-b7e4-031cd25330b1",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am 20 years old, and I play for Real Madrid. Who am I? (Clue 56)",
      "options": [
        "Jude Bellingham",
        "Phil Foden",
        "Bukayo Saka",
        "Declan Rice"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/313.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "497cbce0-bcdc-49c0-8b30-f7637e2fbaeb",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am South Korean, I won Premier League Golden Boot, and I play for Tottenham. Who am I? (Clue 55)",
      "options": [
        "Son Heung-min",
        "Park Ji-sung",
        "Lee Kang-in",
        "Kim Min-jae"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/218.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "9e09aaa1-cbf6-4d76-b6f3-e524d44a338c",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Argentine, I won World Cup 2022, and I play for Inter Milan. Who am I? (Clue 54)",
      "options": [
        "Lautaro Martínez",
        "Paulo Dybala",
        "Giovani Lo Celso",
        "Leandro Paredes"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/554.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "cec1b449-defb-4218-87ce-494ac92729cf",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am the all-time top scorer for Tottenham, and I am the England captain. Who am I? (Clue 53)",
      "options": [
        "Harry Kane",
        "Raheem Sterling",
        "Marcus Rashford",
        "Jadon Sancho"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/216.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c6bf675e-e0e1-4e4c-8f1a-5a98aae7c2cc",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Senegalese, I won Champions League with Liverpool, and I now play for Bayern Munich. Who am I? (Clue 52)",
      "options": [
        "Sadio Mané",
        "Mohamed Salah",
        "Edouard Mendy",
        "Kalidou Koulibaly"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/309.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f106d3df-5307-4ee1-8a77-14436f589348",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Brazilian, I am the most expensive player ever, and I play for PSG. Who am I? (Clue 51)",
      "options": [
        "Neymar",
        "Casemiro",
        "Vinícius Júnior",
        "Antony"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/306.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "acbe35b5-ec82-43a2-a9f0-edee4fc7cb73",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Dutch, I am considered the best defender in the world, and I play for Liverpool. Who am I? (Clue 50)",
      "options": [
        "Virgil van Dijk",
        "Matthijs de Ligt",
        "Frenkie de Jong",
        "Memphis Depay"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/1400.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "47bf758e-8bc0-4c49-a75e-6527d5caa341",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Croatian, I won Ballon d'Or 2018, and I play for Real Madrid. Who am I? (Clue 49)",
      "options": [
        "Luka Modrić",
        "Ivan Rakitić",
        "Mateo Kovačić",
        "Mario Mandžukić"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/283.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b4d9db8a-1d01-449f-bf53-baffe32991bc",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Belgian, I am the best playmaker in Premier League, and I play for Manchester City. Who am I? (Clue 48)",
      "options": [
        "Kevin De Bruyne",
        "Eden Hazard",
        "Romelu Lukaku",
        "Thibaut Courtois"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/273.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8129c96d-16b5-4a26-bde9-04dd6f3ce526",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Polish, I scored 41 goals in a Bundesliga season, and I play for Barcelona. Who am I? (Clue 47)",
      "options": [
        "Robert Lewandowski",
        "Wojciech Szczęsny",
        "Arkadiusz Milik",
        "Krzysztof Piątek"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/547.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1b06403e-d60b-4a2e-886b-8f8900af164a",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am French, I won Ballon d'Or 2022, and I play for Real Madrid. Who am I? (Clue 46)",
      "options": [
        "Karim Benzema",
        "Kylian Mbappé",
        "Antoine Griezmann",
        "Olivier Giroud"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/303.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "23e1c305-51e6-4fdc-a068-1a83ac93c9ef",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Norwegian, I scored 36 goals in Premier League in my first season, and I play for Manchester City. Who am I? (Clue 45)",
      "options": [
        "Erling Haaland",
        "Martin Ødegaard",
        "Mohamed Salah",
        "Harry Kane"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/110086.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0e6fc20a-da7d-448c-aac8-ba2db4360794",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am French, I won the 2018 World Cup, and I am the youngest player to score in a World Cup final. Who am I? (Clue 44)",
      "options": [
        "Kylian Mbappé",
        "Antoine Griezmann",
        "Paul Pogba",
        "N'Golo Kanté"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/301.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2d583853-6447-4c54-999a-47d1983c8427",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Argentine, I won 7 Ballon d'Or awards, and I play for PSG. Who am I? (Clue 43)",
      "options": [
        "Lionel Messi",
        "Diego Maradona",
        "Ángel Di María",
        "Sergio Agüero"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/176.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ee6b8114-1c65-45aa-81a3-4b49a0c2ffd6",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Portuguese, I won 5 Champions League titles, and I am the all-time top scorer. Who am I? (Clue 42)",
      "options": [
        "Cristiano Ronaldo",
        "Luis Figo",
        "Pepe",
        "Bruno Fernandes"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/297.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "becd08ae-b4ab-4b51-a6bb-167202e11151",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Egyptian, I play for Liverpool, and I won the Premier League Golden Boot. Who am I? (Clue 41)",
      "options": [
        "Mohamed Salah",
        "Mohamed Elneny",
        "Mahmoud Trezeguet",
        "Ahmed Hegazi"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/296.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "9d5a6d2b-2ae7-4381-a47b-539ad83eeed5",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am German, I am the youngest player to score in World Cup for Germany, and I play for Bayern Munich. Who am I? (Clue 40)",
      "options": [
        "Jamal Musiala",
        "Florian Wirtz",
        "Kai Havertz",
        "Leroy Sané"
      ],
      "difficulty": "HARD",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/297.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2f3098ff-60cf-4df9-8d84-71726fe09c68",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Spanish, I am 20 years old, and I play for Barcelona. Who am I? (Clue 39)",
      "options": [
        "Pedri",
        "Gavi",
        "Ansu Fati",
        "Ferran Torres"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/539.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "612c721f-9b5a-45fa-aadd-faaafd0aa81c",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am Arsenal's star winger, and I won Young Player of the Year. Who am I? (Clue 38)",
      "options": [
        "Bukayo Saka",
        "Emile Smith Rowe",
        "Gabriel Martinelli",
        "Aaron Ramsdale"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/201.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1b858c85-ef47-4e11-9880-3b4970e00db9",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Brazilian, I scored the winning goal in Champions League 2022 final, and I play for Real Madrid. Who am I? (Clue 37)",
      "options": [
        "Vinícius Júnior",
        "Rodrygo",
        "Neymar",
        "Gabriel Jesus"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/294.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0579fe99-caf8-4b1d-8a61-6ee7f6fb1ab8",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am 20 years old, and I play for Real Madrid. Who am I? (Clue 36)",
      "options": [
        "Jude Bellingham",
        "Phil Foden",
        "Bukayo Saka",
        "Declan Rice"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/293.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c475986f-5aac-4055-af61-6d9b7b9a894f",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am South Korean, I won Premier League Golden Boot, and I play for Tottenham. Who am I? (Clue 35)",
      "options": [
        "Son Heung-min",
        "Park Ji-sung",
        "Lee Kang-in",
        "Kim Min-jae"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/198.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "fc747d2b-bd83-4053-84b9-cd24417369d0",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Argentine, I won World Cup 2022, and I play for Inter Milan. Who am I? (Clue 34)",
      "options": [
        "Lautaro Martínez",
        "Paulo Dybala",
        "Giovani Lo Celso",
        "Leandro Paredes"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/534.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b19a4c42-a481-4ecd-8120-eb885cc9a393",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am the all-time top scorer for Tottenham, and I am the England captain. Who am I? (Clue 33)",
      "options": [
        "Harry Kane",
        "Raheem Sterling",
        "Marcus Rashford",
        "Jadon Sancho"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/196.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ac66e4ae-7b81-4d94-b424-ceeb709e04b0",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Senegalese, I won Champions League with Liverpool, and I now play for Bayern Munich. Who am I? (Clue 32)",
      "options": [
        "Sadio Mané",
        "Mohamed Salah",
        "Edouard Mendy",
        "Kalidou Koulibaly"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/289.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1e18eb87-65b4-4853-8186-c9cff74dc093",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Brazilian, I am the most expensive player ever, and I play for PSG. Who am I? (Clue 31)",
      "options": [
        "Neymar",
        "Casemiro",
        "Vinícius Júnior",
        "Antony"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/286.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e3d0c326-132a-4bf5-b5eb-e12aac705015",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Dutch, I am considered the best defender in the world, and I play for Liverpool. Who am I? (Clue 30)",
      "options": [
        "Virgil van Dijk",
        "Matthijs de Ligt",
        "Frenkie de Jong",
        "Memphis Depay"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/1380.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f977ef75-08ac-49d9-b560-963bdd37cc24",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Croatian, I won Ballon d'Or 2018, and I play for Real Madrid. Who am I? (Clue 29)",
      "options": [
        "Luka Modrić",
        "Ivan Rakitić",
        "Mateo Kovačić",
        "Mario Mandžukić"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/263.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "156b0b84-e6b7-4a75-afb9-6c747df2f9ff",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Belgian, I am the best playmaker in Premier League, and I play for Manchester City. Who am I? (Clue 28)",
      "options": [
        "Kevin De Bruyne",
        "Eden Hazard",
        "Romelu Lukaku",
        "Thibaut Courtois"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/253.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a9ef9531-4663-48e6-b13f-c4be7cc764a6",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Polish, I scored 41 goals in a Bundesliga season, and I play for Barcelona. Who am I? (Clue 27)",
      "options": [
        "Robert Lewandowski",
        "Wojciech Szczęsny",
        "Arkadiusz Milik",
        "Krzysztof Piątek"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/527.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "cc8068f2-cf93-4850-b2d6-f0b38aa178e7",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am French, I won Ballon d'Or 2022, and I play for Real Madrid. Who am I? (Clue 26)",
      "options": [
        "Karim Benzema",
        "Kylian Mbappé",
        "Antoine Griezmann",
        "Olivier Giroud"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/283.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "331b91eb-a295-4db7-90d9-fefc544b36ae",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Norwegian, I scored 36 goals in Premier League in my first season, and I play for Manchester City. Who am I? (Clue 25)",
      "options": [
        "Erling Haaland",
        "Martin Ødegaard",
        "Mohamed Salah",
        "Harry Kane"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/110066.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1b289238-687f-4c75-b0bc-e9fc25e658ac",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am French, I won the 2018 World Cup, and I am the youngest player to score in a World Cup final. Who am I? (Clue 24)",
      "options": [
        "Kylian Mbappé",
        "Antoine Griezmann",
        "Paul Pogba",
        "N'Golo Kanté"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/281.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "49ae85c8-9982-4bde-a123-493e247549f3",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Argentine, I won 7 Ballon d'Or awards, and I play for PSG. Who am I? (Clue 23)",
      "options": [
        "Lionel Messi",
        "Diego Maradona",
        "Ángel Di María",
        "Sergio Agüero"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/156.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c224807e-e31d-4ad6-a331-0ec426981d3e",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Portuguese, I won 5 Champions League titles, and I am the all-time top scorer. Who am I? (Clue 22)",
      "options": [
        "Cristiano Ronaldo",
        "Luis Figo",
        "Pepe",
        "Bruno Fernandes"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/277.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a6152c08-ac79-4250-bb35-e564b81218fd",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Egyptian, I play for Liverpool, and I won the Premier League Golden Boot. Who am I? (Clue 21)",
      "options": [
        "Mohamed Salah",
        "Mohamed Elneny",
        "Mahmoud Trezeguet",
        "Ahmed Hegazi"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/276.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "87bdcd64-262a-43f7-b5e9-5947dabc2707",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am German, I am the youngest player to score in World Cup for Germany, and I play for Bayern Munich. Who am I?",
      "options": [
        "Jamal Musiala",
        "Florian Wirtz",
        "Kai Havertz",
        "Leroy Sané"
      ],
      "difficulty": "HARD",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/278.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2286629e-1299-4f04-9320-15862f585b37",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Spanish, I am 20 years old, and I play for Barcelona. Who am I?",
      "options": [
        "Pedri",
        "Gavi",
        "Ansu Fati",
        "Ferran Torres"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/521.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "973985d5-d8f9-4ceb-aa07-4edf9d5ccd3f",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am Arsenal's star winger, and I won Young Player of the Year. Who am I?",
      "options": [
        "Bukayo Saka",
        "Emile Smith Rowe",
        "Gabriel Martinelli",
        "Aaron Ramsdale"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/184.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "4f516b5b-e2d1-46a3-a4f3-9bea7f4a6cca",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Brazilian, I scored the winning goal in Champions League 2022 final, and I play for Real Madrid. Who am I?",
      "options": [
        "Vinícius Júnior",
        "Rodrygo",
        "Neymar",
        "Gabriel Jesus"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/278.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "779f4d92-cca0-4bfb-9b43-9fedecfa5969",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am 20 years old, and I play for Real Madrid. Who am I?",
      "options": [
        "Jude Bellingham",
        "Phil Foden",
        "Bukayo Saka",
        "Declan Rice"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/278.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "231ed3fb-ccc8-4778-a23e-1e13e2b7b904",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am South Korean, I won Premier League Golden Boot, and I play for Tottenham. Who am I?",
      "options": [
        "Son Heung-min",
        "Park Ji-sung",
        "Lee Kang-in",
        "Kim Min-jae"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/184.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7d621511-78b0-42ff-ae71-8c97ed38a74a",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Argentine, I won World Cup 2022, and I play for Inter Milan. Who am I?",
      "options": [
        "Lautaro Martínez",
        "Paulo Dybala",
        "Giovani Lo Celso",
        "Leandro Paredes"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/521.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5c063fb4-7752-46c5-b705-db4ecc170288",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am English, I am the all-time top scorer for Tottenham, and I am the England captain. Who am I?",
      "options": [
        "Harry Kane",
        "Raheem Sterling",
        "Marcus Rashford",
        "Jadon Sancho"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/184.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "842a2e74-c5b9-48b3-bc4c-5d1548950769",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Senegalese, I won Champions League with Liverpool, and I now play for Bayern Munich. Who am I?",
      "options": [
        "Sadio Mané",
        "Mohamed Salah",
        "Edouard Mendy",
        "Kalidou Koulibaly"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/278.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "31b31e76-eaae-47de-8ffa-034d219a683b",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Brazilian, I am the most expensive player ever, and I play for PSG. Who am I?",
      "options": [
        "Neymar",
        "Casemiro",
        "Vinícius Júnior",
        "Antony"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/276.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ec2c37c2-f26e-4b68-b506-2ec6ef72cc77",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Dutch, I am considered the best defender in the world, and I play for Liverpool. Who am I?",
      "options": [
        "Virgil van Dijk",
        "Matthijs de Ligt",
        "Frenkie de Jong",
        "Memphis Depay"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/1371.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d0b2623e-d35f-4c97-91df-19c8f03d62a9",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Croatian, I won Ballon d'Or 2018, and I play for Real Madrid. Who am I?",
      "options": [
        "Luka Modrić",
        "Ivan Rakitić",
        "Mateo Kovačić",
        "Mario Mandžukić"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/255.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "30ca2b8e-7083-4897-9446-befba2bf7053",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Belgian, I am the best playmaker in Premier League, and I play for Manchester City. Who am I?",
      "options": [
        "Kevin De Bruyne",
        "Eden Hazard",
        "Romelu Lukaku",
        "Thibaut Courtois"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/246.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8150c32a-e374-47f4-bb88-8b4cb5751af6",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Polish, I scored 41 goals in a Bundesliga season, and I play for Barcelona. Who am I?",
      "options": [
        "Robert Lewandowski",
        "Wojciech Szczęsny",
        "Arkadiusz Milik",
        "Krzysztof Piątek"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/521.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e57d92cf-dfb7-4e58-93c8-c52364a851fb",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am French, I won Ballon d'Or 2022, and I play for Real Madrid. Who am I?",
      "options": [
        "Karim Benzema",
        "Kylian Mbappé",
        "Antoine Griezmann",
        "Olivier Giroud"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/278.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "923b4e91-e2fa-417e-ab49-3e317b279349",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Norwegian, I scored 36 goals in Premier League in my first season, and I play for Manchester City. Who am I?",
      "options": [
        "Erling Haaland",
        "Martin Ødegaard",
        "Mohamed Salah",
        "Harry Kane"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/110062.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a6e46fe3-3f00-4afd-a5d2-8f932b8b964b",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am French, I won the 2018 World Cup, and I am the youngest player to score in a World Cup final. Who am I?",
      "options": [
        "Kylian Mbappé",
        "Antoine Griezmann",
        "Paul Pogba",
        "N'Golo Kanté"
      ],
      "difficulty": "MEDIUM",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/278.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "01b47606-ee39-433f-9b06-4d56db526dc8",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Argentine, I won 7 Ballon d'Or awards, and I play for PSG. Who am I?",
      "options": [
        "Lionel Messi",
        "Diego Maradona",
        "Ángel Di María",
        "Sergio Agüero"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/154.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6a79b6c8-2ef6-4751-99d5-69d38b9c809e",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Portuguese, I won 5 Champions League titles, and I am the all-time top scorer. Who am I?",
      "options": [
        "Cristiano Ronaldo",
        "Luis Figo",
        "Pepe",
        "Bruno Fernandes"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/276.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d2f548d7-0da6-4538-b178-a85f35bf93b6",
      "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
      "question": "I am Egyptian, I play for Liverpool, and I won the Premier League Golden Boot. Who am I?",
      "options": [
        "Mohamed Salah",
        "Mohamed Elneny",
        "Mahmoud Trezeguet",
        "Ahmed Hegazi"
      ],
      "difficulty": "EASY",
      "points": 15,
      "imageUrl": "https://media.api-sports.io/football/players/276.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    }
  ],
  "623f7528-7cb8-44a1-891c-a970e62a8b8b": [
    {
      "id": "f6f99e65-a393-4a7a-979e-722705f8f856",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "How many World Cups has Brazil won?",
      "options": [
        "3",
        "4",
        "5",
        "6"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "bd7447a3-5373-43fd-8077-681bdfe70459",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "How many goals did Pelé score in his career?",
      "options": [
        "Over 1000",
        "Over 800",
        "Over 600",
        "Over 400"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "029be08d-70e5-4827-96bb-3867cb6082e1",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 99: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "19b0b582-83d0-4d8f-b4d4-f35ecb813514",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 98: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "55267657-2f63-4b09-a930-dce9170a1709",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 97: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "fdf0cce0-a57e-4c87-b0a9-1c1770749386",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 96: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "738b19ec-5e87-4162-9567-b09565a9d8a2",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 95: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "920e9faa-8365-4386-89c8-637c79adaeb1",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 94: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "35252dee-b821-4212-bee0-e0793588429e",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 93: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5892f2c0-28a2-4d53-87a9-440899254c28",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 92: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0e3c04f8-0cfd-4e67-bf06-8b83d4b17fc7",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 91: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "52cf9b9b-ff7b-4f1f-bf40-08d28b94aa36",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 90: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8358958f-dabe-459d-854d-2e16ab87dc4f",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 89: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1af3a0ed-fbf3-48ea-855d-6690a91099d0",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 88: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "41566761-788d-445c-a901-e55eab6a3c80",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 87: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e483c5d7-b45d-422a-a4ae-8a6934380a68",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 86: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "11aa85b1-6c87-45ec-b8fa-d40ecd68208f",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 85: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7446ad73-09eb-4004-981c-f8f988844496",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 84: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "349407f1-de4a-499d-9086-76c63ed28789",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 83: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e027854b-97a3-48bf-a111-35762071909b",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 82: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ca239141-ff42-4eee-8106-4cc59195e98a",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 81: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6e586299-99e5-4ff1-a019-3223ac9a210d",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 80: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "98941e40-9bdf-4815-b521-f65d8965aa81",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 79: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f08ef829-8cda-4927-a87c-8cecddf6b4b7",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 78: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "523e394c-706d-4541-ad5d-47954d951123",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 77: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3778570a-a72a-47e9-8d7b-3a5dd913f353",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 76: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c7b7936c-7eca-4625-b3cf-08725846ce45",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 75: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "db300fe1-9e65-434c-81cb-161505ec3209",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 74: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "36e761c2-a2ef-471e-9b0a-58084b9dbeb5",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 73: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "279b38d0-f348-45bb-a63c-a00ff818e2b7",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 72: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7194b387-60d3-4df1-9883-589c039f09ec",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 71: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1beccf4a-8063-4b4c-9850-268953fa2ba8",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 70: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f05c9e48-1871-4bdc-bf52-d04e4f1adccf",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 69: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6304c5e9-42e4-4518-bf03-d5e3b589e56d",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 68: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "66368335-5c0c-4bd1-bad6-b055d53d9e9e",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 67: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "705395f9-78fb-4495-a629-09d0f002a6e9",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 66: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "88c6d403-b957-4d1a-92f5-65c3307badce",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 65: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e3f898b1-f003-48c7-9198-b08fd0569be2",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 64: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b6c21c28-c2d3-450c-b740-75f88f3cc24b",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 63: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "bc4eba3b-f5a5-49d9-8479-d10d41a3421b",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 62: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "cadd3553-a27b-4544-bc81-c5ea05550a4f",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 61: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b6cdb1cf-820d-41b7-a997-566383a499a8",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 60: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "bc4c4c6d-2586-4bae-b84a-2c6e06a67836",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 59: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c93e96b1-6113-40c8-92b6-8d243e8a7ab6",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 58: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c57ebe6e-41a4-46a8-ba16-935c446c36c4",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 57: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0f57770a-ff14-4e11-b5cd-613b871034a5",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 56: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "481b29d3-47c9-4422-b20d-37d40bf72fd9",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 55: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "fbed954e-78c6-43ec-8679-b75df62b8f26",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 54: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "68a38ed7-9c8e-4687-be87-c97c0db6f73f",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 53: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6ac52400-fc27-46e3-9158-fb611b61a5ab",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 52: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b60f54de-bad6-4982-8fa2-31267a7a6714",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 51: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1c6c27f9-a8c6-401a-ae79-4ced9307ce43",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 50: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ad370a84-5ca0-41eb-970a-dbb5fd4e372b",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 49: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3b49fb1a-09e9-4444-a48c-a3a8a54d1b6e",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 48: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f35e240e-ec29-48f2-bc51-b8a35eabea90",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "How many teams participate in World Cup?",
      "options": [
        "32",
        "36",
        "40",
        "48"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "172807a3-c0d8-44fc-b5c9-56c4de81bd3c",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 47: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "98b2e470-4f41-4b28-a13e-6465319e83eb",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 46: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "05889285-865d-4d47-87b4-c695724d9536",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 45: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "eb315de8-d03c-41c1-b49a-2a4f810a0e61",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 44: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "948c6dac-e258-4406-a449-e1e1c511d830",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 43: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "56333bae-14bc-439f-bd69-15eef07819dd",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 42: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "9e789865-669e-4e34-93d7-625af3beb65e",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 41: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "4baeba4c-6a39-481d-9130-e7ee4f4000ec",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 40: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "47b7a5fc-b1ba-4f58-ae9b-701bb45a6a1c",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 39: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "cd05b74b-abb2-4754-b0dd-15d21bcc0eda",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 38: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6b1b43ec-1a0b-4943-b838-2a8d6e5d1e91",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 37: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "77dc9d96-f009-4990-8af9-4b0979e0ff77",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 36: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8e6d1a58-d5a5-443e-8ade-f1d61066a982",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 35: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2062d600-a153-4b08-8785-fc0eb8421f4a",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 34: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1325573e-8d9d-4083-991e-991ff2e97c30",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 33: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b9112430-c8f6-40a7-896a-3022d9e08df1",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 32: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2f9e0815-3f1a-4c00-94db-23e8f2cd10e2",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 31: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "cc53e5a1-69bc-40fb-bfa9-cb597d84315c",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 30: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a311c110-422b-4b3e-930e-d45067adea05",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 29: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3a2c5087-35c5-4972-b397-e45b5bd8d9d5",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 28: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2b1efc40-89b4-4c77-93fb-5fd420b9a88d",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 27: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5cbaa63c-e389-4e05-b520-7402f14ffaa0",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 26: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "9708fe68-3b8a-43b8-97e2-746503d8ade3",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 25: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5408f710-4a99-4a4f-bac0-f88be283f99d",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 24: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "15d7341b-80c9-47e0-a7ea-c21e4ab04374",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 23: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "020cea66-fe17-4dda-8fbb-288efea58a46",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "How many goals did Miroslav Klose score in World Cup?",
      "options": [
        "14",
        "16",
        "18",
        "20"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8ab603a7-8d65-479a-8147-a57547f3a50f",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 22: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6a5545b1-5bd8-46ac-8fc3-6b0719be1f51",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 21: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e9cf866b-a9f7-496a-bbdf-f64345d6230f",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 20: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "93da9bb7-de6d-4ba5-a4a8-ce997f09ddad",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 19: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2c3db70b-e105-40dc-837d-324d3b6fdd9f",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 18: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8264d309-8a1f-4251-af17-1f892630be27",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 17: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f09d3756-1f39-4d00-8b60-32c0bd509861",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 16: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6d94f457-42fa-4bde-81b5-355e35d48479",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 15: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "83e9b36e-9d77-401d-989c-2d34385ebcbc",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 14: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "acbaec2b-9c89-4beb-b269-dd2c2190f6bf",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 13: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b58d0a6a-b0d2-47e8-ad70-64e3a7ade3ce",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 100: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5395c0ce-f1aa-42aa-a36b-7af1426646b0",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 12: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f94df172-3dc6-4b76-a198-c977152d4e19",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "Guess the number 11: Football statistics question.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ed9eaef5-98e7-4538-8845-e6c436f848ca",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "How many goals did Mohamed Salah score in his best Premier League season?",
      "options": [
        "30",
        "32",
        "34",
        "36"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "de3b5ee3-fbed-42a7-855a-75c425b7376e",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "How many Premier League titles has Manchester United won?",
      "options": [
        "18",
        "19",
        "20",
        "21"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "abb0f37a-234c-479f-ad6e-02301a1e0f8a",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "How many goals did Erling Haaland score in Premier League 2022-23?",
      "options": [
        "32",
        "36",
        "40",
        "44"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "97acfeaa-625e-46b0-a5dd-9963944043bf",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "How many Ballon d'Or awards has Lionel Messi won?",
      "options": [
        "5",
        "6",
        "7",
        "8"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d644c75c-b5d7-4634-9b65-92a58c7229fe",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "How many goals did Cristiano Ronaldo score in the Champions League?",
      "options": [
        "Over 100",
        "Over 120",
        "Over 140",
        "Over 160"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b93e012b-a69d-426e-af6e-8a56b0d69dea",
      "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
      "question": "How many Champions League titles has Real Madrid won?",
      "options": [
        "12",
        "13",
        "14",
        "15"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    }
  ],
  "867da722-843e-4ef5-851c-9c64e4ca96ba": [
    {
      "id": "c83ef579-2c10-4a03-b692-5225d5d39875",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 100: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f337288c-b267-4b05-bcb2-ad1e8efef0b2",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "How long is halftime break?",
      "options": [
        "10 minutes",
        "15 minutes",
        "20 minutes",
        "30 minutes"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "38694b07-604b-4fd8-aa12-18eb2111081a",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "How many players are on a football team on the field?",
      "options": [
        "9",
        "10",
        "11",
        "12"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5fee37a8-569a-4100-925d-b9a537ef98c9",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "How long is a standard football match?",
      "options": [
        "80 minutes",
        "90 minutes",
        "100 minutes",
        "120 minutes"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "4dbbbd86-7d96-4473-8c41-216130046892",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "What is the maximum number of substitutions in a match?",
      "options": [
        "3",
        "5",
        "7",
        "Unlimited"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e5e08a0c-3484-4d72-9f86-45241fd09412",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Which tournament is considered the most prestigious club competition?",
      "options": [
        "UEFA Champions League",
        "FIFA Club World Cup",
        "Premier League",
        "La Liga"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "be97c0fb-542b-42ad-a779-fc091bfc69db",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "What does VAR stand for?",
      "options": [
        "Video Assistant Referee",
        "Virtual Action Review",
        "Video Action Replay",
        "Virtual Assistant Referee"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c61a6aa0-fb8f-4a6d-84de-d82c87fa6f4b",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "How many yellow cards before a red card?",
      "options": [
        "1",
        "2",
        "3",
        "4"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "23af72a6-810a-407b-a6da-3b3f262d77bd",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "What is the size of a football goal?",
      "options": [
        "7.32m x 2.44m",
        "8m x 2.5m",
        "7m x 2m",
        "8.5m x 3m"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "695723b9-314c-412c-aab9-c8baab2cd672",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "How many referees in a professional match?",
      "options": [
        "1",
        "2",
        "3",
        "4"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "4f85f781-5a72-4dd0-b9f9-73940580dd94",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "What is offside?",
      "options": [
        "Player behind last defender",
        "Player in front of ball",
        "Player in penalty area",
        "Player out of bounds"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "88bd7104-bdd0-497e-a197-072243480db8",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 11: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "4e5ecd3e-bc7c-4e36-9dd3-df8a5b92caa2",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 12: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "08b4cbfd-2fa4-43b9-a928-b10d83d7cf2c",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 13: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b1139401-273b-485a-ac0a-1bed02fc7fdb",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 14: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d00ea59e-1422-4adc-be7d-5e47cde30c0b",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 15: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2b426f92-3746-46e4-b8a5-a060fb6b855a",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 16: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "04a6c7f1-9983-44e0-bd27-3259062f1b79",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 17: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c2d28d43-e7e6-4978-b8a8-a3ed972ecb11",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 18: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "4eb2fbe8-7eb5-4092-b792-ab720c66b378",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 19: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0596aea0-2344-4c33-9874-84b7036376bb",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 20: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "9492a65b-6a71-42eb-b08b-c3bbb7ec407d",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 21: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "bd885b7a-13ee-4140-86be-cec60d536c96",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 22: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "4b6954e7-0596-4c69-8030-396aac6c88ce",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 23: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "17731c08-1c17-49e1-a1fc-df77744a0adb",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 24: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "48a75a54-2c6b-48a6-ac4e-3bbc145d26da",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 25: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e1c5c610-f66a-4ddc-9f12-79387b9bc5ab",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 26: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e9a37efe-d6e3-4dc4-a71c-b22e6a43a48f",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 27: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2f894bce-439a-4b29-8cc5-9b76b76f431b",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 28: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "cc2d89a1-b9c6-4ac9-937e-7942fb2a3935",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 29: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "499032cd-f00d-4133-84af-04aa850cfa2e",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 30: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b1a1e06b-1628-484d-8159-e7a040be03de",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 31: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "53a43e51-0720-49ae-a460-12d428dbaf53",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 32: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c5f6a2cc-9cd3-4ca5-94b2-6f9a7a83bbcc",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 33: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "951239cd-203f-4c9c-a8bc-12938649639d",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 34: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "49102815-88d0-4b18-ae75-81cd4c81a51c",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 35: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f3c05f19-cf1f-445c-b8ab-2eff5d49b388",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 36: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "eabea8a7-6cda-4b5c-85ef-914f7cd298ae",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 37: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "9c6d5ac0-d6ab-4d75-ac39-dcb4c4811514",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 38: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e5d3abd1-2c6a-40a3-8a11-c17096716d52",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 39: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0fc542be-d5ff-4d6d-bff4-0a7c2d6e256b",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 40: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1d50619e-7897-4e2e-b01d-a7f1dadacbc2",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 41: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0aa6a331-5576-4fb5-8396-ff93560cc45c",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 42: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "400c42ce-7752-4ac6-b342-b139e138bc2a",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 43: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "84236ce6-d86a-4ceb-9d38-a4eaf65901ef",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 44: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d37a4181-628c-4991-acbe-ba86ab48d6c1",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 45: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2b127afb-a36f-4e0f-a6f7-19133f282822",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 46: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "afc538b1-9ab3-4196-a04b-4c31deb772d3",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 47: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "456d5b66-59fb-4523-a2dc-9428c6ef934b",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 48: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "fd984137-dc1d-46a9-9d84-6d82773ce203",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 49: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "574f4822-8971-415b-99b1-c5c467c1b0f4",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 50: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a52e5aba-b251-4aaa-a02b-9b5b20997b16",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 51: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "75463947-5d64-4de2-af98-96e7619f4210",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 52: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a997d585-06ec-4984-8ac9-ad2aa0a34041",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 53: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "090cac7d-e2d1-412e-91d8-3854fe0fbadc",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 54: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e5afb6be-062c-4c2c-8994-e3b4853488e1",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 55: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "89fb4d2c-9287-4fd7-8515-da68d4eae026",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 56: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "82c63f73-f0f0-4705-9e1a-ef7de38e5b70",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 57: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b3659585-e590-43cc-81c8-f3aa031956a9",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 58: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "473d33e7-28b3-4340-835d-721789e76ce6",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 59: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e3507265-8b40-4fab-a3d2-7338646806d5",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 60: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8e8239c9-db47-4228-8bc0-82d1b1fcfb64",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 61: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f15b562f-93f6-4d45-9641-5d24b368fe0f",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 62: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3afa1bb1-57f3-4041-996e-bf48c317455e",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 63: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6ffbc9dc-2e3a-4490-8626-ec9a262528ce",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 64: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a73926f6-2760-4d98-a767-d4d6c9ac0cbe",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 65: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b5925b5f-1f93-43ba-8b4d-0c68eb965cdc",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 66: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e8020c93-ea8b-425f-b99e-cbbe3923324a",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 67: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7e44c141-631d-4b16-9021-6c923044a949",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 68: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "5f9c0781-f770-4587-9888-99a296bcd936",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 69: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3a49cbae-bf42-4d5f-989c-53e76d1a8995",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 70: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "4f9a897f-e38c-4f43-bffc-16e46b56edfa",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 71: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "612080df-2d16-46c7-8518-6cdf23cf0318",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 72: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7c5a2b51-9c54-4a60-8666-48549237cb33",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 73: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a401f9e5-3fba-4888-9742-444c492efaed",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 74: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e9eaf6e4-761e-420a-a4d9-3d13967a1ff3",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 75: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f46bf42e-d376-4d6b-ae32-116b5167906b",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 76: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0c6a97a6-7089-4e27-a4e4-e5b4de640ff4",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 77: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "504116eb-091f-4a3b-a673-21cdf5c74d44",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 78: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "54a60a00-c72d-4008-bc32-4950e62181c7",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 79: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "30812451-e6fe-4547-8ca8-7b46b7297fad",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 80: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "fc0da0f4-3524-45b4-9aa0-302a065054da",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 81: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "cb849263-db97-4d49-a9a5-17c7100dc579",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 82: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "fede8d7e-3855-4c38-af07-2ec8cca3228a",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 83: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "818160de-15ed-44e2-b74d-61f13b88ee45",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 84: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d1179eaa-56d4-473d-86a5-f44ef20c90ef",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 85: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0ab0ade2-edea-4efd-adc1-4b0fb7194dfb",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 86: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "74845401-b4fa-4092-b17a-74a1bffb3b87",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 87: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a88b4e8e-38dc-4fbc-84ff-a0d161fdefcb",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 88: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "005d9b46-17cd-4af7-9f56-8bd63b7d412a",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 89: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3fa31b20-f169-4f0a-b152-d833e8f2542b",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 90: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d9ed63db-f5ce-4ac1-a7fb-df81cb81ea41",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 91: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "bf133592-76b8-40f8-a542-9424269ded83",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 92: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8e6c8bdb-cd36-499b-9636-432a2e6e80e0",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 93: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0e9bbe49-b346-4917-b31a-f93468e42354",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 94: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1efe10c1-25b9-4112-8c19-3d5aeeac6892",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 95: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2d7048b8-a122-4167-9f0b-1b1342528e09",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 96: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e0cdb4e4-167b-48a6-ac10-5d84cfb79536",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 97: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 30,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3b2b6912-b634-415a-b8a8-c5d7413981a9",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 98: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "EASY",
      "points": 10,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "72385f67-cfae-47b3-8ec2-fbbc93fd4b9a",
      "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
      "question": "Q&A question 99: General football knowledge.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 20,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    }
  ],
  "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36": [
    {
      "id": "2eea17af-5a42-427d-9220-b326b4255389",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Which legendary player is known as \"The King\"?",
      "options": [
        "Pelé",
        "Diego Maradona",
        "Johan Cruyff",
        "Franz Beckenbauer"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "01e8d4d0-5741-4685-ac92-554283407dc5",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Which player is known as \"The Divine Ponytail\"?",
      "options": [
        "Roberto Baggio",
        "Alessandro Del Piero",
        "Francesco Totti",
        "Andrea Pirlo"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "424eb0a1-a5d1-4708-9518-c89ed37a38bb",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 100: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d913b6c4-43f3-49ae-8792-b06f5c3692e2",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 99: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "cea17f52-6e4c-439a-a402-d68249c597bc",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 98: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "4a068aaf-a5d9-451e-9afd-4b8cce40dc33",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 97: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3aa64b25-c1d1-4d30-8bff-5c2cdbae2ab4",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 96: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8876d65f-9a52-4427-aeb7-781fa6b00307",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 95: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "015f2c9b-418c-4e3c-bd88-97dbe5bf0ca9",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 94: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7e345893-f541-4a01-9dde-6c859ebe57fd",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 93: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6d0dfdee-0ae6-428d-9a90-f85da019f790",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 92: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3c820809-b10f-4ce9-86ef-663fe00f70b6",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 91: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f20c062d-4557-4be4-b13b-bde6df396a53",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 90: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "8db1cc66-1049-4e6b-aa74-48a1d4434e87",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 89: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "dcc5b17d-7d9a-45dd-8854-a07607a80924",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 88: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "15ef606c-9c83-4149-964a-6695df858c8d",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 87: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7e8dca83-7230-497a-8c4e-fc8f674b8ade",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 86: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a32ec660-fa88-4bec-8716-4c13ae3921d8",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 85: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1aefcd84-f372-43c1-bd0c-9d036e5efd22",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 84: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "46419602-859a-4be6-b921-4ad56eb27ce9",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 83: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2531467a-7772-4907-9fc8-a7b2dd388ef5",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 82: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e807abc8-cb03-4094-b0c1-981be56f92b6",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 81: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "be7e2a08-f196-4e63-9d96-b17b95610f85",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 80: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ea4385d4-3ec4-440c-89ed-3240cc98351c",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 79: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "41648e3a-9a1a-49d0-a75d-f469bd818ea3",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 78: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "08d2a99e-bf48-40a0-825c-b7b5164cabec",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 77: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "61ded8bc-b9e1-43a4-87ee-0a280f146c7e",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 76: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3a581d8f-cdbd-4815-b4e5-67bccf0a5f6f",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 75: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a9fba5e3-2c2d-48bc-a14e-5e465e927fb7",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 74: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f1a2b9c4-73f7-4251-8b24-4957526a79b6",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 73: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "40726c03-d173-4d3e-88e0-c4465f4ae4a9",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 72: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b88653a9-ffd5-4483-997a-71b4af7f8f9e",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 71: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "99a27659-244e-4dbf-9246-df6d630b7146",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 70: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "66439782-71f5-4d50-963f-cfac73baa991",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 69: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d3260f58-a59d-45ab-8827-bc478ec08254",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 68: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3fac8c8d-edb4-4cfe-bed2-f534e14425e2",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 67: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a838b1b5-566f-449b-88c9-26c44e1fa835",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 66: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e4e80469-e1e6-4345-b228-299e45571158",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 65: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "66aa174d-5a85-48e3-836c-9671369a2c01",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 64: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f1e4ed0f-dd41-4297-bcae-7b43f611afdd",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 63: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c95940a8-2fca-430d-a5a9-94f527fd80a5",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 62: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "edaf705c-b8da-4c67-b897-2cfa987f5a1e",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 61: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "2dc598ca-b80a-478d-8034-51bca9d2c06a",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 60: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e46f39df-f69a-49b9-96ab-1e21087f5d4f",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 59: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "fa3603fd-c23d-48cd-83f9-a931e98e94e1",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 58: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7267b8b6-80ee-4764-8913-f3c024c3ed1a",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 57: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "fdb2f912-d24c-439a-9670-adc5733c3146",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 56: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d2f89f0c-3477-49eb-a2f2-6deca43c6fcf",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 55: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "902ae823-9f48-4a06-9ce3-368a7dbfa8eb",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 54: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "7db05e79-ad57-40d5-a409-210e6a97ae34",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 53: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "caf30b37-0b6d-48b5-85bf-9d425da6b353",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 52: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "92c990d5-0e16-40d0-b6ba-22b86911b8eb",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 51: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "189fe33b-1498-4929-96f8-142f52132831",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 50: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ea3bfcd3-9da1-4925-9a34-f8bdc7233a15",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 49: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "9335560a-4468-4fcf-bb29-afa4fe013219",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 48: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "64ee25b5-10b3-47f5-b6ab-879fed16d067",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 47: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0e192c3c-8ed9-45a7-9a48-c796f0a72328",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 46: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "9c500711-f8fd-4b76-bcbd-3279981cc94a",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 45: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "31c57e07-93a3-44c9-9407-0e4016bd5545",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 44: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6871fcda-b90e-415f-a61f-28f1eed29699",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 43: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "02b0907e-6061-4ee9-9ba7-512b9bb053cc",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 42: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "82ac003b-522a-42af-904c-a76116c67879",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 41: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b76a936e-2e4e-470b-a42c-411e92d80cc5",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 40: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "aec92f43-8b0f-40b7-aae4-5fefae4a28aa",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 39: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b17c5f2c-b251-431d-bc0c-f3f804db4c57",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 38: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b2c7e44e-0f76-4573-99d1-e603908dbcf0",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 37: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b594ba35-dbb8-4c8f-bb0d-189a8f489c43",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 36: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1ca3fc81-3a5c-4782-a064-a165dfc6c6c9",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 35: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0919803f-2629-4172-b68f-c421556b0d91",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 34: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ddd25ebc-be18-4138-b95e-d6ff072584cb",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 33: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a034c7c1-153f-4379-80e0-94676cd2e528",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 32: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f05a4021-f445-4aaa-8f85-10cec5f22f1f",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 31: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "6bcd0aaf-af09-49e3-a03a-6ad076477bf2",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 30: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a82e0df9-4551-4b6b-bf46-2fc1ae6b37bf",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 29: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ae2a3a0e-9bd4-413a-96dc-981cddc47cb5",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 28: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "03b95b89-ab5b-4c5f-9b1d-13fa200aa87b",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 27: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "85b53f41-fc1a-4d5c-a2cb-3538f1c13aa8",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 26: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b2d8a1cf-802f-4f7f-843f-6ec47f6845b2",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 25: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "a429d349-7a91-4ccd-9f16-8a6c9b86fdc7",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 24: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "75f11a27-86eb-452e-901a-b0f81b47e0b5",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 23: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "9246bd4e-6e95-4cd8-a9a3-8cfc61313e3e",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 22: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ce390a20-50e9-4f30-a250-135c1978dee4",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 21: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b26bca68-e683-4758-9f19-a2a66de78635",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 20: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "146eb571-b398-4c87-9c6f-6be59dee6aee",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 19: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "17d93021-63ba-4d2b-b1e1-7870b352889a",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 18: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "e619c8a9-8939-4f7f-93cd-ef0b24dbb42f",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 17: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "863ddee2-e828-4899-9dfd-545ae25f8bbb",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 16: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "73e5e66f-9e82-4629-98ac-0f620f9bd855",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 15: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "ada39e3b-2ba8-4007-9083-e30987bf2ee8",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 14: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "97327dba-793b-4b19-92c9-58bbd5020234",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 13: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "81934418-ff97-4c0d-b3a3-25a0b827027d",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 12: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "41fd2214-feea-4acc-8904-eb8463439630",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Legends question 11: About football legends and their achievements.",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1501c59c-8ec2-4e8b-9ff6-3cf1697a38d8",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Which player is known as \"El Loco\"?",
      "options": [
        "Jorge Valdano",
        "René Higuita",
        "José Luis Chilavert",
        "Iván Zamorano"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "b908de4d-6fef-441a-836a-a2dd795acf94",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Which legendary striker is known as \"Der Bomber\"?",
      "options": [
        "Gerd Müller",
        "Miroslav Klose",
        "Karl-Heinz Rummenigge",
        "Uwe Seeler"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "1a58b5be-421b-4e0c-b2f6-8d5e0bb31171",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Which player is known as \"The Black Pearl\"?",
      "options": [
        "Eusébio",
        "George Weah",
        "Roger Milla",
        "Jay-Jay Okocha"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "3ace13ea-5773-4786-90d1-33ec5573c065",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Which legendary defender is known as \"Il Capitano\"?",
      "options": [
        "Paolo Maldini",
        "Franco Baresi",
        "Fabio Cannavaro",
        "Alessandro Nesta"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "f2fb65cf-d628-4996-b239-054e2bdc0116",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Which player is known as \"El Diego\"?",
      "options": [
        "Diego Maradona",
        "Diego Forlán",
        "Diego Costa",
        "Diego Simeone"
      ],
      "difficulty": "EASY",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "0cafcc6d-caa8-4850-bad2-c52b7c4210eb",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Which legendary player won the World Cup in 1958, 1962, and 1970?",
      "options": [
        "Pelé",
        "Garrincha",
        "Didí",
        "Zito"
      ],
      "difficulty": "MEDIUM",
      "points": 25,
      "imageUrl": "https://media.api-sports.io/football/players/1100.png",
      "imageType": "player",
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "d5394f9d-e171-450e-89db-0be5ad07478d",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Which player is known as \"The White Pelé\"?",
      "options": [
        "Zico",
        "Sócrates",
        "Rivellino",
        "Garrincha"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    },
    {
      "id": "c3fdef74-a58d-4075-be0d-e79aca524afc",
      "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
      "question": "Which legendary goalkeeper is known as \"The Cat\"?",
      "options": [
        "Lev Yashin",
        "Dino Zoff",
        "Gordon Banks",
        "Peter Schmeichel"
      ],
      "difficulty": "HARD",
      "points": 25,
      "imageUrl": null,
      "imageType": null,
      "hint": null,
      "timeLimit": 15
    }
  ]
};

/**
 * All questions as a flat array
 */
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    "id": "ae650428-7086-49d5-8e82-6787f5d67052",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Which players formed the \"BBC\" trio at Real Madrid?",
    "options": [
      "Benzema, Bale, Cristiano",
      "Benzema, Bale, Casemiro",
      "Benzema, Bale, Busquets",
      "Benzema, Bale, Beckham"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8564e4ce-8c21-4089-83b5-c1a66dca9a77",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Which players were teammates at Barcelona in 2015 (MSN trio)?",
    "options": [
      "Messi, Neymar, Suárez",
      "Ronaldo, Bale, Benzema",
      "Salah, Mané, Firmino",
      "Mbappé, Neymar, Cavani"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ceeded91-6e6a-47b0-a55c-d6a1b8ca2a83",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Which players played together at Manchester City?",
    "options": [
      "De Bruyne, Agüero, Silva",
      "Messi, Iniesta, Xavi",
      "Ronaldo, Benzema, Modrić",
      "Neymar, Mbappé, Cavani"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/50.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b2f72abd-0b12-49b4-9070-5af6e39ae5ea",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Which players were teammates at PSG in 2021 (MNM)?",
    "options": [
      "Mbappé, Neymar, Messi",
      "Ronaldo, Benzema, Bale",
      "Salah, Mané, Firmino",
      "Messi, Suárez, Neymar"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/85.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3e3a0e87-a2de-407b-8aa0-27ab1170e90d",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 6: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "9957a28e-2136-4ae8-ae79-1b484921ea51",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 7: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e89aa649-25d8-49fb-9b6a-29e9a6f17abb",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 8: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "bba98d28-8421-43ba-a6cd-9daa1edab930",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 9: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6b40e355-365e-4be4-8a13-7e6a8e8d7e2d",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 10: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6ce5c592-9766-4e16-9f4e-9e50df956554",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 11: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3a6748e1-defe-4ec8-a06f-3e5e89bc42de",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 12: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6ee4b1b9-44b9-451f-9f45-5f46dd8279c1",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 13: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b15e236f-f4ca-48d4-a448-fa22cd8481e2",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 14: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ea1217b2-7d41-4c52-9faf-a5abe2ee0f25",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 15: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "33df23a3-29ba-485d-bf8e-05867f36888e",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 16: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b1282ada-ff38-464d-a285-6dcece97969a",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 17: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b4fd8056-ea9d-4ef7-9cc9-e4903dda5c0a",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 18: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a5a063c8-ea42-4fd9-b4cd-ecdf3486b193",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 19: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2944934f-1045-410e-b688-288daa6b2019",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 20: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a9546e25-1f08-4105-a886-31a8ee88aa24",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 21: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b47c4474-a381-4eb6-b7c0-5ec242c78f1e",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 22: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "01bd1e44-1672-42c5-b08d-3ffaa78d72c0",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 23: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f4c7506c-83f3-4802-a770-e3f7e8c60f15",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 24: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "318f24ba-a5b3-491f-a97c-5a7eb2784150",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 25: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "78190532-a5fa-4589-be42-faf30419c4c3",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 26: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7fe2db6a-df48-4b95-aee8-4552bfd1c60b",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 27: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "507c4c99-cc64-4f05-b5e0-60cf00fd94c1",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 28: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1e56cecf-677b-4dc2-b3c5-f369adf5d616",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 29: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "55ca1ecb-839b-4862-9f52-a15e7c96ace1",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 30: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "acc3aac5-a50e-4e03-8a34-8d1212ee9f8e",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 31: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5a272069-d364-4cbe-8f19-c796381871a0",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 32: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "669318d0-8fa9-42c3-bd9c-41add5d85059",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 33: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a7283dc7-2993-49a6-9cbd-da08a632efcc",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 34: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5052c468-7710-4734-8e20-7d18eb0dcac5",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 35: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a57b6dd1-d2ca-482b-bf43-5477fc7fa290",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 36: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0935f6c1-ac83-4a59-8fe6-1200de0be396",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 37: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "679ac8b1-0c92-405e-b5ef-88fbe524cc7b",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 38: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1bb77c0d-7cc7-4eac-8c9e-0ab0defacbcf",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 39: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "62d0c923-2685-4a9d-8283-4e1bb1ff0edf",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 40: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "bf31254f-4726-4896-917f-e85032946245",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 41: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "26d388d6-a83e-499f-9ad4-009ff0e544d8",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 42: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1a2aa260-27f6-4f22-ad1d-1564b3efbef2",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 43: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "28a96e51-ed8b-40df-9396-53649348d139",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 44: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "31794cdc-1d4d-411a-b277-54240f2078d5",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 45: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c4e56ed0-601d-4344-9e4b-fd9607f1cee4",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 46: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "586fbee6-3177-4214-9ff6-8bf0d8f3210a",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 47: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ee787746-c155-4f71-bcc4-dcc4265891a0",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 48: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5103279b-517b-45f4-9d4f-99cde6c5265c",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 49: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "fdadc21b-c442-4024-8512-ec14002568f7",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 50: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3542c381-6ff9-47e1-8a2f-ec84cfd0a451",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 51: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ce188f51-d1f3-475e-a4d9-1bdd72f78673",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 52: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "bd8701a3-e8cf-4fe5-b1c6-90bf3ad3bf61",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 53: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "957d53a7-437a-40e3-b72c-4973a30a5376",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 54: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "cd0a2774-81f6-42d4-a998-1dc657abfae4",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 55: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "41b33444-33c5-4339-8459-e1be06b8b263",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 56: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e021ae8d-47b5-4493-9636-a056588793de",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 57: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "981f9a40-f257-47e4-82a4-ca7f6d8dca52",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 58: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8d4e3dc7-3262-4ddd-bb93-7d5f32849937",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 59: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6da4e5c2-bfc4-4589-aadf-31003ec11404",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 60: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "fff52fb4-e63d-4ece-8593-4cff78745d13",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 61: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "af821e41-5719-4c22-84de-46592b6b2f6b",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 62: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "95f5634a-94ce-4a6c-ab2c-5c30f2670c76",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 63: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "25396f7f-49e3-4841-b1a0-be194be1fb9f",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 64: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "de78f9e7-5729-49dc-84da-3238ead2d788",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 65: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "182e71ba-90eb-451f-b811-24ce57400c81",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 66: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b392b61a-654c-4713-854d-dfcae4a25002",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 67: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0f8c294e-a336-4df8-a659-93cb3d1dbe4c",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 68: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3192e305-5226-4821-8c08-7bdc71271de6",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 69: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "94f9e31f-2356-45d6-b27c-2cbfa4b0f723",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 70: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e04fdb32-decd-4829-9307-cb5221d18e3e",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 71: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e414ee66-c40e-4b5c-8e25-ea714a51eaca",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 72: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2c6738f1-bcbd-47da-be4f-be641688aa92",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 73: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8046d087-51eb-4168-b305-9229feb71d72",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 74: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b438e1f2-af64-4765-9b85-315335c9cbd3",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 75: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "447acf82-5e6c-458d-9a95-eff2d4871113",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 76: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1245e15b-b9e2-4762-a510-e78e0e58a102",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 77: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "dc6f036c-f818-4039-827e-450e02fac745",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 78: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e5911555-b6e8-492d-bc56-b92fa90fb80f",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 79: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c37034fc-0b30-4f4d-8d6d-bc1fd28ef252",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 80: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c5a2c270-9d1e-4a03-9695-79e9cab39696",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 81: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "28ffb796-e366-42b9-a23d-265dd321e346",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 82: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b42c25c8-fa59-4bec-b33b-ac3807c8d761",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 83: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8fb741e9-447b-44bc-974d-a8db16a90507",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 84: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d0a65b0a-9bd0-4fda-a231-f030a44b31c3",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 85: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "edd60298-a350-4c9c-9f5a-aed70456ccbc",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 86: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "43ae0102-e354-44d3-8e5c-fa4f1f17e1c1",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 87: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ec251005-2988-44ae-a314-f89aae6ea571",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 88: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "fbd5ad8b-4b26-42b8-b6ad-cc7d5f132be0",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Which players were teammates at Liverpool in 2020?",
    "options": [
      "Salah, Mané, Firmino",
      "Messi, Suárez, Neymar",
      "Ronaldo, Modrić, Kroos",
      "Mbappé, Neymar, Di María"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/40.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "105d5001-8d63-49ce-a9e0-32059114bf05",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 89: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "cdc79b1c-adc5-4201-a6b8-76f308686785",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 90: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f6d1ec5c-ade2-4836-89b5-68514a38cd0b",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 91: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "37161f64-7eb5-431d-a8c9-74a1c0360ecd",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 92: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c918fcad-6b23-46c0-962b-dabde529a9cf",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 93: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6323bfd8-bba1-43e9-98bc-84cfb443bc8d",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 94: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7590682c-55eb-4475-aa1c-bd30a4ec185f",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 95: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "883ce695-d2b9-47d0-b290-acdf75701a09",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 96: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "de275f8f-2af0-48fd-bc17-fb3541689cd8",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 97: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "da5256e9-3e35-4547-aea0-a13c0d8c2c70",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 98: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f9a07b74-3572-40a1-a0c6-771fdb6376ac",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 99: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "965c5f36-fa76-4bdf-b25d-f9937e25fd60",
    "categoryId": "04025ae4-15ac-4165-8113-e4b3f75d4145",
    "question": "Teammates question 100: Which players were teammates?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/teams/541.png",
    "imageType": "club",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "af09bae9-c899-442e-bdab-f53d7f977077",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 88)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2e1c1aee-4b15-4734-abe1-c98ffbb47968",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Cristiano Ronaldo and Lionel Messi have in common?",
    "options": [
      "Both won World Cup",
      "Both won Ballon d'Or",
      "Both played for Barcelona",
      "Both are from Brazil"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f06b8124-1cd8-48a5-aced-c9969de605c7",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Mohamed Salah and Sadio Mané have in common?",
    "options": [
      "Both play for Liverpool",
      "Both won Champions League together",
      "Both are Egyptian",
      "Both won Ballon d'Or"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2f5c1098-35b5-40b1-9fe6-416ad3fba423",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Real Madrid and Barcelona have in common?",
    "options": [
      "Both from Madrid",
      "Both won Champions League",
      "Both from Catalonia",
      "Both founded in 1900"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1febc236-c0ff-4761-ba30-5c9bafd3ad5a",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Pelé and Diego Maradona have in common?",
    "options": [
      "Both won World Cup",
      "Both Brazilian",
      "Both played for Barcelona",
      "Both won Ballon d'Or"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "bbc57ae0-aa03-4e81-a3a5-9ecafd180024",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Manchester United and Liverpool have in common?",
    "options": [
      "Both from London",
      "Both won Premier League",
      "Both from Manchester",
      "Both founded in 1900"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d6733dd0-1607-40f0-87d0-692749bad170",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Kylian Mbappé and Erling Haaland have in common?",
    "options": [
      "Both Norwegian",
      "Both play for PSG",
      "Both born in 2000",
      "Both won World Cup"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3d1939e1-046d-4f96-9616-b156c9ff0c4f",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Manchester City and Chelsea have in common?",
    "options": [
      "Both from Manchester",
      "Both won Premier League",
      "Both owned by Russians",
      "Both founded in 1880"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "11bc268f-7ea5-4c03-acd2-3df86c10a6b0",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Neymar and Vinicius Jr have in common?",
    "options": [
      "Both play for Real Madrid",
      "Both Brazilian",
      "Both won World Cup",
      "Both born in 1992"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6a1ca96f-f8d1-4f18-9584-8dc9226f14ef",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Bayern Munich and Borussia Dortmund have in common?",
    "options": [
      "Both from Munich",
      "Both won Bundesliga",
      "Both from Berlin",
      "Both founded in 1909"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "59b9b2da-5522-4b18-8095-40d33730acb6",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Kevin De Bruyne and Eden Hazard have in common?",
    "options": [
      "Both Belgian",
      "Both play for Chelsea",
      "Both play for Manchester City",
      "Both Spanish"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8f954255-0c08-4196-b05c-db46ab1c1068",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do AC Milan and Inter Milan have in common?",
    "options": [
      "Both from Rome",
      "Both share San Siro",
      "Both from Turin",
      "Both founded in 1899"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0514a298-cf22-4506-bf4e-61581a14ec16",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Zinedine Zidane and Didier Deschamps have in common?",
    "options": [
      "Both French",
      "Both won World Cup as player and coach",
      "Both play for Real Madrid",
      "Both Italian"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d0a294fa-7e88-4fe5-9db5-5cd66e5bcdf3",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Barcelona and PSG have in common?",
    "options": [
      "Both Spanish",
      "Both won Champions League 2021",
      "Both from Catalonia",
      "Both have Messi played for them"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "27e5c53f-8a8d-491c-80be-689ed36083ac",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Luka Modrić and Ivan Rakitić have in common?",
    "options": [
      "Both Croatian",
      "Both play for Real Madrid",
      "Both play for Barcelona",
      "Both Serbian"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3be4d3ef-3bf2-425a-bcc3-38c4773a182d",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Arsenal and Tottenham have in common?",
    "options": [
      "Both from London",
      "Both won Premier League",
      "Both from Manchester",
      "Both founded in 1886"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6c849a3a-913a-4295-97a1-a6c09be91580",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Sergio Ramos and Gerard Piqué have in common?",
    "options": [
      "Both Spanish",
      "Both defenders",
      "Both played for Real Madrid",
      "Both French"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "cc83c751-f845-4065-be00-271a9f080d9f",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Juventus and Napoli have in common?",
    "options": [
      "Both from Milan",
      "Both won Serie A",
      "Both from Turin",
      "Both from Naples"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d37486e3-eea0-46d2-a373-1d3f9fd56a10",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Andrés Iniesta and Xavi Hernández have in common?",
    "options": [
      "Both play for Real Madrid",
      "Both Spanish midfielders",
      "Both play for PSG",
      "Both French"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "68ee9551-a28a-4484-8005-0135cf6365a0",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Atletico Madrid and Sevilla have in common?",
    "options": [
      "Both from Barcelona",
      "Both won La Liga",
      "Both from Madrid",
      "Both from Seville"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0c1ea7d0-91a6-46f4-a222-6e8bc627cef1",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do Virgil van Dijk and Matthijs de Ligt have in common?",
    "options": [
      "Both Dutch defenders",
      "Both play for Liverpool",
      "Both play for Juventus",
      "Both German"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5d997b7f-ca46-4066-9440-42b7b011a2e8",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 21)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8abc9017-5880-408f-ba93-58452c51e781",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 22)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "480854a0-dbb2-4da2-a7e9-263f14c99dbf",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 23)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d84d2590-164e-4523-9e30-ae90a7401fc1",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 24)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "72f87afb-14db-438a-9846-631cd1170f93",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 25)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "36339fb2-b229-4ba2-a74b-f0308a04ff5d",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 26)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f7386408-c445-4998-9868-5e6feebe0396",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 27)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "15aa5eee-c7e1-4d5c-9bee-cd44f5c1653b",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 28)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "bfb5c8bc-dd68-4977-9ee2-3d7395fc4249",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 29)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ff4b1c5d-499b-42b3-8b7d-ac6c4931dbce",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 30)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f067d302-1442-43ee-95a1-58ef0f6b44d4",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 31)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "046afe79-e8d6-495e-b10d-9a043ea7e119",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 32)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "17b3a6ae-458f-49bc-bed7-86fed0b01a8a",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 33)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5eb2f201-31d0-46d0-acb7-e53707d79400",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 34)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ca5a2e51-d4de-4249-8403-52bdb792be5f",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 35)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "53027b93-ff6e-4822-9c8c-41bfa998ffbe",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 36)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2f530d06-f633-4637-9ef3-5896d9d20999",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 37)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2966410d-de21-4d44-af4f-9b6fc73fe7dd",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 38)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "26e471da-1504-4b3a-8a2d-41077cf4ad72",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 39)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "cd924673-7d07-4b1e-a7eb-24e03881f669",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 40)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "cc197a0b-6963-4ce1-8409-e1754991446a",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 41)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3440e745-4288-4251-af8b-a1e08bccd5ea",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 42)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5086cab7-418c-449d-ac67-ada1e07d4612",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 43)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "709ebacd-4f30-4018-b270-7b71bec4fdff",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 44)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e7872fe8-c24d-4690-8db2-96aa36875c49",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 45)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "200758a7-f4f8-4ace-89c4-b8b00196f073",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 46)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b331a40e-0907-477f-8733-c0204b7ab7ac",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 47)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c3bf8fad-0771-49a6-9af2-e92e8b824bb0",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 48)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1e4a1b11-d203-4fa7-b6f8-f5f5dbf5ce47",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 49)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a11fef57-08d2-4b15-bc5a-5d2d41851256",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 50)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1888a5f2-35ad-4063-ab9b-94f2f74a6681",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 51)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "9056b38f-3429-4d93-8389-219e215f32c7",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 52)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "4bb5a96e-84ce-4ea5-a76f-a39a41445d35",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 53)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b6b0e1ed-5264-4e5f-9473-d00dc33b8edf",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 54)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6f47d606-220d-4aff-9608-7371ae970639",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 55)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7f184423-1c52-410a-bf82-f9e339b51da7",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 56)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3cc90335-d5ad-4fc6-94db-c37027b644a0",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 57)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "4532d297-0649-4ee3-99fc-4d2f41c6c4a2",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 58)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e2c7e63a-0828-42ce-b911-836ada490dd6",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 59)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5a592cb4-3b45-4e79-a61a-f224cdfad198",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 60)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a09eb535-3303-478d-be21-fae80ce4beed",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 61)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8520eb5a-ab33-4747-a873-1901afb511b6",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 62)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "40382ebb-ed46-4bfa-8fb4-e7706e097a2c",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 63)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e802158b-9128-4c67-8fd6-eaa97b4ced90",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 64)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b38ec164-0d08-4e23-a6aa-4fe0afdf07ec",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 65)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8e339fa6-10cf-4d5d-add5-5c734cf0ee8e",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 66)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "25245499-7434-463b-9bef-b869304cfc80",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 67)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "dcc4b35f-bf2f-45f7-9236-517e4136c735",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 68)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7156ebec-84fe-49c8-8a36-2ab721a13101",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 69)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6a12fb99-2bbc-4d6b-a425-8b41d46ac1f4",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 70)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "02488500-7ad4-4efa-8ed6-714a53e5d9ae",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 71)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7ccdf496-fa1a-4e92-bc84-847896d3de95",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 72)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "92f9529c-14d0-49fe-9b70-d0001d556ca8",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 73)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d962e321-c044-4b75-9b05-2a3fe163dc1e",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 74)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "103e9cae-8438-42db-91dd-74cec2f5c54c",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 75)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3d81980a-4a59-4cba-bd84-ceccc1fd2724",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 76)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "663a2c88-2a7b-4cc3-8c51-b29414e06b12",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 77)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "bb061134-d41e-467e-a891-6fc9b48dd9de",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 78)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2106ae81-55a7-4f86-a2b0-77ce4f2d2735",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 79)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "fbdd53af-9dea-4894-ad7b-6c5fe7144242",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 80)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "28a403c6-9d1c-4f81-88f6-f5f818fe110a",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 81)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d34f3d7d-4a6b-40b2-b66d-cfa11f6bb779",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 82)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "30a4edc7-f372-4363-9b80-163fc1c8d982",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 83)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "718bc154-3581-4733-a4b0-87e6b5458eb9",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 84)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "92f5258d-2aad-43f5-ad60-3c93e09ae094",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 85)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7c382a48-b386-4b40-91a5-718ee6f31ed7",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 86)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "75d8c127-1d60-454e-838a-c719268913f7",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 87)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "adcb27a7-ccf1-4a1f-86f1-ef31a4c5c5d5",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 89)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "368a33d2-fc70-410c-9f6d-91c92e15d790",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 90)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e8c4455c-b607-40be-a5b1-691f19b546af",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 91)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "cbfa6919-5246-4bae-8621-5cc54120542b",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 92)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7a2dda45-0816-40ef-bf5f-4e66052b948e",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 93)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "93859fa0-9a48-416a-8f40-9709010e30bf",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 94)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5ad3ace1-78ae-47e1-8fa4-e7d52c8e0038",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 95)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1da6a628-4d05-4311-a438-a55fdee0c0dc",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 96)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "24b28ad5-217f-449d-a013-76e399e90ff7",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 97)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ebdec751-5790-4c64-818a-0e371dcd542e",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "What do these players have in common? (Question 98)",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "235af2de-a36a-48d0-919a-92d10abf5568",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which two players share the same nationality? (Question 99)",
    "options": [
      "Player A & B",
      "Player C & D",
      "Player E & F",
      "Player G & H"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1f0d72d6-43b7-4af0-b081-31b9ab8af580",
    "categoryId": "0c64124c-0479-48d5-a315-c5ca16852635",
    "question": "Which clubs have won the same competition? (Question 100)",
    "options": [
      "Club A & B",
      "Club C & D",
      "Club E & F",
      "Club G & H"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8bfaa35f-7941-48ff-8c43-cb33b7405be9",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 99: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "cf4043b1-73ef-4bc6-b4aa-83f0ad8bfe64",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 98: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "4472431b-3a9f-4160-8870-e98337390e9f",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 97: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "ae42ac77-98bb-4662-b5e7-580f54a23072",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 96: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "0afeda0b-bf34-462a-bdb0-36cbc00d4f50",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 95: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "69118b94-2b89-4698-afb4-72903ec4b415",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 94: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "e236e46e-9148-41bc-83ad-730ed39cc7a1",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 93: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "4a04a26e-213e-4f48-8cfa-912f188765f6",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 92: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "d9874586-3b0b-4f50-bcc6-8342989f0ed7",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 91: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "c24fb6f4-87ae-4333-b1ed-3f54ae508266",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 90: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "6cedadf1-c234-4472-855f-3a65fa556430",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 89: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "e98ee0e9-0199-471e-9b1c-b193fc34afdf",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 88: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "854a99dc-e6d2-4e3b-b975-7445dccd7f0a",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 87: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "d14b0f46-d472-4296-bf0b-9e5f673704d7",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 86: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "383ac2ab-40bf-44da-b005-29c7c475254c",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 85: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "155a7586-17c2-4192-9a50-ed520f78da8d",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 84: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "cf0e1541-92f7-4f79-aa22-ed7f5c4d26c1",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 83: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "e58c8b73-472e-4d81-b3ef-5b3dec61aa9e",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 82: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "b604ed9f-a6be-4c2f-bdf3-b8a4f22a5a50",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 81: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "b92275ac-e924-467a-b2ba-a76b08bd1ea9",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 80: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "4737080c-2cee-4b0f-99eb-4f45290a05c3",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 79: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "a5b423a8-bccd-4388-a245-3c1c7d56ce82",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 78: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "f74fe2f0-0874-4d6c-be1e-b10a1658910e",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 77: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "e04f360e-15a5-44db-8675-91f84c743495",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 76: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "a8335cdc-20d8-446e-97a5-385c3e79be02",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 75: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "88b605dd-6005-40f3-bbd0-db1b6ba70aee",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 74: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "81c7c932-7c01-4b3a-a82a-150973d7495f",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 73: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "9ba3d90c-4eec-4e7a-9e5c-65c4fb7c172e",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 72: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "819f0989-1305-4ecb-bdea-e82233c34968",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 71: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "8869a0c2-8766-4990-9b3c-3d99872727ff",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 70: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "795a21b1-3fc2-4d95-84c2-62b871ec4e65",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 69: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "148b51f5-b0ac-48d1-9afe-5ed358242176",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 68: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "91c5d0ed-c15c-452e-897a-ce8e000f7490",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 67: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "bcff004d-8cc0-4164-a1c6-65d6f54cc154",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 66: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "156e6193-90f9-40f9-a3bd-955bd5d0e8aa",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 65: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "4c3df06f-6e82-4856-b504-2420a7304496",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 64: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "47ea1b7b-2005-4f61-b1fa-c21dba9162c9",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 63: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "da55e57f-8b92-4599-b294-133dfa54d618",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 62: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "c273977d-327d-4e73-b88c-4cd9c8447321",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 61: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "a4812390-b01d-4fb8-a604-b1e2f5fd71ec",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 60: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "750edff2-84b8-4a8b-9f5e-c7229bf4271a",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 59: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "b1c7ed93-ed86-4e17-81e2-be564fc783e2",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 58: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "7b65241b-b62a-423f-a980-664aa139ae98",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 57: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "94819ab0-68ad-4b63-a780-921231f10b9d",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 56: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "0711945f-43d5-4370-9cd5-0c7ed488da2f",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 55: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "17c68d85-6a9b-4978-966f-bace8318a23b",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 54: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "a3d8d932-c8aa-4a04-a207-0943ae32c939",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 53: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "cc55ec39-8fbf-4b3a-924c-d345982e959a",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 52: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "6377f17c-e346-4bde-b911-f10e74ab843f",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 51: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "08297516-160f-4304-9ab2-04a674f4b51d",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 50: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "33fbbe69-c690-4e16-91a0-3af7f20af6e7",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 49: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "ca335606-9a74-4ddc-b8e3-741cd54cde9c",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 48: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "6d2d83a3-ea13-4774-9d27-bee80a689745",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 17: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "84b39ee2-4457-40d9-af7e-eaac3930ec09",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 47: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "0ad6d02d-5973-4924-8066-9ff0e2715a9a",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 46: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "a0920c81-3d10-4f99-a15e-48c60e7741b4",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 45: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "5629abd7-c471-489d-aade-36425fab18f6",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 44: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "df2e4acb-4c87-419f-a7c9-75084a046e58",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 43: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "72c98c9e-3320-4f4d-a659-bf3ce200f935",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 42: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "0e552bbd-bd63-463e-ba16-4112f055e8d0",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 41: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "e92b5c06-33e6-43a4-86e0-e70ea169aea9",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 40: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "d83d9a75-6755-44f1-8ffb-6a6ec1f05abf",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 39: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "612e3493-45b9-4a18-95ce-7e7ee13b9075",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 38: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "846be314-ba7c-4b33-99bf-430b30300bb8",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 37: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "dbe80bb5-b27b-4aed-b475-9210ee87deed",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 36: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "d15051ed-2f00-4279-999b-419d900aafc2",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 35: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "5bc994d8-99a0-44af-b4ae-77436a52b5b6",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 34: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "6ef14404-6bfb-434f-9db2-9030d881d131",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 33: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "54c3b659-ae1d-42fc-a466-570688adfc59",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 32: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "0769942c-f79d-46c5-a866-ced111bd730a",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 31: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "9572e6c2-00a9-4ee1-92b6-c0b449a32728",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 30: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "5c23cf62-998b-4d8d-939d-007f5370848f",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 29: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "26131f44-d77b-467e-825e-ab06a16dadd9",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 28: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "3d6e86ae-b722-49c0-ac48-49fa69325604",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 18: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "03ae957e-e144-4845-8311-fc82760ad5a8",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 27: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "36ebea3f-8aa0-4c57-abe3-738af3cce918",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 26: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "22486f94-d20f-4912-b657-e7a98be82bf5",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 25: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "05125f0a-3997-4dcb-88d7-35ca8476a8c2",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 24: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "b3250d25-c203-4d6b-b58d-27748733c2e9",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 23: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "957fcfab-5863-45c8-9834-890cf20df676",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 22: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "20285d0b-ec4f-4a8d-81f9-694f38a893e4",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 21: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "3f37a3da-f1d1-4b75-a9da-b8bb2c1c8d10",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 20: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "980d2438-0aa2-40ae-a6b0-0fb52b23d2cf",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 16: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "c0dd2388-cd98-4e51-8a84-481c7aa8aaa5",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 15: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "6738e2ae-f6af-49a2-9651-ea4a303677f6",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 14: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "22f46dde-e53f-4b0c-b87f-2b998714f745",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 13: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "d036df92-f619-4009-af86-439b7d35bc99",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 12: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "946c572a-fc2e-4f5a-b4a1-c9517a7cb445",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 11: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "13323937-9e28-45ad-a2b6-b39282aece33",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Who scored the fastest hat-trick in Premier League history?",
    "options": [
      "Sadio Mané (2:56)",
      "Mohamed Salah (3:02)",
      "Alan Shearer (4:15)",
      "Robbie Fowler (4:33)"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "7bdc302c-447d-46fd-808c-5f37ba5f5f64",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Which club has the longest unbeaten streak in Champions League?",
    "options": [
      "Real Madrid (17)",
      "Barcelona (15)",
      "Bayern Munich (19)",
      "Arsenal (12)"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "b9c06e01-3b69-4984-82a1-0ccc48d6edde",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Who is the oldest player to score in a World Cup?",
    "options": [
      "Roger Milla (42)",
      "Pelé (37)",
      "Fabio Cannavaro (36)",
      "Buffon (40)"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "bff96265-3dff-4b63-bf88-db8070cfca22",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Which player scored the most goals in a single World Cup tournament?",
    "options": [
      "Just Fontaine (13 goals)",
      "Gerd Müller (10 goals)",
      "Pelé (6 goals)",
      "Ronaldo (8 goals)"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "326339ed-a735-4424-8abe-d5aaadf00d4f",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Who is the only player to score in 4 different Champions League finals?",
    "options": [
      "Cristiano Ronaldo",
      "Lionel Messi",
      "Raúl",
      "Karim Benzema"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "d77a54f3-45df-4796-a812-a0bf2b565861",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Which player has won the most Champions League titles?",
    "options": [
      "Cristiano Ronaldo (5)",
      "Paolo Maldini (5)",
      "Francisco Gento (6)",
      "Lionel Messi (4)"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "98ee5d14-524a-4e3d-88a9-9ad556e51ace",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 19: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "71189020-d923-4970-809e-c2d67db45e0d",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "What is the fastest goal in World Cup history?",
    "options": [
      "7.89 seconds",
      "11 seconds",
      "15 seconds",
      "20 seconds"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "e20c6115-0572-496d-8f80-6110a63db488",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Which player has scored in 5 different World Cups?",
    "options": [
      "Pelé",
      "Diego Maradona",
      "Cristiano Ronaldo",
      "Lionel Messi"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "e1ba75a6-7984-4b2e-afb3-3374f97907da",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Which goalkeeper has won the Ballon d'Or?",
    "options": [
      "Lev Yashin",
      "Gianluigi Buffon",
      "Manuel Neuer",
      "Iker Casillas"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "148f3abb-638d-46dd-bd27-a6dbcf8b38e7",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Who is the youngest player to score in a World Cup final?",
    "options": [
      "Pelé (17 years old)",
      "Kylian Mbappé (19 years old)",
      "Michael Owen (18 years old)",
      "Lionel Messi (21 years old)"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "a9d41000-ba17-469d-a646-2f92766713f7",
    "categoryId": "476c5563-2e0d-406b-b103-60784b120624",
    "question": "Hard question 100: Advanced football knowledge required.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 25
  },
  {
    "id": "afd77bba-77c9-4a8f-b363-769f4c773bb6",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Which country won the 2018 FIFA World Cup?",
    "options": [
      "Brazil",
      "Germany",
      "France",
      "Argentina"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "bcb51c14-2eeb-4026-9118-cfe8fdfef70f",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Who scored the most goals in World Cup history?",
    "options": [
      "Miroslav Klose",
      "Pelé",
      "Ronaldo Nazário",
      "Lionel Messi"
    ],
    "difficulty": "MEDIUM",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "80dae5c8-4b85-43f4-b26f-9eda1c2c55b2",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Which club has won the most Champions League titles?",
    "options": [
      "Barcelona",
      "Real Madrid",
      "AC Milan",
      "Bayern Munich"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "e70fd482-3245-4acc-9e4e-e5d54200b091",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Who won the 2022 World Cup?",
    "options": [
      "France",
      "Brazil",
      "Argentina",
      "Croatia"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "9294fbaf-2918-4fc5-9ad3-c53749c6fd56",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Which player has won the most Ballon d'Or awards?",
    "options": [
      "Cristiano Ronaldo",
      "Lionel Messi",
      "Pelé",
      "Diego Maradona"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "e2b2707d-4be0-41be-b611-fcc09f05c955",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "How many players on a football team?",
    "options": [
      "9",
      "10",
      "11",
      "12"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "19d8a5e9-42f3-4314-b773-840c0707ec78",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "How long is a football match?",
    "options": [
      "80 minutes",
      "90 minutes",
      "100 minutes",
      "120 minutes"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "c766391c-1a11-4ac0-aa0a-4c6152b0342c",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Which country won Euro 2020?",
    "options": [
      "France",
      "Italy",
      "Spain",
      "England"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "315ca3d9-2368-42b5-98d8-1c295779a0a9",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Who is the all-time top scorer in Champions League?",
    "options": [
      "Cristiano Ronaldo",
      "Lionel Messi",
      "Raúl",
      "Karim Benzema"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "db70b96e-6a1f-4bbc-8e75-27ab4c1225af",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Which league is known as Premier League?",
    "options": [
      "Spain",
      "England",
      "Germany",
      "Italy"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "0d108895-e034-4a18-86e6-838a918967d2",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "How many times did Brazil win the World Cup?",
    "options": [
      "3",
      "4",
      "5",
      "6"
    ],
    "difficulty": "MEDIUM",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "3d8169ae-3000-4b11-871d-9d571676b121",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Who won the Golden Boot in World Cup 2018?",
    "options": [
      "Kylian Mbappé",
      "Harry Kane",
      "Antoine Griezmann",
      "Luka Modrić"
    ],
    "difficulty": "MEDIUM",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "4bc0ecf8-2574-46eb-897b-82b3b384a568",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Which country hosted World Cup 2018?",
    "options": [
      "Qatar",
      "Russia",
      "Brazil",
      "South Africa"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "0568180c-1243-4715-8ae3-c95db77a80d1",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "What does VAR stand for?",
    "options": [
      "Video Assistant Referee",
      "Virtual Action Review",
      "Video Action Replay",
      "Virtual Assistant Referee"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "a8531e15-fb60-42e6-9baa-3125074119e2",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "How many substitutions allowed in a match?",
    "options": [
      "3",
      "5",
      "7",
      "Unlimited"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "665e8e15-c4aa-4e15-a96b-b76bd224f7b4",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Who won Champions League 2023?",
    "options": [
      "Manchester City",
      "Real Madrid",
      "Liverpool",
      "Bayern Munich"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "19dbe924-b036-424a-a7c9-b7146259ddca",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Which player has most goals in Premier League history?",
    "options": [
      "Alan Shearer",
      "Wayne Rooney",
      "Sergio Agüero",
      "Thierry Henry"
    ],
    "difficulty": "MEDIUM",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "bbc82735-ea3d-4b02-a581-3ac97fcdaf35",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "How many teams in Premier League?",
    "options": [
      "18",
      "20",
      "22",
      "24"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "cb7ff592-6384-4201-ba52-c4e179952f98",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Which country won World Cup 2014?",
    "options": [
      "Argentina",
      "Germany",
      "Brazil",
      "Netherlands"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "350f3fb6-58f5-44a9-aca6-80d68a1ecdeb",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Who scored fastest hat-trick in Premier League?",
    "options": [
      "Sadio Mané",
      "Mohamed Salah",
      "Sergio Agüero",
      "Alan Shearer"
    ],
    "difficulty": "HARD",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "a2e46193-6329-4127-a3ff-54cb17a0e9b9",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 21: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "ba972ebb-0a8c-41c2-81be-5167681c7c70",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 22: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "f07f0676-871d-4f3d-910b-a6db487c9539",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 23: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "ad6ee971-64c4-4b58-97c9-b6e96fab4bb4",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 24: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "8b56cded-03e9-4bc1-b079-012935cf8df8",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 25: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "9b9277cd-5fc4-44be-86fb-7f3802859bad",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 26: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "f5acbd9c-9203-4886-b2cb-7fbf7d76b042",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 27: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "cd131b38-3d71-4d02-9b32-38c9bc9dc418",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 28: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "860e7532-22ad-4fca-9262-20992871a2e3",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 29: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "66eb3f43-adcc-468a-bd78-70fd75d32120",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 30: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "92e2faff-a6d0-46d3-a444-730ac318d38f",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 31: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "0628dbe8-0ae8-4897-877b-3449b2e9773b",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 32: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "02bd61ab-d6fa-4e57-a9ab-72e42b8a27dc",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 33: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "b96f49dd-320b-4067-8d5a-e75bf554946a",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 34: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "8eb5485f-5c05-4fd0-8463-85f2800934ed",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 35: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "2bc5c061-91e1-4be2-b645-17a363cced93",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 36: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "91bd1541-4767-4fd6-8e26-d91603614dba",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 37: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "fd998f55-74c1-487b-84b1-640eddddbe24",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 38: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "99556228-a21c-4900-b15f-31e0745299df",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 39: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "7424e5dc-9cfb-45c9-9396-488abadcd761",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 40: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "1280d84f-cf0a-4451-93fc-5e8bc0384086",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 41: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "73380793-1ea5-4aa0-ae17-b74c0f98683d",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 42: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "e8a04dbc-f254-4b83-9190-96be9cda10d5",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 43: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "08657678-bb64-42fc-b120-efff2a6576d4",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 44: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "6202b7fa-bcb1-4be6-bcfc-c860514c7959",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 45: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "7ec7da5d-71b0-4108-abdb-cdbef7536b2e",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 46: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "654211c4-7a00-4c10-87e2-22202220b94a",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 47: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "3d0a2d0b-dcbf-429e-b455-c9bf66423060",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 48: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "69a35eb1-af6c-4eb8-b933-d9f76aa16212",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 49: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "5f8c8186-91c1-41d6-a8f7-80a331a9f511",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 50: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "8844ef14-6f37-468d-b94a-768d12390e60",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 51: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "ee749b46-eb70-4c38-a4d2-8f5a394e7ae3",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 52: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "7143f137-5811-4d8a-b4b4-94ebd3e58894",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 53: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "55e62dc4-fd97-45cd-be41-551135ba8478",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 54: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "d2467b07-566d-4b17-975a-ca24cb9bc14c",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 55: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "b6556e56-bbad-40fc-a766-3c0e7c736bc7",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 56: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "3b9038a8-a681-44d1-bb60-e64c71dd93bd",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 57: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "5988558a-17b0-49e8-803b-53ce4bb32736",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 58: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "e38d3a67-14f5-4ebf-8b44-ef5e39fbf9f0",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 59: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "d5836ab1-61ef-4053-a363-f944c70e6022",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 60: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "2d938e2b-e1c9-410d-84d5-566e54c2bf9b",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 61: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "046ff506-83da-424a-b463-e50c6dcca5fd",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 62: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "f579af48-07d8-40de-9dcf-297437937817",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 63: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "d4804253-67cc-410e-b012-0acbfe2d986a",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 64: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "133d5b40-f118-4590-b24b-47175d2a6d0d",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 65: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "b38cd70c-9e7b-4695-a92d-da3d4c914a65",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 66: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "68673428-d2ff-4fb1-873f-694cedd26878",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 67: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "dc561cc6-9e31-4fb4-b95c-831a59398d75",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 68: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "afc3c582-23e1-4452-a460-0ba4bfb292ea",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 69: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "b8498e05-6cb8-4614-9133-52bfb9960d69",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 70: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "ca52d500-21bb-485a-893b-b9a0425b46d3",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 71: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "7212f0ca-fb00-45bf-bf0a-dc2a53fb1060",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 72: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "9a4b87c6-9f43-41a2-b896-37382fca71a1",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 73: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "5ef98709-39e7-4ea2-8053-7c8fe3778bd3",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 74: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "5969330f-b905-4d86-9f8b-47317a63fc74",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 75: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "1168665e-08be-4342-8aa3-f8b1ca9a9bbf",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 76: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "56af2a23-a394-4031-868e-1205200107fb",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 77: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "1e402aa4-610f-41d2-b144-cb8649a95669",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 78: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "bc3362ae-b66b-47e1-b792-2fc3a888be04",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 79: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "8deb60ec-349d-473c-9d3a-bede272b6d20",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 80: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "a4f6fc16-0c25-4a98-a4e5-3b4c42ca3a0b",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 81: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "fee4bca1-d526-400a-a3a0-b3ea0c952cef",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 82: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "de1e61d8-4983-4cae-bcd9-8e4fa51a9f8d",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 83: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "9125f6af-e25b-4f57-b099-25155362b73d",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 84: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "693392c1-742e-4f54-8871-5adf1431c3a0",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 85: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "95fff26f-e432-4e54-8bdb-82bf0e4b3f54",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 86: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "0e926423-e912-4c54-b10f-9ecc42ab9247",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 87: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "692748d4-9796-4b9f-a3b2-cc311cade4d8",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 88: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "3de170c3-3502-488b-9afa-a76faf6d10fa",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 89: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "39d86921-53bd-49e0-8632-611bd766177b",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 90: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "9c7abdf2-a57f-461b-8a74-69561ea841c2",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 91: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "fa07dfa3-c678-4046-b2b6-b404304dc37c",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 92: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "db5c9105-aa43-452c-b315-a678f69eabb1",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 93: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "aa51057f-7ab5-4562-9fcb-f12946e94b72",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 94: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "4a8239a1-f102-4d11-9f2b-72de3bbb27b3",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 95: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "cdc891cf-4221-4a89-8320-a123e8a7da2f",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 96: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "2769c8bc-a5e7-4e19-8c65-d9b5481cf224",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 97: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "9f07d287-ba2c-4ad0-acd0-381fa5304e28",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 98: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "ca2689da-6c2f-4a63-b55a-91b6a4e88614",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 99: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "59d8a6fd-0171-441b-9ad6-d6a301410e20",
    "categoryId": "4fa29ec6-3a01-4452-a28a-8d38113efb0e",
    "question": "Quick question 100: Which team?",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 10
  },
  {
    "id": "5532b838-727c-4ac8-bc6f-3c4f8ceb1353",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am German, I am the youngest player to score in World Cup for Germany, and I play for Bayern Munich. Who am I? (Clue 100)",
    "options": [
      "Jamal Musiala",
      "Florian Wirtz",
      "Kai Havertz",
      "Leroy Sané"
    ],
    "difficulty": "HARD",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/357.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5bb8aafe-8a8b-4732-86d1-7324557686c6",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Spanish, I am 20 years old, and I play for Barcelona. Who am I? (Clue 99)",
    "options": [
      "Pedri",
      "Gavi",
      "Ansu Fati",
      "Ferran Torres"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/599.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b0407c0f-c7f0-4395-9982-0deea28b922f",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am Arsenal's star winger, and I won Young Player of the Year. Who am I? (Clue 98)",
    "options": [
      "Bukayo Saka",
      "Emile Smith Rowe",
      "Gabriel Martinelli",
      "Aaron Ramsdale"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/261.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "53345310-9feb-42ea-8cc2-9524f1db45a3",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Brazilian, I scored the winning goal in Champions League 2022 final, and I play for Real Madrid. Who am I? (Clue 97)",
    "options": [
      "Vinícius Júnior",
      "Rodrygo",
      "Neymar",
      "Gabriel Jesus"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/354.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5377d76d-f1b9-4f19-8d54-703aec9c1f50",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am 20 years old, and I play for Real Madrid. Who am I? (Clue 96)",
    "options": [
      "Jude Bellingham",
      "Phil Foden",
      "Bukayo Saka",
      "Declan Rice"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/353.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0c9925d3-cad1-419c-9461-e3e84b30deb0",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am South Korean, I won Premier League Golden Boot, and I play for Tottenham. Who am I? (Clue 95)",
    "options": [
      "Son Heung-min",
      "Park Ji-sung",
      "Lee Kang-in",
      "Kim Min-jae"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/258.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5be60361-f166-4c4d-9093-5c9b57025e4c",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Argentine, I won World Cup 2022, and I play for Inter Milan. Who am I? (Clue 94)",
    "options": [
      "Lautaro Martínez",
      "Paulo Dybala",
      "Giovani Lo Celso",
      "Leandro Paredes"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/594.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6045cf52-7e8f-4138-8bb7-eea51a934746",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am the all-time top scorer for Tottenham, and I am the England captain. Who am I? (Clue 93)",
    "options": [
      "Harry Kane",
      "Raheem Sterling",
      "Marcus Rashford",
      "Jadon Sancho"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/256.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "14069c88-8ca2-4249-b7d6-7a0f6f609ec9",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Senegalese, I won Champions League with Liverpool, and I now play for Bayern Munich. Who am I? (Clue 92)",
    "options": [
      "Sadio Mané",
      "Mohamed Salah",
      "Edouard Mendy",
      "Kalidou Koulibaly"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/349.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "bfc97e84-3b57-49f8-91c2-e02caabd4e04",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Brazilian, I am the most expensive player ever, and I play for PSG. Who am I? (Clue 91)",
    "options": [
      "Neymar",
      "Casemiro",
      "Vinícius Júnior",
      "Antony"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/346.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7a693624-01ad-4030-9edc-8aeb392a11d4",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Dutch, I am considered the best defender in the world, and I play for Liverpool. Who am I? (Clue 90)",
    "options": [
      "Virgil van Dijk",
      "Matthijs de Ligt",
      "Frenkie de Jong",
      "Memphis Depay"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/1440.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "31bfe57c-bdff-445d-bd2c-535832e84ca6",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Croatian, I won Ballon d'Or 2018, and I play for Real Madrid. Who am I? (Clue 89)",
    "options": [
      "Luka Modrić",
      "Ivan Rakitić",
      "Mateo Kovačić",
      "Mario Mandžukić"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/323.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f1bd8577-4be6-40ea-a7cd-36d145a713c6",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Belgian, I am the best playmaker in Premier League, and I play for Manchester City. Who am I? (Clue 88)",
    "options": [
      "Kevin De Bruyne",
      "Eden Hazard",
      "Romelu Lukaku",
      "Thibaut Courtois"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/313.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d0601898-0edf-4adc-a0d0-19fc6c064bb0",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Polish, I scored 41 goals in a Bundesliga season, and I play for Barcelona. Who am I? (Clue 87)",
    "options": [
      "Robert Lewandowski",
      "Wojciech Szczęsny",
      "Arkadiusz Milik",
      "Krzysztof Piątek"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/587.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5849dcad-d1a5-4ad7-b37e-8b2864207258",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am French, I won Ballon d'Or 2022, and I play for Real Madrid. Who am I? (Clue 86)",
    "options": [
      "Karim Benzema",
      "Kylian Mbappé",
      "Antoine Griezmann",
      "Olivier Giroud"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/343.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "70cf389f-7341-41b7-9c9d-d21aa8933318",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Norwegian, I scored 36 goals in Premier League in my first season, and I play for Manchester City. Who am I? (Clue 85)",
    "options": [
      "Erling Haaland",
      "Martin Ødegaard",
      "Mohamed Salah",
      "Harry Kane"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/110126.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7106de57-36ed-4d8c-b333-bde3cc66b8a6",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am French, I won the 2018 World Cup, and I am the youngest player to score in a World Cup final. Who am I? (Clue 84)",
    "options": [
      "Kylian Mbappé",
      "Antoine Griezmann",
      "Paul Pogba",
      "N'Golo Kanté"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/341.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "639a1b96-12c0-4b5a-8f04-11e74fd8b14f",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Argentine, I won 7 Ballon d'Or awards, and I play for PSG. Who am I? (Clue 83)",
    "options": [
      "Lionel Messi",
      "Diego Maradona",
      "Ángel Di María",
      "Sergio Agüero"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/216.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2cb7574a-1e87-4c8a-972b-4fa11bf5ae07",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Portuguese, I won 5 Champions League titles, and I am the all-time top scorer. Who am I? (Clue 82)",
    "options": [
      "Cristiano Ronaldo",
      "Luis Figo",
      "Pepe",
      "Bruno Fernandes"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/337.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "19b842ce-d17b-42b6-bbdc-a71645c05eae",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Egyptian, I play for Liverpool, and I won the Premier League Golden Boot. Who am I? (Clue 81)",
    "options": [
      "Mohamed Salah",
      "Mohamed Elneny",
      "Mahmoud Trezeguet",
      "Ahmed Hegazi"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/336.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2cfd3b05-7d2d-4fdf-bcb5-a0bf68b59c0e",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am German, I am the youngest player to score in World Cup for Germany, and I play for Bayern Munich. Who am I? (Clue 80)",
    "options": [
      "Jamal Musiala",
      "Florian Wirtz",
      "Kai Havertz",
      "Leroy Sané"
    ],
    "difficulty": "HARD",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/337.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "05827fc3-84ac-479e-a6ee-455071ac95f0",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Spanish, I am 20 years old, and I play for Barcelona. Who am I? (Clue 79)",
    "options": [
      "Pedri",
      "Gavi",
      "Ansu Fati",
      "Ferran Torres"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/579.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1548b258-da5a-47ad-9d8a-af731405bf38",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am Arsenal's star winger, and I won Young Player of the Year. Who am I? (Clue 78)",
    "options": [
      "Bukayo Saka",
      "Emile Smith Rowe",
      "Gabriel Martinelli",
      "Aaron Ramsdale"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/241.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3b80e11f-c755-40e7-ac9f-77a7a8b452ae",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Brazilian, I scored the winning goal in Champions League 2022 final, and I play for Real Madrid. Who am I? (Clue 77)",
    "options": [
      "Vinícius Júnior",
      "Rodrygo",
      "Neymar",
      "Gabriel Jesus"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/334.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e2cebafa-2644-46bd-a180-81b062278b0c",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am 20 years old, and I play for Real Madrid. Who am I? (Clue 76)",
    "options": [
      "Jude Bellingham",
      "Phil Foden",
      "Bukayo Saka",
      "Declan Rice"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/333.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "307ed655-9a68-4a9c-9198-fd4cc2b7392e",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am South Korean, I won Premier League Golden Boot, and I play for Tottenham. Who am I? (Clue 75)",
    "options": [
      "Son Heung-min",
      "Park Ji-sung",
      "Lee Kang-in",
      "Kim Min-jae"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/238.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "178a564c-db6f-43bf-a588-b429a7b72a8b",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Argentine, I won World Cup 2022, and I play for Inter Milan. Who am I? (Clue 74)",
    "options": [
      "Lautaro Martínez",
      "Paulo Dybala",
      "Giovani Lo Celso",
      "Leandro Paredes"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/574.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "aec6b271-79b3-43db-8433-2551369ffa9c",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am the all-time top scorer for Tottenham, and I am the England captain. Who am I? (Clue 73)",
    "options": [
      "Harry Kane",
      "Raheem Sterling",
      "Marcus Rashford",
      "Jadon Sancho"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/236.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "4605347b-1eea-4d13-89dd-f49af3f2f05d",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Senegalese, I won Champions League with Liverpool, and I now play for Bayern Munich. Who am I? (Clue 72)",
    "options": [
      "Sadio Mané",
      "Mohamed Salah",
      "Edouard Mendy",
      "Kalidou Koulibaly"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/329.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6abe46f6-eb65-48d8-a30b-b059b0a4972d",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Brazilian, I am the most expensive player ever, and I play for PSG. Who am I? (Clue 71)",
    "options": [
      "Neymar",
      "Casemiro",
      "Vinícius Júnior",
      "Antony"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/326.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b2fef8ab-14c9-4303-b7aa-3d72059df24f",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Dutch, I am considered the best defender in the world, and I play for Liverpool. Who am I? (Clue 70)",
    "options": [
      "Virgil van Dijk",
      "Matthijs de Ligt",
      "Frenkie de Jong",
      "Memphis Depay"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/1420.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b03ff081-ffe4-4950-aa67-a55db5a9bfac",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Croatian, I won Ballon d'Or 2018, and I play for Real Madrid. Who am I? (Clue 69)",
    "options": [
      "Luka Modrić",
      "Ivan Rakitić",
      "Mateo Kovačić",
      "Mario Mandžukić"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/303.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ff29f798-d738-43d1-8e7b-52e6ccce3a45",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Belgian, I am the best playmaker in Premier League, and I play for Manchester City. Who am I? (Clue 68)",
    "options": [
      "Kevin De Bruyne",
      "Eden Hazard",
      "Romelu Lukaku",
      "Thibaut Courtois"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/293.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5fdf9075-dcd5-4a2e-9ea6-4301fe737e61",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Polish, I scored 41 goals in a Bundesliga season, and I play for Barcelona. Who am I? (Clue 67)",
    "options": [
      "Robert Lewandowski",
      "Wojciech Szczęsny",
      "Arkadiusz Milik",
      "Krzysztof Piątek"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/567.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f8f91e7b-168c-41e0-b6fc-51c656d3a3d0",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am French, I won Ballon d'Or 2022, and I play for Real Madrid. Who am I? (Clue 66)",
    "options": [
      "Karim Benzema",
      "Kylian Mbappé",
      "Antoine Griezmann",
      "Olivier Giroud"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/323.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "dd4aebaf-c4ff-4073-9b95-7c12a82aa6e8",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Norwegian, I scored 36 goals in Premier League in my first season, and I play for Manchester City. Who am I? (Clue 65)",
    "options": [
      "Erling Haaland",
      "Martin Ødegaard",
      "Mohamed Salah",
      "Harry Kane"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/110106.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "426e4a7f-4eef-4d4a-a396-210ae4a09f6a",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am French, I won the 2018 World Cup, and I am the youngest player to score in a World Cup final. Who am I? (Clue 64)",
    "options": [
      "Kylian Mbappé",
      "Antoine Griezmann",
      "Paul Pogba",
      "N'Golo Kanté"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/321.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d5d336e2-32b3-4635-8854-621cdd646b54",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Argentine, I won 7 Ballon d'Or awards, and I play for PSG. Who am I? (Clue 63)",
    "options": [
      "Lionel Messi",
      "Diego Maradona",
      "Ángel Di María",
      "Sergio Agüero"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/196.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ee6e87b7-7ae6-4a74-b22d-0eaa13e17923",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Portuguese, I won 5 Champions League titles, and I am the all-time top scorer. Who am I? (Clue 62)",
    "options": [
      "Cristiano Ronaldo",
      "Luis Figo",
      "Pepe",
      "Bruno Fernandes"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/317.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0c63ed0a-197c-4d85-abde-ce18f3523ebc",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Egyptian, I play for Liverpool, and I won the Premier League Golden Boot. Who am I? (Clue 61)",
    "options": [
      "Mohamed Salah",
      "Mohamed Elneny",
      "Mahmoud Trezeguet",
      "Ahmed Hegazi"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/316.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "131ee251-a31b-4dc7-a04a-7fd3eb6433ef",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am German, I am the youngest player to score in World Cup for Germany, and I play for Bayern Munich. Who am I? (Clue 60)",
    "options": [
      "Jamal Musiala",
      "Florian Wirtz",
      "Kai Havertz",
      "Leroy Sané"
    ],
    "difficulty": "HARD",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/317.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1d505988-9155-4e00-8bea-30ab112444db",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Spanish, I am 20 years old, and I play for Barcelona. Who am I? (Clue 59)",
    "options": [
      "Pedri",
      "Gavi",
      "Ansu Fati",
      "Ferran Torres"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/559.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ee132381-9531-4348-ab1a-dec3ad495ea3",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am Arsenal's star winger, and I won Young Player of the Year. Who am I? (Clue 58)",
    "options": [
      "Bukayo Saka",
      "Emile Smith Rowe",
      "Gabriel Martinelli",
      "Aaron Ramsdale"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/221.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3134ed2a-1837-49c2-8c32-156f1937ecbe",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Brazilian, I scored the winning goal in Champions League 2022 final, and I play for Real Madrid. Who am I? (Clue 57)",
    "options": [
      "Vinícius Júnior",
      "Rodrygo",
      "Neymar",
      "Gabriel Jesus"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/314.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7cbcc246-5ae4-4556-b7e4-031cd25330b1",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am 20 years old, and I play for Real Madrid. Who am I? (Clue 56)",
    "options": [
      "Jude Bellingham",
      "Phil Foden",
      "Bukayo Saka",
      "Declan Rice"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/313.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "497cbce0-bcdc-49c0-8b30-f7637e2fbaeb",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am South Korean, I won Premier League Golden Boot, and I play for Tottenham. Who am I? (Clue 55)",
    "options": [
      "Son Heung-min",
      "Park Ji-sung",
      "Lee Kang-in",
      "Kim Min-jae"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/218.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "9e09aaa1-cbf6-4d76-b6f3-e524d44a338c",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Argentine, I won World Cup 2022, and I play for Inter Milan. Who am I? (Clue 54)",
    "options": [
      "Lautaro Martínez",
      "Paulo Dybala",
      "Giovani Lo Celso",
      "Leandro Paredes"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/554.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "cec1b449-defb-4218-87ce-494ac92729cf",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am the all-time top scorer for Tottenham, and I am the England captain. Who am I? (Clue 53)",
    "options": [
      "Harry Kane",
      "Raheem Sterling",
      "Marcus Rashford",
      "Jadon Sancho"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/216.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c6bf675e-e0e1-4e4c-8f1a-5a98aae7c2cc",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Senegalese, I won Champions League with Liverpool, and I now play for Bayern Munich. Who am I? (Clue 52)",
    "options": [
      "Sadio Mané",
      "Mohamed Salah",
      "Edouard Mendy",
      "Kalidou Koulibaly"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/309.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f106d3df-5307-4ee1-8a77-14436f589348",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Brazilian, I am the most expensive player ever, and I play for PSG. Who am I? (Clue 51)",
    "options": [
      "Neymar",
      "Casemiro",
      "Vinícius Júnior",
      "Antony"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/306.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "acbe35b5-ec82-43a2-a9f0-edee4fc7cb73",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Dutch, I am considered the best defender in the world, and I play for Liverpool. Who am I? (Clue 50)",
    "options": [
      "Virgil van Dijk",
      "Matthijs de Ligt",
      "Frenkie de Jong",
      "Memphis Depay"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/1400.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "47bf758e-8bc0-4c49-a75e-6527d5caa341",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Croatian, I won Ballon d'Or 2018, and I play for Real Madrid. Who am I? (Clue 49)",
    "options": [
      "Luka Modrić",
      "Ivan Rakitić",
      "Mateo Kovačić",
      "Mario Mandžukić"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/283.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b4d9db8a-1d01-449f-bf53-baffe32991bc",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Belgian, I am the best playmaker in Premier League, and I play for Manchester City. Who am I? (Clue 48)",
    "options": [
      "Kevin De Bruyne",
      "Eden Hazard",
      "Romelu Lukaku",
      "Thibaut Courtois"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/273.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8129c96d-16b5-4a26-bde9-04dd6f3ce526",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Polish, I scored 41 goals in a Bundesliga season, and I play for Barcelona. Who am I? (Clue 47)",
    "options": [
      "Robert Lewandowski",
      "Wojciech Szczęsny",
      "Arkadiusz Milik",
      "Krzysztof Piątek"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/547.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1b06403e-d60b-4a2e-886b-8f8900af164a",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am French, I won Ballon d'Or 2022, and I play for Real Madrid. Who am I? (Clue 46)",
    "options": [
      "Karim Benzema",
      "Kylian Mbappé",
      "Antoine Griezmann",
      "Olivier Giroud"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/303.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "23e1c305-51e6-4fdc-a068-1a83ac93c9ef",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Norwegian, I scored 36 goals in Premier League in my first season, and I play for Manchester City. Who am I? (Clue 45)",
    "options": [
      "Erling Haaland",
      "Martin Ødegaard",
      "Mohamed Salah",
      "Harry Kane"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/110086.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0e6fc20a-da7d-448c-aac8-ba2db4360794",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am French, I won the 2018 World Cup, and I am the youngest player to score in a World Cup final. Who am I? (Clue 44)",
    "options": [
      "Kylian Mbappé",
      "Antoine Griezmann",
      "Paul Pogba",
      "N'Golo Kanté"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/301.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2d583853-6447-4c54-999a-47d1983c8427",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Argentine, I won 7 Ballon d'Or awards, and I play for PSG. Who am I? (Clue 43)",
    "options": [
      "Lionel Messi",
      "Diego Maradona",
      "Ángel Di María",
      "Sergio Agüero"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/176.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ee6b8114-1c65-45aa-81a3-4b49a0c2ffd6",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Portuguese, I won 5 Champions League titles, and I am the all-time top scorer. Who am I? (Clue 42)",
    "options": [
      "Cristiano Ronaldo",
      "Luis Figo",
      "Pepe",
      "Bruno Fernandes"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/297.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "becd08ae-b4ab-4b51-a6bb-167202e11151",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Egyptian, I play for Liverpool, and I won the Premier League Golden Boot. Who am I? (Clue 41)",
    "options": [
      "Mohamed Salah",
      "Mohamed Elneny",
      "Mahmoud Trezeguet",
      "Ahmed Hegazi"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/296.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "9d5a6d2b-2ae7-4381-a47b-539ad83eeed5",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am German, I am the youngest player to score in World Cup for Germany, and I play for Bayern Munich. Who am I? (Clue 40)",
    "options": [
      "Jamal Musiala",
      "Florian Wirtz",
      "Kai Havertz",
      "Leroy Sané"
    ],
    "difficulty": "HARD",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/297.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2f3098ff-60cf-4df9-8d84-71726fe09c68",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Spanish, I am 20 years old, and I play for Barcelona. Who am I? (Clue 39)",
    "options": [
      "Pedri",
      "Gavi",
      "Ansu Fati",
      "Ferran Torres"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/539.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "612c721f-9b5a-45fa-aadd-faaafd0aa81c",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am Arsenal's star winger, and I won Young Player of the Year. Who am I? (Clue 38)",
    "options": [
      "Bukayo Saka",
      "Emile Smith Rowe",
      "Gabriel Martinelli",
      "Aaron Ramsdale"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/201.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1b858c85-ef47-4e11-9880-3b4970e00db9",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Brazilian, I scored the winning goal in Champions League 2022 final, and I play for Real Madrid. Who am I? (Clue 37)",
    "options": [
      "Vinícius Júnior",
      "Rodrygo",
      "Neymar",
      "Gabriel Jesus"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/294.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0579fe99-caf8-4b1d-8a61-6ee7f6fb1ab8",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am 20 years old, and I play for Real Madrid. Who am I? (Clue 36)",
    "options": [
      "Jude Bellingham",
      "Phil Foden",
      "Bukayo Saka",
      "Declan Rice"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/293.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c475986f-5aac-4055-af61-6d9b7b9a894f",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am South Korean, I won Premier League Golden Boot, and I play for Tottenham. Who am I? (Clue 35)",
    "options": [
      "Son Heung-min",
      "Park Ji-sung",
      "Lee Kang-in",
      "Kim Min-jae"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/198.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "fc747d2b-bd83-4053-84b9-cd24417369d0",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Argentine, I won World Cup 2022, and I play for Inter Milan. Who am I? (Clue 34)",
    "options": [
      "Lautaro Martínez",
      "Paulo Dybala",
      "Giovani Lo Celso",
      "Leandro Paredes"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/534.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b19a4c42-a481-4ecd-8120-eb885cc9a393",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am the all-time top scorer for Tottenham, and I am the England captain. Who am I? (Clue 33)",
    "options": [
      "Harry Kane",
      "Raheem Sterling",
      "Marcus Rashford",
      "Jadon Sancho"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/196.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ac66e4ae-7b81-4d94-b424-ceeb709e04b0",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Senegalese, I won Champions League with Liverpool, and I now play for Bayern Munich. Who am I? (Clue 32)",
    "options": [
      "Sadio Mané",
      "Mohamed Salah",
      "Edouard Mendy",
      "Kalidou Koulibaly"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/289.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1e18eb87-65b4-4853-8186-c9cff74dc093",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Brazilian, I am the most expensive player ever, and I play for PSG. Who am I? (Clue 31)",
    "options": [
      "Neymar",
      "Casemiro",
      "Vinícius Júnior",
      "Antony"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/286.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e3d0c326-132a-4bf5-b5eb-e12aac705015",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Dutch, I am considered the best defender in the world, and I play for Liverpool. Who am I? (Clue 30)",
    "options": [
      "Virgil van Dijk",
      "Matthijs de Ligt",
      "Frenkie de Jong",
      "Memphis Depay"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/1380.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f977ef75-08ac-49d9-b560-963bdd37cc24",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Croatian, I won Ballon d'Or 2018, and I play for Real Madrid. Who am I? (Clue 29)",
    "options": [
      "Luka Modrić",
      "Ivan Rakitić",
      "Mateo Kovačić",
      "Mario Mandžukić"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/263.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "156b0b84-e6b7-4a75-afb9-6c747df2f9ff",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Belgian, I am the best playmaker in Premier League, and I play for Manchester City. Who am I? (Clue 28)",
    "options": [
      "Kevin De Bruyne",
      "Eden Hazard",
      "Romelu Lukaku",
      "Thibaut Courtois"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/253.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a9ef9531-4663-48e6-b13f-c4be7cc764a6",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Polish, I scored 41 goals in a Bundesliga season, and I play for Barcelona. Who am I? (Clue 27)",
    "options": [
      "Robert Lewandowski",
      "Wojciech Szczęsny",
      "Arkadiusz Milik",
      "Krzysztof Piątek"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/527.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "cc8068f2-cf93-4850-b2d6-f0b38aa178e7",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am French, I won Ballon d'Or 2022, and I play for Real Madrid. Who am I? (Clue 26)",
    "options": [
      "Karim Benzema",
      "Kylian Mbappé",
      "Antoine Griezmann",
      "Olivier Giroud"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/283.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "331b91eb-a295-4db7-90d9-fefc544b36ae",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Norwegian, I scored 36 goals in Premier League in my first season, and I play for Manchester City. Who am I? (Clue 25)",
    "options": [
      "Erling Haaland",
      "Martin Ødegaard",
      "Mohamed Salah",
      "Harry Kane"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/110066.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1b289238-687f-4c75-b0bc-e9fc25e658ac",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am French, I won the 2018 World Cup, and I am the youngest player to score in a World Cup final. Who am I? (Clue 24)",
    "options": [
      "Kylian Mbappé",
      "Antoine Griezmann",
      "Paul Pogba",
      "N'Golo Kanté"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/281.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "49ae85c8-9982-4bde-a123-493e247549f3",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Argentine, I won 7 Ballon d'Or awards, and I play for PSG. Who am I? (Clue 23)",
    "options": [
      "Lionel Messi",
      "Diego Maradona",
      "Ángel Di María",
      "Sergio Agüero"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/156.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c224807e-e31d-4ad6-a331-0ec426981d3e",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Portuguese, I won 5 Champions League titles, and I am the all-time top scorer. Who am I? (Clue 22)",
    "options": [
      "Cristiano Ronaldo",
      "Luis Figo",
      "Pepe",
      "Bruno Fernandes"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/277.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a6152c08-ac79-4250-bb35-e564b81218fd",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Egyptian, I play for Liverpool, and I won the Premier League Golden Boot. Who am I? (Clue 21)",
    "options": [
      "Mohamed Salah",
      "Mohamed Elneny",
      "Mahmoud Trezeguet",
      "Ahmed Hegazi"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/276.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "87bdcd64-262a-43f7-b5e9-5947dabc2707",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am German, I am the youngest player to score in World Cup for Germany, and I play for Bayern Munich. Who am I?",
    "options": [
      "Jamal Musiala",
      "Florian Wirtz",
      "Kai Havertz",
      "Leroy Sané"
    ],
    "difficulty": "HARD",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/278.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2286629e-1299-4f04-9320-15862f585b37",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Spanish, I am 20 years old, and I play for Barcelona. Who am I?",
    "options": [
      "Pedri",
      "Gavi",
      "Ansu Fati",
      "Ferran Torres"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/521.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "973985d5-d8f9-4ceb-aa07-4edf9d5ccd3f",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am Arsenal's star winger, and I won Young Player of the Year. Who am I?",
    "options": [
      "Bukayo Saka",
      "Emile Smith Rowe",
      "Gabriel Martinelli",
      "Aaron Ramsdale"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/184.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "4f516b5b-e2d1-46a3-a4f3-9bea7f4a6cca",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Brazilian, I scored the winning goal in Champions League 2022 final, and I play for Real Madrid. Who am I?",
    "options": [
      "Vinícius Júnior",
      "Rodrygo",
      "Neymar",
      "Gabriel Jesus"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/278.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "779f4d92-cca0-4bfb-9b43-9fedecfa5969",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am 20 years old, and I play for Real Madrid. Who am I?",
    "options": [
      "Jude Bellingham",
      "Phil Foden",
      "Bukayo Saka",
      "Declan Rice"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/278.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "231ed3fb-ccc8-4778-a23e-1e13e2b7b904",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am South Korean, I won Premier League Golden Boot, and I play for Tottenham. Who am I?",
    "options": [
      "Son Heung-min",
      "Park Ji-sung",
      "Lee Kang-in",
      "Kim Min-jae"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/184.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7d621511-78b0-42ff-ae71-8c97ed38a74a",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Argentine, I won World Cup 2022, and I play for Inter Milan. Who am I?",
    "options": [
      "Lautaro Martínez",
      "Paulo Dybala",
      "Giovani Lo Celso",
      "Leandro Paredes"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/521.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5c063fb4-7752-46c5-b705-db4ecc170288",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am English, I am the all-time top scorer for Tottenham, and I am the England captain. Who am I?",
    "options": [
      "Harry Kane",
      "Raheem Sterling",
      "Marcus Rashford",
      "Jadon Sancho"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/184.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "842a2e74-c5b9-48b3-bc4c-5d1548950769",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Senegalese, I won Champions League with Liverpool, and I now play for Bayern Munich. Who am I?",
    "options": [
      "Sadio Mané",
      "Mohamed Salah",
      "Edouard Mendy",
      "Kalidou Koulibaly"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/278.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "31b31e76-eaae-47de-8ffa-034d219a683b",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Brazilian, I am the most expensive player ever, and I play for PSG. Who am I?",
    "options": [
      "Neymar",
      "Casemiro",
      "Vinícius Júnior",
      "Antony"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/276.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ec2c37c2-f26e-4b68-b506-2ec6ef72cc77",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Dutch, I am considered the best defender in the world, and I play for Liverpool. Who am I?",
    "options": [
      "Virgil van Dijk",
      "Matthijs de Ligt",
      "Frenkie de Jong",
      "Memphis Depay"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/1371.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d0b2623e-d35f-4c97-91df-19c8f03d62a9",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Croatian, I won Ballon d'Or 2018, and I play for Real Madrid. Who am I?",
    "options": [
      "Luka Modrić",
      "Ivan Rakitić",
      "Mateo Kovačić",
      "Mario Mandžukić"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/255.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "30ca2b8e-7083-4897-9446-befba2bf7053",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Belgian, I am the best playmaker in Premier League, and I play for Manchester City. Who am I?",
    "options": [
      "Kevin De Bruyne",
      "Eden Hazard",
      "Romelu Lukaku",
      "Thibaut Courtois"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/246.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8150c32a-e374-47f4-bb88-8b4cb5751af6",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Polish, I scored 41 goals in a Bundesliga season, and I play for Barcelona. Who am I?",
    "options": [
      "Robert Lewandowski",
      "Wojciech Szczęsny",
      "Arkadiusz Milik",
      "Krzysztof Piątek"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/521.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e57d92cf-dfb7-4e58-93c8-c52364a851fb",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am French, I won Ballon d'Or 2022, and I play for Real Madrid. Who am I?",
    "options": [
      "Karim Benzema",
      "Kylian Mbappé",
      "Antoine Griezmann",
      "Olivier Giroud"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/278.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "923b4e91-e2fa-417e-ab49-3e317b279349",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Norwegian, I scored 36 goals in Premier League in my first season, and I play for Manchester City. Who am I?",
    "options": [
      "Erling Haaland",
      "Martin Ødegaard",
      "Mohamed Salah",
      "Harry Kane"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/110062.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a6e46fe3-3f00-4afd-a5d2-8f932b8b964b",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am French, I won the 2018 World Cup, and I am the youngest player to score in a World Cup final. Who am I?",
    "options": [
      "Kylian Mbappé",
      "Antoine Griezmann",
      "Paul Pogba",
      "N'Golo Kanté"
    ],
    "difficulty": "MEDIUM",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/278.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "01b47606-ee39-433f-9b06-4d56db526dc8",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Argentine, I won 7 Ballon d'Or awards, and I play for PSG. Who am I?",
    "options": [
      "Lionel Messi",
      "Diego Maradona",
      "Ángel Di María",
      "Sergio Agüero"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/154.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6a79b6c8-2ef6-4751-99d5-69d38b9c809e",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Portuguese, I won 5 Champions League titles, and I am the all-time top scorer. Who am I?",
    "options": [
      "Cristiano Ronaldo",
      "Luis Figo",
      "Pepe",
      "Bruno Fernandes"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/276.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d2f548d7-0da6-4538-b178-a85f35bf93b6",
    "categoryId": "5bd54170-2e8f-402c-a4da-bf1d09098027",
    "question": "I am Egyptian, I play for Liverpool, and I won the Premier League Golden Boot. Who am I?",
    "options": [
      "Mohamed Salah",
      "Mohamed Elneny",
      "Mahmoud Trezeguet",
      "Ahmed Hegazi"
    ],
    "difficulty": "EASY",
    "points": 15,
    "imageUrl": "https://media.api-sports.io/football/players/276.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f6f99e65-a393-4a7a-979e-722705f8f856",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "How many World Cups has Brazil won?",
    "options": [
      "3",
      "4",
      "5",
      "6"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "bd7447a3-5373-43fd-8077-681bdfe70459",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "How many goals did Pelé score in his career?",
    "options": [
      "Over 1000",
      "Over 800",
      "Over 600",
      "Over 400"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "029be08d-70e5-4827-96bb-3867cb6082e1",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 99: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "19b0b582-83d0-4d8f-b4d4-f35ecb813514",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 98: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "55267657-2f63-4b09-a930-dce9170a1709",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 97: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "fdf0cce0-a57e-4c87-b0a9-1c1770749386",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 96: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "738b19ec-5e87-4162-9567-b09565a9d8a2",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 95: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "920e9faa-8365-4386-89c8-637c79adaeb1",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 94: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "35252dee-b821-4212-bee0-e0793588429e",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 93: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5892f2c0-28a2-4d53-87a9-440899254c28",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 92: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0e3c04f8-0cfd-4e67-bf06-8b83d4b17fc7",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 91: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "52cf9b9b-ff7b-4f1f-bf40-08d28b94aa36",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 90: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8358958f-dabe-459d-854d-2e16ab87dc4f",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 89: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1af3a0ed-fbf3-48ea-855d-6690a91099d0",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 88: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "41566761-788d-445c-a901-e55eab6a3c80",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 87: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e483c5d7-b45d-422a-a4ae-8a6934380a68",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 86: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "11aa85b1-6c87-45ec-b8fa-d40ecd68208f",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 85: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7446ad73-09eb-4004-981c-f8f988844496",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 84: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "349407f1-de4a-499d-9086-76c63ed28789",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 83: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e027854b-97a3-48bf-a111-35762071909b",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 82: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ca239141-ff42-4eee-8106-4cc59195e98a",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 81: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6e586299-99e5-4ff1-a019-3223ac9a210d",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 80: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "98941e40-9bdf-4815-b521-f65d8965aa81",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 79: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f08ef829-8cda-4927-a87c-8cecddf6b4b7",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 78: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "523e394c-706d-4541-ad5d-47954d951123",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 77: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3778570a-a72a-47e9-8d7b-3a5dd913f353",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 76: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c7b7936c-7eca-4625-b3cf-08725846ce45",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 75: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "db300fe1-9e65-434c-81cb-161505ec3209",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 74: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "36e761c2-a2ef-471e-9b0a-58084b9dbeb5",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 73: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "279b38d0-f348-45bb-a63c-a00ff818e2b7",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 72: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7194b387-60d3-4df1-9883-589c039f09ec",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 71: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1beccf4a-8063-4b4c-9850-268953fa2ba8",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 70: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f05c9e48-1871-4bdc-bf52-d04e4f1adccf",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 69: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6304c5e9-42e4-4518-bf03-d5e3b589e56d",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 68: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "66368335-5c0c-4bd1-bad6-b055d53d9e9e",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 67: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "705395f9-78fb-4495-a629-09d0f002a6e9",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 66: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "88c6d403-b957-4d1a-92f5-65c3307badce",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 65: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e3f898b1-f003-48c7-9198-b08fd0569be2",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 64: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b6c21c28-c2d3-450c-b740-75f88f3cc24b",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 63: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "bc4eba3b-f5a5-49d9-8479-d10d41a3421b",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 62: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "cadd3553-a27b-4544-bc81-c5ea05550a4f",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 61: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b6cdb1cf-820d-41b7-a997-566383a499a8",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 60: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "bc4c4c6d-2586-4bae-b84a-2c6e06a67836",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 59: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c93e96b1-6113-40c8-92b6-8d243e8a7ab6",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 58: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c57ebe6e-41a4-46a8-ba16-935c446c36c4",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 57: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0f57770a-ff14-4e11-b5cd-613b871034a5",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 56: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "481b29d3-47c9-4422-b20d-37d40bf72fd9",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 55: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "fbed954e-78c6-43ec-8679-b75df62b8f26",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 54: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "68a38ed7-9c8e-4687-be87-c97c0db6f73f",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 53: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6ac52400-fc27-46e3-9158-fb611b61a5ab",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 52: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b60f54de-bad6-4982-8fa2-31267a7a6714",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 51: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1c6c27f9-a8c6-401a-ae79-4ced9307ce43",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 50: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ad370a84-5ca0-41eb-970a-dbb5fd4e372b",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 49: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3b49fb1a-09e9-4444-a48c-a3a8a54d1b6e",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 48: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f35e240e-ec29-48f2-bc51-b8a35eabea90",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "How many teams participate in World Cup?",
    "options": [
      "32",
      "36",
      "40",
      "48"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "172807a3-c0d8-44fc-b5c9-56c4de81bd3c",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 47: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "98b2e470-4f41-4b28-a13e-6465319e83eb",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 46: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "05889285-865d-4d47-87b4-c695724d9536",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 45: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "eb315de8-d03c-41c1-b49a-2a4f810a0e61",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 44: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "948c6dac-e258-4406-a449-e1e1c511d830",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 43: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "56333bae-14bc-439f-bd69-15eef07819dd",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 42: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "9e789865-669e-4e34-93d7-625af3beb65e",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 41: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "4baeba4c-6a39-481d-9130-e7ee4f4000ec",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 40: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "47b7a5fc-b1ba-4f58-ae9b-701bb45a6a1c",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 39: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "cd05b74b-abb2-4754-b0dd-15d21bcc0eda",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 38: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6b1b43ec-1a0b-4943-b838-2a8d6e5d1e91",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 37: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "77dc9d96-f009-4990-8af9-4b0979e0ff77",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 36: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8e6d1a58-d5a5-443e-8ade-f1d61066a982",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 35: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2062d600-a153-4b08-8785-fc0eb8421f4a",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 34: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1325573e-8d9d-4083-991e-991ff2e97c30",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 33: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b9112430-c8f6-40a7-896a-3022d9e08df1",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 32: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2f9e0815-3f1a-4c00-94db-23e8f2cd10e2",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 31: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "cc53e5a1-69bc-40fb-bfa9-cb597d84315c",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 30: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a311c110-422b-4b3e-930e-d45067adea05",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 29: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3a2c5087-35c5-4972-b397-e45b5bd8d9d5",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 28: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2b1efc40-89b4-4c77-93fb-5fd420b9a88d",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 27: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5cbaa63c-e389-4e05-b520-7402f14ffaa0",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 26: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "9708fe68-3b8a-43b8-97e2-746503d8ade3",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 25: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5408f710-4a99-4a4f-bac0-f88be283f99d",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 24: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "15d7341b-80c9-47e0-a7ea-c21e4ab04374",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 23: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "020cea66-fe17-4dda-8fbb-288efea58a46",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "How many goals did Miroslav Klose score in World Cup?",
    "options": [
      "14",
      "16",
      "18",
      "20"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8ab603a7-8d65-479a-8147-a57547f3a50f",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 22: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6a5545b1-5bd8-46ac-8fc3-6b0719be1f51",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 21: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e9cf866b-a9f7-496a-bbdf-f64345d6230f",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 20: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "93da9bb7-de6d-4ba5-a4a8-ce997f09ddad",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 19: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2c3db70b-e105-40dc-837d-324d3b6fdd9f",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 18: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8264d309-8a1f-4251-af17-1f892630be27",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 17: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f09d3756-1f39-4d00-8b60-32c0bd509861",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 16: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6d94f457-42fa-4bde-81b5-355e35d48479",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 15: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "83e9b36e-9d77-401d-989c-2d34385ebcbc",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 14: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "acbaec2b-9c89-4beb-b269-dd2c2190f6bf",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 13: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b58d0a6a-b0d2-47e8-ad70-64e3a7ade3ce",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 100: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5395c0ce-f1aa-42aa-a36b-7af1426646b0",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 12: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f94df172-3dc6-4b76-a198-c977152d4e19",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "Guess the number 11: Football statistics question.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ed9eaef5-98e7-4538-8845-e6c436f848ca",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "How many goals did Mohamed Salah score in his best Premier League season?",
    "options": [
      "30",
      "32",
      "34",
      "36"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "de3b5ee3-fbed-42a7-855a-75c425b7376e",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "How many Premier League titles has Manchester United won?",
    "options": [
      "18",
      "19",
      "20",
      "21"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "abb0f37a-234c-479f-ad6e-02301a1e0f8a",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "How many goals did Erling Haaland score in Premier League 2022-23?",
    "options": [
      "32",
      "36",
      "40",
      "44"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "97acfeaa-625e-46b0-a5dd-9963944043bf",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "How many Ballon d'Or awards has Lionel Messi won?",
    "options": [
      "5",
      "6",
      "7",
      "8"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d644c75c-b5d7-4634-9b65-92a58c7229fe",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "How many goals did Cristiano Ronaldo score in the Champions League?",
    "options": [
      "Over 100",
      "Over 120",
      "Over 140",
      "Over 160"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b93e012b-a69d-426e-af6e-8a56b0d69dea",
    "categoryId": "623f7528-7cb8-44a1-891c-a970e62a8b8b",
    "question": "How many Champions League titles has Real Madrid won?",
    "options": [
      "12",
      "13",
      "14",
      "15"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c83ef579-2c10-4a03-b692-5225d5d39875",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 100: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f337288c-b267-4b05-bcb2-ad1e8efef0b2",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "How long is halftime break?",
    "options": [
      "10 minutes",
      "15 minutes",
      "20 minutes",
      "30 minutes"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "38694b07-604b-4fd8-aa12-18eb2111081a",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "How many players are on a football team on the field?",
    "options": [
      "9",
      "10",
      "11",
      "12"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5fee37a8-569a-4100-925d-b9a537ef98c9",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "How long is a standard football match?",
    "options": [
      "80 minutes",
      "90 minutes",
      "100 minutes",
      "120 minutes"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "4dbbbd86-7d96-4473-8c41-216130046892",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "What is the maximum number of substitutions in a match?",
    "options": [
      "3",
      "5",
      "7",
      "Unlimited"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e5e08a0c-3484-4d72-9f86-45241fd09412",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Which tournament is considered the most prestigious club competition?",
    "options": [
      "UEFA Champions League",
      "FIFA Club World Cup",
      "Premier League",
      "La Liga"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "be97c0fb-542b-42ad-a779-fc091bfc69db",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "What does VAR stand for?",
    "options": [
      "Video Assistant Referee",
      "Virtual Action Review",
      "Video Action Replay",
      "Virtual Assistant Referee"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c61a6aa0-fb8f-4a6d-84de-d82c87fa6f4b",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "How many yellow cards before a red card?",
    "options": [
      "1",
      "2",
      "3",
      "4"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "23af72a6-810a-407b-a6da-3b3f262d77bd",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "What is the size of a football goal?",
    "options": [
      "7.32m x 2.44m",
      "8m x 2.5m",
      "7m x 2m",
      "8.5m x 3m"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "695723b9-314c-412c-aab9-c8baab2cd672",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "How many referees in a professional match?",
    "options": [
      "1",
      "2",
      "3",
      "4"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "4f85f781-5a72-4dd0-b9f9-73940580dd94",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "What is offside?",
    "options": [
      "Player behind last defender",
      "Player in front of ball",
      "Player in penalty area",
      "Player out of bounds"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "88bd7104-bdd0-497e-a197-072243480db8",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 11: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "4e5ecd3e-bc7c-4e36-9dd3-df8a5b92caa2",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 12: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "08b4cbfd-2fa4-43b9-a928-b10d83d7cf2c",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 13: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b1139401-273b-485a-ac0a-1bed02fc7fdb",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 14: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d00ea59e-1422-4adc-be7d-5e47cde30c0b",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 15: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2b426f92-3746-46e4-b8a5-a060fb6b855a",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 16: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "04a6c7f1-9983-44e0-bd27-3259062f1b79",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 17: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c2d28d43-e7e6-4978-b8a8-a3ed972ecb11",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 18: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "4eb2fbe8-7eb5-4092-b792-ab720c66b378",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 19: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0596aea0-2344-4c33-9874-84b7036376bb",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 20: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "9492a65b-6a71-42eb-b08b-c3bbb7ec407d",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 21: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "bd885b7a-13ee-4140-86be-cec60d536c96",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 22: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "4b6954e7-0596-4c69-8030-396aac6c88ce",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 23: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "17731c08-1c17-49e1-a1fc-df77744a0adb",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 24: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "48a75a54-2c6b-48a6-ac4e-3bbc145d26da",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 25: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e1c5c610-f66a-4ddc-9f12-79387b9bc5ab",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 26: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e9a37efe-d6e3-4dc4-a71c-b22e6a43a48f",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 27: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2f894bce-439a-4b29-8cc5-9b76b76f431b",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 28: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "cc2d89a1-b9c6-4ac9-937e-7942fb2a3935",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 29: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "499032cd-f00d-4133-84af-04aa850cfa2e",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 30: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b1a1e06b-1628-484d-8159-e7a040be03de",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 31: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "53a43e51-0720-49ae-a460-12d428dbaf53",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 32: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c5f6a2cc-9cd3-4ca5-94b2-6f9a7a83bbcc",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 33: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "951239cd-203f-4c9c-a8bc-12938649639d",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 34: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "49102815-88d0-4b18-ae75-81cd4c81a51c",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 35: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f3c05f19-cf1f-445c-b8ab-2eff5d49b388",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 36: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "eabea8a7-6cda-4b5c-85ef-914f7cd298ae",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 37: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "9c6d5ac0-d6ab-4d75-ac39-dcb4c4811514",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 38: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e5d3abd1-2c6a-40a3-8a11-c17096716d52",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 39: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0fc542be-d5ff-4d6d-bff4-0a7c2d6e256b",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 40: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1d50619e-7897-4e2e-b01d-a7f1dadacbc2",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 41: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0aa6a331-5576-4fb5-8396-ff93560cc45c",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 42: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "400c42ce-7752-4ac6-b342-b139e138bc2a",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 43: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "84236ce6-d86a-4ceb-9d38-a4eaf65901ef",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 44: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d37a4181-628c-4991-acbe-ba86ab48d6c1",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 45: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2b127afb-a36f-4e0f-a6f7-19133f282822",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 46: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "afc538b1-9ab3-4196-a04b-4c31deb772d3",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 47: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "456d5b66-59fb-4523-a2dc-9428c6ef934b",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 48: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "fd984137-dc1d-46a9-9d84-6d82773ce203",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 49: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "574f4822-8971-415b-99b1-c5c467c1b0f4",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 50: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a52e5aba-b251-4aaa-a02b-9b5b20997b16",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 51: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "75463947-5d64-4de2-af98-96e7619f4210",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 52: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a997d585-06ec-4984-8ac9-ad2aa0a34041",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 53: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "090cac7d-e2d1-412e-91d8-3854fe0fbadc",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 54: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e5afb6be-062c-4c2c-8994-e3b4853488e1",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 55: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "89fb4d2c-9287-4fd7-8515-da68d4eae026",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 56: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "82c63f73-f0f0-4705-9e1a-ef7de38e5b70",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 57: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b3659585-e590-43cc-81c8-f3aa031956a9",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 58: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "473d33e7-28b3-4340-835d-721789e76ce6",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 59: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e3507265-8b40-4fab-a3d2-7338646806d5",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 60: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8e8239c9-db47-4228-8bc0-82d1b1fcfb64",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 61: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f15b562f-93f6-4d45-9641-5d24b368fe0f",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 62: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3afa1bb1-57f3-4041-996e-bf48c317455e",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 63: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6ffbc9dc-2e3a-4490-8626-ec9a262528ce",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 64: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a73926f6-2760-4d98-a767-d4d6c9ac0cbe",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 65: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b5925b5f-1f93-43ba-8b4d-0c68eb965cdc",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 66: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e8020c93-ea8b-425f-b99e-cbbe3923324a",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 67: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7e44c141-631d-4b16-9021-6c923044a949",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 68: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "5f9c0781-f770-4587-9888-99a296bcd936",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 69: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3a49cbae-bf42-4d5f-989c-53e76d1a8995",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 70: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "4f9a897f-e38c-4f43-bffc-16e46b56edfa",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 71: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "612080df-2d16-46c7-8518-6cdf23cf0318",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 72: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7c5a2b51-9c54-4a60-8666-48549237cb33",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 73: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a401f9e5-3fba-4888-9742-444c492efaed",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 74: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e9eaf6e4-761e-420a-a4d9-3d13967a1ff3",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 75: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f46bf42e-d376-4d6b-ae32-116b5167906b",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 76: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0c6a97a6-7089-4e27-a4e4-e5b4de640ff4",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 77: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "504116eb-091f-4a3b-a673-21cdf5c74d44",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 78: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "54a60a00-c72d-4008-bc32-4950e62181c7",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 79: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "30812451-e6fe-4547-8ca8-7b46b7297fad",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 80: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "fc0da0f4-3524-45b4-9aa0-302a065054da",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 81: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "cb849263-db97-4d49-a9a5-17c7100dc579",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 82: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "fede8d7e-3855-4c38-af07-2ec8cca3228a",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 83: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "818160de-15ed-44e2-b74d-61f13b88ee45",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 84: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d1179eaa-56d4-473d-86a5-f44ef20c90ef",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 85: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0ab0ade2-edea-4efd-adc1-4b0fb7194dfb",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 86: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "74845401-b4fa-4092-b17a-74a1bffb3b87",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 87: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a88b4e8e-38dc-4fbc-84ff-a0d161fdefcb",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 88: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "005d9b46-17cd-4af7-9f56-8bd63b7d412a",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 89: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3fa31b20-f169-4f0a-b152-d833e8f2542b",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 90: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d9ed63db-f5ce-4ac1-a7fb-df81cb81ea41",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 91: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "bf133592-76b8-40f8-a542-9424269ded83",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 92: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8e6c8bdb-cd36-499b-9636-432a2e6e80e0",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 93: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0e9bbe49-b346-4917-b31a-f93468e42354",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 94: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1efe10c1-25b9-4112-8c19-3d5aeeac6892",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 95: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2d7048b8-a122-4167-9f0b-1b1342528e09",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 96: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e0cdb4e4-167b-48a6-ac10-5d84cfb79536",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 97: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 30,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3b2b6912-b634-415a-b8a8-c5d7413981a9",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 98: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "EASY",
    "points": 10,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "72385f67-cfae-47b3-8ec2-fbbc93fd4b9a",
    "categoryId": "867da722-843e-4ef5-851c-9c64e4ca96ba",
    "question": "Q&A question 99: General football knowledge.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 20,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2eea17af-5a42-427d-9220-b326b4255389",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Which legendary player is known as \"The King\"?",
    "options": [
      "Pelé",
      "Diego Maradona",
      "Johan Cruyff",
      "Franz Beckenbauer"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "01e8d4d0-5741-4685-ac92-554283407dc5",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Which player is known as \"The Divine Ponytail\"?",
    "options": [
      "Roberto Baggio",
      "Alessandro Del Piero",
      "Francesco Totti",
      "Andrea Pirlo"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "424eb0a1-a5d1-4708-9518-c89ed37a38bb",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 100: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d913b6c4-43f3-49ae-8792-b06f5c3692e2",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 99: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "cea17f52-6e4c-439a-a402-d68249c597bc",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 98: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "4a068aaf-a5d9-451e-9afd-4b8cce40dc33",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 97: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3aa64b25-c1d1-4d30-8bff-5c2cdbae2ab4",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 96: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8876d65f-9a52-4427-aeb7-781fa6b00307",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 95: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "015f2c9b-418c-4e3c-bd88-97dbe5bf0ca9",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 94: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7e345893-f541-4a01-9dde-6c859ebe57fd",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 93: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6d0dfdee-0ae6-428d-9a90-f85da019f790",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 92: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3c820809-b10f-4ce9-86ef-663fe00f70b6",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 91: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f20c062d-4557-4be4-b13b-bde6df396a53",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 90: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "8db1cc66-1049-4e6b-aa74-48a1d4434e87",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 89: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "dcc5b17d-7d9a-45dd-8854-a07607a80924",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 88: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "15ef606c-9c83-4149-964a-6695df858c8d",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 87: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7e8dca83-7230-497a-8c4e-fc8f674b8ade",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 86: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a32ec660-fa88-4bec-8716-4c13ae3921d8",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 85: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1aefcd84-f372-43c1-bd0c-9d036e5efd22",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 84: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "46419602-859a-4be6-b921-4ad56eb27ce9",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 83: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2531467a-7772-4907-9fc8-a7b2dd388ef5",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 82: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e807abc8-cb03-4094-b0c1-981be56f92b6",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 81: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "be7e2a08-f196-4e63-9d96-b17b95610f85",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 80: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ea4385d4-3ec4-440c-89ed-3240cc98351c",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 79: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "41648e3a-9a1a-49d0-a75d-f469bd818ea3",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 78: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "08d2a99e-bf48-40a0-825c-b7b5164cabec",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 77: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "61ded8bc-b9e1-43a4-87ee-0a280f146c7e",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 76: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3a581d8f-cdbd-4815-b4e5-67bccf0a5f6f",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 75: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a9fba5e3-2c2d-48bc-a14e-5e465e927fb7",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 74: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f1a2b9c4-73f7-4251-8b24-4957526a79b6",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 73: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "40726c03-d173-4d3e-88e0-c4465f4ae4a9",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 72: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b88653a9-ffd5-4483-997a-71b4af7f8f9e",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 71: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "99a27659-244e-4dbf-9246-df6d630b7146",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 70: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "66439782-71f5-4d50-963f-cfac73baa991",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 69: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d3260f58-a59d-45ab-8827-bc478ec08254",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 68: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3fac8c8d-edb4-4cfe-bed2-f534e14425e2",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 67: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a838b1b5-566f-449b-88c9-26c44e1fa835",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 66: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e4e80469-e1e6-4345-b228-299e45571158",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 65: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "66aa174d-5a85-48e3-836c-9671369a2c01",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 64: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f1e4ed0f-dd41-4297-bcae-7b43f611afdd",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 63: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c95940a8-2fca-430d-a5a9-94f527fd80a5",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 62: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "edaf705c-b8da-4c67-b897-2cfa987f5a1e",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 61: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "2dc598ca-b80a-478d-8034-51bca9d2c06a",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 60: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e46f39df-f69a-49b9-96ab-1e21087f5d4f",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 59: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "fa3603fd-c23d-48cd-83f9-a931e98e94e1",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 58: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7267b8b6-80ee-4764-8913-f3c024c3ed1a",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 57: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "fdb2f912-d24c-439a-9670-adc5733c3146",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 56: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d2f89f0c-3477-49eb-a2f2-6deca43c6fcf",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 55: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "902ae823-9f48-4a06-9ce3-368a7dbfa8eb",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 54: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "7db05e79-ad57-40d5-a409-210e6a97ae34",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 53: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "caf30b37-0b6d-48b5-85bf-9d425da6b353",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 52: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "92c990d5-0e16-40d0-b6ba-22b86911b8eb",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 51: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "189fe33b-1498-4929-96f8-142f52132831",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 50: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ea3bfcd3-9da1-4925-9a34-f8bdc7233a15",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 49: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "9335560a-4468-4fcf-bb29-afa4fe013219",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 48: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "64ee25b5-10b3-47f5-b6ab-879fed16d067",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 47: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0e192c3c-8ed9-45a7-9a48-c796f0a72328",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 46: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "9c500711-f8fd-4b76-bcbd-3279981cc94a",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 45: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "31c57e07-93a3-44c9-9407-0e4016bd5545",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 44: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6871fcda-b90e-415f-a61f-28f1eed29699",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 43: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "02b0907e-6061-4ee9-9ba7-512b9bb053cc",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 42: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "82ac003b-522a-42af-904c-a76116c67879",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 41: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b76a936e-2e4e-470b-a42c-411e92d80cc5",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 40: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "aec92f43-8b0f-40b7-aae4-5fefae4a28aa",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 39: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b17c5f2c-b251-431d-bc0c-f3f804db4c57",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 38: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b2c7e44e-0f76-4573-99d1-e603908dbcf0",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 37: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b594ba35-dbb8-4c8f-bb0d-189a8f489c43",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 36: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1ca3fc81-3a5c-4782-a064-a165dfc6c6c9",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 35: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0919803f-2629-4172-b68f-c421556b0d91",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 34: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ddd25ebc-be18-4138-b95e-d6ff072584cb",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 33: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a034c7c1-153f-4379-80e0-94676cd2e528",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 32: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f05a4021-f445-4aaa-8f85-10cec5f22f1f",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 31: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "6bcd0aaf-af09-49e3-a03a-6ad076477bf2",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 30: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a82e0df9-4551-4b6b-bf46-2fc1ae6b37bf",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 29: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ae2a3a0e-9bd4-413a-96dc-981cddc47cb5",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 28: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "03b95b89-ab5b-4c5f-9b1d-13fa200aa87b",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 27: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "85b53f41-fc1a-4d5c-a2cb-3538f1c13aa8",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 26: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b2d8a1cf-802f-4f7f-843f-6ec47f6845b2",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 25: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "a429d349-7a91-4ccd-9f16-8a6c9b86fdc7",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 24: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "75f11a27-86eb-452e-901a-b0f81b47e0b5",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 23: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "9246bd4e-6e95-4cd8-a9a3-8cfc61313e3e",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 22: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ce390a20-50e9-4f30-a250-135c1978dee4",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 21: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b26bca68-e683-4758-9f19-a2a66de78635",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 20: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "146eb571-b398-4c87-9c6f-6be59dee6aee",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 19: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "17d93021-63ba-4d2b-b1e1-7870b352889a",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 18: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "e619c8a9-8939-4f7f-93cd-ef0b24dbb42f",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 17: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "863ddee2-e828-4899-9dfd-545ae25f8bbb",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 16: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "73e5e66f-9e82-4629-98ac-0f620f9bd855",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 15: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "ada39e3b-2ba8-4007-9083-e30987bf2ee8",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 14: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "97327dba-793b-4b19-92c9-58bbd5020234",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 13: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "81934418-ff97-4c0d-b3a3-25a0b827027d",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 12: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "41fd2214-feea-4acc-8904-eb8463439630",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Legends question 11: About football legends and their achievements.",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1501c59c-8ec2-4e8b-9ff6-3cf1697a38d8",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Which player is known as \"El Loco\"?",
    "options": [
      "Jorge Valdano",
      "René Higuita",
      "José Luis Chilavert",
      "Iván Zamorano"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "b908de4d-6fef-441a-836a-a2dd795acf94",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Which legendary striker is known as \"Der Bomber\"?",
    "options": [
      "Gerd Müller",
      "Miroslav Klose",
      "Karl-Heinz Rummenigge",
      "Uwe Seeler"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "1a58b5be-421b-4e0c-b2f6-8d5e0bb31171",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Which player is known as \"The Black Pearl\"?",
    "options": [
      "Eusébio",
      "George Weah",
      "Roger Milla",
      "Jay-Jay Okocha"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "3ace13ea-5773-4786-90d1-33ec5573c065",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Which legendary defender is known as \"Il Capitano\"?",
    "options": [
      "Paolo Maldini",
      "Franco Baresi",
      "Fabio Cannavaro",
      "Alessandro Nesta"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "f2fb65cf-d628-4996-b239-054e2bdc0116",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Which player is known as \"El Diego\"?",
    "options": [
      "Diego Maradona",
      "Diego Forlán",
      "Diego Costa",
      "Diego Simeone"
    ],
    "difficulty": "EASY",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "0cafcc6d-caa8-4850-bad2-c52b7c4210eb",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Which legendary player won the World Cup in 1958, 1962, and 1970?",
    "options": [
      "Pelé",
      "Garrincha",
      "Didí",
      "Zito"
    ],
    "difficulty": "MEDIUM",
    "points": 25,
    "imageUrl": "https://media.api-sports.io/football/players/1100.png",
    "imageType": "player",
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "d5394f9d-e171-450e-89db-0be5ad07478d",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Which player is known as \"The White Pelé\"?",
    "options": [
      "Zico",
      "Sócrates",
      "Rivellino",
      "Garrincha"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  },
  {
    "id": "c3fdef74-a58d-4075-be0d-e79aca524afc",
    "categoryId": "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36",
    "question": "Which legendary goalkeeper is known as \"The Cat\"?",
    "options": [
      "Lev Yashin",
      "Dino Zoff",
      "Gordon Banks",
      "Peter Schmeichel"
    ],
    "difficulty": "HARD",
    "points": 25,
    "imageUrl": null,
    "imageType": null,
    "hint": null,
    "timeLimit": 15
  }
];

/**
 * Map question ID to question
 */
export const QUESTION_MAP: Record<string, QuizQuestion> = QUIZ_QUESTIONS.reduce((acc, q) => {
  acc[q.id] = q;
  return acc;
}, {} as Record<string, QuizQuestion>);

/**
 * Get questions by category ID
 */
export function getQuestionsByCategoryId(categoryId: string): QuizQuestion[] {
  return QUIZ_QUESTIONS_BY_CATEGORY[categoryId] || [];
}

/**
 * Get question by ID
 */
export function getQuestionById(questionId: string): QuizQuestion | undefined {
  return QUESTION_MAP[questionId];
}

/**
 * Get questions by IDs
 */
export function getQuestionsByIds(questionIds: string[]): QuizQuestion[] {
  return questionIds.map((id) => QUESTION_MAP[id]).filter((q) => q !== undefined);
}

