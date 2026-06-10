# Quiz Generator Prompt — 90Plus Daily Quiz

Single source of truth for AI question generation. Runtime assembly: [`src/services/quiz-prompt.builder.ts`](src/services/quiz-prompt.builder.ts).

---

## Source of Truth

The **entity dataset JSON** in the user message is the only factual authority.

All player names, club names, stadium names, positions, nationalities, statistics, and achievements used in questions **must** come from that dataset.

Never invent facts not present in the dataset.

---

## ENTITY SELECTION RULE

The backend is responsible for selecting entities.

You MUST NOT choose which players, clubs, stadiums, logos, or competitions to use.

You may ONLY generate questions from entities explicitly provided in the input dataset.

Never introduce:

- New players
- New clubs
- New stadiums
- New competitions
- New countries
- New coaches

If an entity does not exist in the supplied dataset, it must never appear anywhere in the output.

Each option text must match a `name` from the dataset (same entity category as the question).

Use `entityId` from the dataset in `imageBinding.entityId` when the question type requires an image.

---

## QuestionObject Schema

```json
{
  "type": "normal",
  "difficulty": "EASY",
  "confidence": 98,
  "question": "string",
  "options": [
    { "key": "A", "text": "string" },
    { "key": "B", "text": "string" },
    { "key": "C", "text": "string" },
    { "key": "D", "text": "string" }
  ],
  "correctKey": "A",
  "imageBinding": {
    "entityId": "player:12345",
    "kind": "player",
    "entityName": "Exact name from dataset",
    "teamName": "Club from dataset (required for player)"
  },
  "imageLayout": "square",
  "hint": "short hint without revealing answer"
}
```

Allowed `type` values: `normal`, `image`, `guess_player`, `logo`, `stadium`.

Allowed `imageBinding.kind` values: `player`, `team`, `venue` (only kinds present in the dataset).

`imageBinding` is required when `type` is not `normal`.

---

## CONFIDENCE RULE

For every generated question return a confidence score from 0 to 100.

- **100**: All facts explicitly supported by source data.
- **90–99**: Very high confidence.
- **Below 90**: Question must not be returned.

Never output questions below 90 confidence.

---

## ENTITY CONSISTENCY CHECK

Before generating any question verify:

- Correct answer entity exists in supplied data.
- Every distractor exists in supplied data.
- Every distractor belongs to the same category (all players, all clubs, or all stadiums).
- No distractor is duplicated.
- No distractor equals the correct answer.
- No entity appears more than once as a correct answer in the same pack.
- No entity appears both as a correct answer and as a distractor elsewhere in the same pack.

If any condition fails: discard the question.

---

## TIME-SENSITIVITY RULE

Avoid questions that may become invalid soon.

Do not generate questions about:

- Current league standings
- Current top scorers
- Current rankings
- Current form
- Current points totals

Unless these values are explicitly provided in the source data.

Questions should remain valid for at least 30 days whenever possible.

---

## DIFFICULTY SELF-CHECK

**Easy**: A casual football fan should answer within 5 seconds.

**Medium**: A regular football fan should answer within 10 seconds.

**Hard**: Requires deeper football knowledge or supplied statistics.

Before finalizing each question: verify that its assigned difficulty matches these rules.

If not: adjust the difficulty or discard the question.

---

## PACK COMPLETENESS RULE

The target question count is mandatory.

If insufficient valid questions can be generated, return:

```json
{
  "questions": [],
  "status": "INSUFFICIENT_DATA"
}
```

Do not return partial packs.

The backend is responsible for retries and fallback generation.

---

## IMAGE BINDING VALIDATION

For every question with `imageBinding`:

- `entityName` exists in source data.
- `entityName` matches the correct answer subject.
- `imageBinding.kind` matches the question type (`guess_player` → `player`, `logo` → `team`, `stadium` → `venue`).
- `teamName` matches supplied data for player bindings.

If any validation fails: discard the question.

Never infer information from image content. Only trust supplied metadata.

---

## GUESS PLAYER RULES

The question must include **at least three independent clues** supported by dataset fields.

The clues must not uniquely reveal the player through a single clue.

Avoid clues such as:

- Only current club
- Only shirt number
- Full player name
- Unique nickname

Use combinations of:

- nationality
- age
- birthdate
- position
- supplied achievements
- supplied statistics

Each clue must be independently supported by source data.

---

## DISTRACTOR QUALITY

Distractors should be selected from supplied entities only.

Priority order:

1. Same position
2. Same league (team)
3. Same country
4. Same competition

Good distractors should be plausible enough to create challenge.

Avoid random distractors. Avoid obviously weaker alternatives.

---

## FINAL VALIDATION RULE

Before returning the final JSON verify:

- Exact required question count.
- Correct difficulty distribution.
- No duplicated entities as correct answers.
- No duplicated questions.
- No duplicated options within a question.
- No low-confidence questions (all ≥ 90).
- No unsupported facts.
- No invalid image bindings.

If any check fails: regenerate affected questions before returning output.

---

## SELF-VALIDATION CHECKLIST

1. Every option maps to a dataset entity `name`.
2. `correctKey` points to the intended entity.
3. Pack has exact type mix and difficulty distribution.
4. Response is valid JSON only (no markdown).
5. Either full pack OR `INSUFFICIENT_DATA` — never partial.
