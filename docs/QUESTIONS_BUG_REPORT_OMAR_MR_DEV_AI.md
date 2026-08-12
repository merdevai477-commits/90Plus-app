# Questions System — Bug & Product Gap Report

**To:** Omar  
**From / Reviewed by:** Mr.dev ai  
**Date:** 2026-08-12  
**Scope:** Post-merge review of the new Questions hub (AI modes + UX) after production deploy  
**Overall verdict:** UI quality and load speed are strong; AI grounding/contract is excellent (no hallucination of entities). The issues below are mostly **UX wiring / product-spec mismatches**, not AI quality.

---

## Positive notes (for context)

- Hub UI and mode chrome feel polished and load quickly.
- AI pipeline (IDs-only + football data grounding + round contract) is strict and correct — do **not** loosen that layer while fixing gameplay UX.
- Keep the “no canned fallback on the client” stance.

---

## Issue list

### 1) 50:50 removes 3 options instead of 2

| | |
|---|---|
| **Severity** | High (breaks lifeline fairness) |
| **Expected** | Hide **2** wrong answers; leave **correct + 1 wrong** (2 visible) |
| **Actual** | Player sees only **1** option left (3 removed) |

**Root cause (code):**

Two paths exist; both can leave a single survivor:

1. **Questions modes** — `front/hooks/useQuestionModeSession.ts` → `eliminateWrongAnswers()`  
   - Calls `GET .../fifty-fifty`, then eliminates every option id **not** in `keepIds`.  
   - It only checks `keepIds.length === 2`; it does **not** verify that **both** ids exist in the rendered `options`.  
   - If one `keepId` fails to match (case / id drift), **3** options are hidden → 1 left.

2. **Backend fifty-fifty** — `src/services/questions-challenges.service.ts` → `getQuestionFiftyFifty()`  
   - Reads `question.answer?.correctIds` only.  
   - Grading uses `resolveQuestionAnswer()` (question answer → `byQuestionId` → legacy). Fifty-fifty does **not** use that helper — inconsistent answer resolution.  
   - Option ids are lowercase letters `a|b|c|d` (`OPTION_LETTERS` in AI generator). Any mismatch with client ids causes the frontend mismatch above.

3. **Football Quiz path** — `front/components/Quiz/QuizHubScreen.tsx` → `handleEliminateWrongAnswers()`  
   - Client-side: treats every option whose `key !== correctKey` as wrong, keeps one random wrong, eliminates the rest.  
   - If `correctKey` does not match any `option.key`, **all 4** are treated as wrong → eliminates **3**, leaves **1** (may not even be the correct one).

**Fix direction:**

- Always resolve answer via the same helper as grading (`resolveQuestionAnswer`).  
- Backend: return `keepIds` that are guaranteed members of `options[].id`.  
- Frontend: assert `keepIds.every(id => options.some(o => o.id === id))` and that exactly **2** options remain after filter; otherwise abort and spend no use.  
- Football Quiz: if `correctKey` not in option keys, fail the lifeline (no-op) instead of eliminating 3.

---

### 2) Middle “friends / users” lifeline should be removed

| | |
|---|---|
| **Severity** | Medium (product / design) |
| **Expected** | No “ask a friend” / friends help control |
| **Actual** | Middle hexagon uses the **users** glyph (`Ask the crowd`) |

**Root cause (code):**

- Lifeline row is hard-coded as three items in `front/components/Quiz/QuestionsModeScreen.tsx` (`lifelines` useMemo): `fifty` → `crowd` (glyph `users`) → `change`.  
- Glyph comes from `front/components/Quiz/QuestionLifelines.tsx` (`GLYPH_USERS`).  
- There is **no** “ask friend” feature; the middle control is crowd stats. Visually it reads as friends and should be dropped from the shipping design unless crowd is explicitly product-approved.

**Fix direction:**

- Remove the middle lifeline from Questions mode ActionBar (and Football Quiz if mirrored).  
- Keep layout balanced with two lifelines (50:50 + change), or replace only if a real friend-help API is planned later.

---

### 3) Header XP / coins + deduct coins on wrong answer

| | |
|---|---|
| **Severity** | High (economy / trust) |
| **Expected** | Header shows **real account** XP & coins; wrong answer **deducts coins** |
| **Actual** | Header already binds real balances; wrong answers do **not** touch coins |

**Root cause (code):**

- Display is correct: `front/components/Quiz/GlobalQuizStats.tsx` uses `useCoins()` + `useXp()` (live account).  
- Economy on submit: `submitQuestionsChallengeAnswer` in `questions-challenges.service.ts` awards XP **only when correct** (`QUIZ_ANSWER_CORRECT`).  
- There is **no** coin debit / `CoinTransaction` on incorrect answers for Questions modes.  
- So this is a **missing product rule**, not a display bug — unless a specific screen is showing round-local counters instead of `GlobalQuizStats` (verify per mode chrome).

**Fix direction:**

- Confirm product: amount to deduct, floor at 0?, refund rules, idempotency key per question attempt.  
- Implement server-side coin debit on wrong/expired answers (never trust the client).  
- Refresh CoinsContext after submit so the header updates immediately.

---

### 4) Football Bingo — only 1 club selectable; confirm button still present

| | |
|---|---|
| **Severity** | High (mode unplayable as designed) |
| **Expected** | Select **exactly 3** clubs; **no confirm**; auto-advance when 3 are chosen |
| **Actual** | User can only select **1** cell; must press Confirm |

**Root cause (code):** — clear wiring bug

1. Session sanitization strips answers before the client sees them:  
   `sanitizeQuestionForClient()` in `questions-challenges.session.service.ts` removes `answer`.  
2. Client mapper sets `correctAnswers` from `answer.correctIds` (`front/services/questionsModes.ts` → `mapRoundQuestion`). After sanitize this is **[]**.  
3. Selection cap in `useQuestionModeSession.ts` → `toggleSelection()`:

```ts
const maxSelectable = Math.max(currentQuestion.correctAnswers.length, 1);
// → Math.max(0, 1) === 1  for bingo
```

4. Bingo still uses the shared ActionBar confirm (`QuestionsModeScreen` → `onPrimary={submitAnswer}`). There is no “when `selected.length === 3` auto-submit” path.

**Fix direction:**

- Do **not** expose correct cell ids to the client. Instead send a non-secret `selectionCount: 3` (or mode rule) on the session DTO.  
- Cap bingo selection at 3 from that rule.  
- On reaching 3 selections, auto-call submit and advance (hide confirm for bingo).  
- Optional: highlight selected cells; only reveal correct/wrong after server grades.

---

### 5) Football Grid — product/design mismatch (not a small bug)

| | |
|---|---|
| **Severity** | High (spec vs implementation) |
| **Expected (product)** | 9 cells; horizontal = trophies/awards; vertical = clubs / national teams; place players into a relationship grid; green halo if correct cell, reject if wrong; **no confirm**; goal = fill the relationship table |
| **Actual (code)** | One named player per question; axes are **clubs × nationalities**; single correct cell; **10** questions/round (`ROUND_QUESTION_COUNT`); confirm required; no green-halo placement loop |

**Root cause (code):**

- Prompt & builder: `questions-challenges.ai-prompt.ts` + `buildFootballGrid()` — “tap the one cell where this player’s club meets nationality”.  
- UI: `ConstraintGridBoard` + shared confirm flow.  
- Round size is global `ROUND_QUESTION_COUNT = 10`, not 9.

This is a **redesign of mode contract + AI schema + UI**, not a one-line fix.

**Fix direction (spec for Omar):**

1. New round shape: one board of 9 cells (or 9 placements in one session), axes = trophies × clubs/nations as product defines.  
2. Server validates each placement; return `{ accepted: true }` + green halo, or reject without placing.  
3. Remove confirm; advance/complete when board is filled or lives exhausted.  
4. Update AI prompt + round-contract + tests accordingly.  
5. Keep entity/image grounding rules unchanged.

---

### 7) Top 10 Challenge — free-text top 10 with fuzzy matching

| | |
|---|---|
| **Severity** | High (feature incomplete + wrong interaction model) |
| **Expected** | 10 text slots; user types names for a year (e.g. Top 10 of 2010); fuzzy spelling tolerance |
| **Actual** | Route is **Coming Soon** (`front/app/quiz/[mode].tsx` → `UNRELEASED_MODES`). AI generator currently **skips** publishing top10 (removed from daily `MODES` until UI ships). Existing board sketch (`TopTenSelector`) is **tap-to-select ranked scorers**, not free-text inputs |

**Root cause:**

- Product spec ≠ current implementation.  
- No fuzzy match layer (e.g. normalized names / Levenshtein / alias table) in Questions grading today.  
- Ordering scorer lists from live tables ≠ “Top 10 players of year YYYY” authoring.

**Fix direction:**

1. Re-enable mode in AI `MODES` only after UI ships.  
2. New question shape: `{ year, category, acceptedAnswers[10] }` with canonical names + aliases.  
3. UI: 10 `TextInput` rows; submit when all filled or per-row check.  
4. Grading: normalize Arabic/English, fuzzy threshold, order-sensitive vs bag-of-names (product decision).  
5. Images optional after reveal.

---

## Priority order recommended for Omar

1. **Bingo selection cap + auto-submit** (clear bug, high impact)  
2. **50:50 leave exactly 2 options** (fairness)  
3. **Remove middle users lifeline** (quick design win)  
4. **Wrong-answer coin debit** (economy — needs product numbers)  
5. **Football Grid redesign** (larger epic)  
6. **Top 10 free-text + fuzzy** (larger epic; currently Coming Soon)

---

## File map (quick)

| Area | Files |
|------|--------|
| 50:50 client | `front/hooks/useQuestionModeSession.ts`, `front/components/Quiz/QuizHubScreen.tsx` |
| 50:50 server | `src/services/questions-challenges.service.ts` (`getQuestionFiftyFifty`) |
| Lifelines UI | `front/components/Quiz/QuestionsModeScreen.tsx`, `QuestionLifelines.tsx` |
| Coins/XP header | `front/components/Quiz/GlobalQuizStats.tsx` |
| Answer economy | `src/services/questions-challenges.service.ts` (`submitQuestionsChallengeAnswer`) |
| Bingo select cap | `useQuestionModeSession.ts` `toggleSelection` + `sanitizeQuestionForClient` |
| Grid / Top10 | `questions-challenges.ai-prompt.ts`, `QuestionsModeBoards.tsx`, `front/app/quiz/[mode].tsx` |

---

## Sign-off

Reviewed and filed by **Mr.dev ai** for **Omar**.  
Please confirm product numbers for coin deduction and Grid/Top10 specs before implementation so we don’t thrash the AI contract twice.

**— Mr.dev ai**
