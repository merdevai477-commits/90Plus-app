---
inclusion: always
---

# 90Plus — Product Guide

90Plus is a football (soccer) social and engagement platform. It blends live match data, short-form video (reels), daily quizzes, predictions, and gamification into a single mobile-first experience. Use this document to stay aligned with the product's domain language, user expectations, and feature boundaries.

## Product Pillars

- **Live football data** — scores, fixtures, lineups, and events update in near real time.
- **Short-form video (reels)** — user-generated clips (5–60s, max 100MB) with likes, comments, shares, and hashtags.
- **Predictions** — users predict match outcomes and earn coins on correct calls.
- **Daily quiz** — rotating categories (e.g. legends, transfers) with XP and coin rewards.
- **Gamification** — coins, XP, levels, achievements, daily spin wheel.
- **Social graph** — follow/followers, notifications, user rankings, FIFA-style profile cards.
- **Moderation** — reporting, strikes, blocks, content takedowns.

## User Roles

| Role       | Capabilities                                                              |
|------------|---------------------------------------------------------------------------|
| User       | Default fan role: post reels, predict, quiz, follow, comment.             |
| Developer  | Elevated role for internal tooling and debug endpoints.                    |
| Admin      | Moderation, content removal, strike management, user administration.      |

RBAC is enforced server-side. Never rely on client checks alone for role-gated actions.

## Platform & Reach

- Mobile-first: React Native / Expo targeting **iOS and Android** (primary) with **web** as a secondary target.
- Ship changes that work on all three unless the feature is explicitly platform-scoped (gate with `Platform.OS` or `Platform.select`).
- Design for low-end devices and flaky networks: cache hot reads, queue mutations offline, and keep the JS thread unblocked.

## Internationalization

The app ships in **8 languages**: English (en), Arabic (ar), Spanish (es), French (fr), German (de), Italian (it), Portuguese (pt), Turkish (tr).

- Every user-facing string must come from `front/locales/*.ts`. Add new keys to every locale file (at minimum `en.ts` and `ar.ts`).
- Arabic is RTL. Use logical properties (`start`/`end`) and `I18nManager.isRTL`; never hardcode `left`/`right` for user-visible layout.
- Format numbers, dates, and currency via locale-aware helpers.

## Domain Invariants (must hold everywhere)

- **Coin balance is never negative.** Debits must check balance in a transaction.
- **Predictions are idempotent** per (user, match) — resubmission updates, never duplicates.
- **Quiz scoring is monotonic** — a correct answer never reduces score.
- **Soft deletes (`deletedAt`) preserve referential integrity.** Do not hard-delete user-generated content.
- **Strikes accumulate** and trigger moderation actions at defined thresholds; never silently reset.
- **Age gating** must precede access to social and content features; underage users follow the parental-consent flow.

These invariants are the property-based testing targets in `src/__tests__/`.

## Content & Safety Rules

- Validate all uploads on the backend: video 5–60s, ≤100MB; images ≤10MB; hashtags max 10 per reel (2–30 chars each); bio ≤500 chars.
- Sanitize user-generated text before storage and render (XSS).
- Reported content and struck users must be filtered from public feeds.
- Never expose internal IDs, tokens, email addresses, or password hashes in API responses.
- Respect blocks: blocked users must not see each other's content or profiles.

## Product Copy & Tone

- Friendly, concise, football-literate. Avoid jargon that excludes casual fans.
- Error messages are user-safe (no stack traces, no internal codes in the UI). Map backend error codes (E001–E010) to localized, human-readable copy.
- Celebratory moments (coin wins, level-ups, correct predictions) deserve clear, delightful feedback.

## Feature Ownership Map (for quick navigation)

| Feature area     | Backend                                                   | Frontend                                  |
|------------------|-----------------------------------------------------------|-------------------------------------------|
| Matches & live   | `src/routes/football.routes.ts`, `match-cache.service.ts` | `app/(tabs)/matches.tsx`, `components/Matches/` |
| Reels            | `src/routes/upload.routes.ts`, `video-processor.service.ts` | `app/(tabs)/reels.tsx`, `components/reels/`    |
| Quiz             | `src/routes/quiz.routes.ts`                               | `app/(tabs)/quiz.tsx`, `components/Quiz/`      |
| Predictions      | `src/routes/predictions.routes.ts`                        | `src/store/usePredictionsStore.ts`             |
| Chat / AI        | `src/routes/chat.routes.ts`, `chat.service.ts`            | `app/(tabs)/chat.tsx`, `components/chat/`      |
| Notifications    | `src/routes/notification.routes.ts`                       | `app/notifications.tsx`, `components/notifications/` |
| Gamification     | coin/XP/achievement services                              | `contexts/CoinsContext`, rank screens          |
| Moderation       | reports, strikes, blocks routes                           | `app/settings/blocked-users.tsx`, report flows |

When adding a feature, match this layout before introducing a new location.

## When Building New Features

1. Confirm the feature fits one of the pillars above; if not, flag it before building.
2. Preserve the invariants — add a property-based test if the feature touches coins, predictions, quiz scoring, or soft deletes.
3. Ship with i18n keys in every locale and RTL-safe styles.
4. Gate role-sensitive actions with RBAC on the server.
5. Think about offline and low-bandwidth behavior on mobile before merging.
