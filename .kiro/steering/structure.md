---
inclusion: always
---

# Project Structure & Conventions

## Repository Layout

```
/
├── Backend/    # Node.js/Express + Prisma API (also has root-level src/ in this repo)
├── front/      # React Native / Expo mobile app (iOS, Android, Web)
└── .kiro/      # Kiro specs, steering, and hooks
```

Note: backend TypeScript sources currently live under the repository root `src/` (e.g. `src/main.ts`, `src/routes/`, `src/services/`). The `Backend/` folder holds static assets (`Backend/public/`). Treat the root `src/` tree as the backend source of truth.

## Backend Layout (`src/` at repo root)

```
src/
├── main.ts              # Express entry point
├── config/              # Environment + service configs
├── controllers/         # HTTP handlers (thin; delegate to services)
├── routes/              # Express routers; apply middleware here
├── middleware/          # clerk, rbac, rate-limit, file-validation, responseCache, ...
├── services/            # Business logic; *-cache.service.ts for caching layers
├── queues/              # BullMQ / background jobs
├── lib/                 # prisma.ts, redis.ts (shared singletons)
├── utils/               # Pure helpers
├── data/                # Static seed data (quiz questions, etc.)
├── scripts/             # One-off utility scripts
└── __tests__/           # Property-based tests (fast-check)

prisma/
├── schema.prisma        # Single source of truth for DB
├── migrations/          # Never edit applied migrations
└── seed.ts
```

### Backend Rules

- Controllers are thin: validate input, call a service, shape the response. No business logic inline.
- Services hold business logic and are reusable across controllers, queues, and scripts.
- Always import Prisma from `src/lib/prisma.ts` and Redis from `src/lib/redis.ts`. Do not instantiate new clients.
- Routes are the only place middleware is composed: `router.<verb>('/path', ...middleware, controller)`.
- Cache services follow the `<domain>-cache.service.ts` naming (e.g. `match-cache.service.ts`).
- Use Prisma transactions when a write touches multiple tables.
- Apply `clerk.middleware` for auth, `rbac.middleware` for admin/developer routes, and a rate limiter on every mutating or auth-adjacent endpoint.
- Never modify `schema.prisma` without creating a migration.

## Frontend Layout (`front/`)

```
front/
├── app/                 # expo-router (file-based routes)
│   ├── (tabs)/          # Main tab screens (Home, matches, quiz, reels, settings, ...)
│   ├── auth/            # Auth flow screens
│   ├── user/[username]  # Dynamic profile routes
│   ├── _layout.tsx      # Root layout
│   └── *.tsx            # Top-level screens (onboarding, delete-account, ...)
├── components/          # Grouped by feature: common/, Home/, Matches/, reels/, Quiz/, chat/, profile/, rank/, notifications/, tamagui/, shell/, auth/
├── services/            # API clients + client-side business logic (*Api.ts, *Service.ts, *CacheService.ts)
├── hooks/               # Custom hooks (use*)
├── contexts/            # React Context providers (LanguageContext, CoinsContext, ...)
├── src/
│   ├── store/           # Zustand stores (complex global state)
│   ├── services/        # Lower-level services (authService, storageService, ...)
│   ├── storage/         # Persistent storage helpers
│   ├── hooks/           # Internal hooks (push notifications, ...)
│   └── i18n/            # i18n setup
├── locales/             # Translation dictionaries (en.ts, ar.ts, es.ts, fr.ts, de.ts, it.ts, pt.ts, tr.ts)
├── constants/           # theme.ts, ui.ts, ...
├── config/api.config.ts # API base URL + endpoints
├── utils/, types/, data/, assets/
```

### Frontend Rules

- All navigation uses expo-router. Do not add a separate navigation library.
- Screens in `app/` use default exports. Components in `components/` use named exports.
- Hooks are prefixed `use*`. Services are suffixed `Service.ts` or `Api.ts`.
- State placement:
  - UI-only state → `useState`.
  - Server state → React Query.
  - Global app state → Zustand stores in `src/store/`.
  - Cross-cutting providers (language, coins, settings) → `contexts/`.
- Always use translation keys from `locales/`; never hardcode user-facing strings. Support RTL for Arabic (`I18nManager.isRTL`, use `start`/`end` instead of `left`/`right`).
- Use `FlatList`/`FlashList` for long lists with a stable `keyExtractor`.
- Path alias `@/*` resolves to the `front/` root.

## Database Domains

Organize new Prisma models into the existing domains:

- Users & Auth: `User`, `Session`, `RefreshTokens`
- Football: `Leagues`, `Teams`, `Players`, `Matches`
- Quiz: `QuizCategories`, `QuizQuestions`, `QuizAttempts`
- Social: `Follows`, `Reels`, `Likes`, `Comments`
- Gamification: `CoinTransactions`, `Achievements`, `UserAchievements`
- Moderation: `Reports`, `Notifications`, `Strikes`

Use soft deletes (`deletedAt`) for user-generated content. Index frequently queried fields (username, email, foreign keys).

## API Conventions

- Base path: `/api`. Follow REST verbs (GET/POST/PATCH/PUT/DELETE) with plural nouns (`/api/users`, `/api/reels`).
- Success shape: `{ data: <payload>, message?: string }`. Paginated lists: `{ data: [...], total, page, limit }` (default limit 20).
- Error shape: `{ error: "E0xx", message: string, details?: any, timestamp: string, path: string }` using the standardized error codes (E001–E010).
- Version via `/api/v2/...` only for breaking changes.
- Never expose internal IDs, tokens, or password hashes in responses.

## Testing Layout

- Backend property-based tests: `src/__tests__/` using `fast-check`. Target invariants (coin balance never negative, quiz scoring monotonicity, prediction idempotency).
- Frontend tests colocated under `__tests__/` next to the code (e.g. `front/hooks/__tests__/useProfileCompletion.test.ts`).
- Mock external services (Clerk, Supabase, Redis, third-party APIs) in unit tests.
- Integration tests hit real endpoints against a test database and clean up after themselves.

## When Adding New Code

1. Match the existing folder and file naming before introducing a new location.
2. Backend feature: add `routes/<x>.routes.ts` → `controllers/<x>.controller.ts` → `services/<x>.service.ts`, plus a cache service if the data is hot.
3. Frontend screen: add under `app/` (tab screens in `app/(tabs)/`), put reusable UI in `components/<Feature>/`, data fetching in `services/`, and encapsulate logic in `hooks/`.
4. New user-facing text: add the key to every file in `front/locales/` (at minimum `en.ts` and `ar.ts`).
5. New env vars: add to `.env.example` with a placeholder value.
