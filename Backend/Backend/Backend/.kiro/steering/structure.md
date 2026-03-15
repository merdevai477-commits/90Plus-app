# Project Structure

## Repository Layout

```
/
├── Backend/           # Node.js/Express API server
├── front/             # React Native/Expo mobile app
└── .kiro/             # Kiro AI configuration and specs
```

## Backend Structure

```
Backend/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── config/                    # Configuration files
│   ├── controllers/               # Route handlers (business logic)
│   ├── routes/                    # API route definitions
│   ├── middleware/                # Express middleware
│   │   ├── clerk.middleware.ts    # Authentication
│   │   ├── auth-rate-limit.middleware.ts
│   │   ├── file-validation.middleware.ts
│   │   ├── rbac.middleware.ts     # Role-based access control
│   │   └── ...
│   ├── services/                  # Business logic services
│   │   ├── football.service.ts
│   │   ├── daily-quiz.service.ts
│   │   ├── moderation.service.ts
│   │   ├── *-cache.service.ts     # Caching layers
│   │   └── ...
│   ├── lib/                       # Shared libraries
│   │   ├── prisma.ts              # Prisma client
│   │   └── redis.ts               # Redis client
│   ├── utils/                     # Utility functions
│   ├── data/                      # Static data (quiz questions, etc.)
│   ├── scripts/                   # Utility scripts
│   └── __tests__/                 # Property-based tests
├── prisma/
│   ├── schema.prisma              # Database schema
│   ├── migrations/                # Database migrations
│   └── seed.ts                    # Seed data
├── public/                        # Static files (terms, privacy)
└── dist/                          # Compiled output (gitignored)
```

### Backend Patterns

- **Controllers** handle HTTP requests/responses
- **Services** contain business logic and are reusable
- **Middleware** handles cross-cutting concerns (auth, validation, rate limiting)
- **Routes** define API endpoints and apply middleware
- Caching services follow pattern: `*-cache.service.ts`
- Property-based tests in `__tests__/` use fast-check

## Frontend Structure

```
front/
├── app/                           # Expo Router (file-based routing)
│   ├── (tabs)/                    # Tab navigation screens
│   │   ├── Home.tsx
│   │   ├── leagues.tsx
│   │   ├── quiz.tsx
│   │   └── settings.tsx
│   ├── auth/                      # Authentication screens
│   ├── user/                      # User profile screens
│   ├── _layout.tsx                # Root layout
│   └── [dynamic].tsx              # Dynamic routes
├── components/                    # React components
│   ├── common/                    # Shared components
│   ├── Home/                      # Home screen components
│   ├── Matches/                   # Match-related components
│   ├── reels/                     # Video reel components
│   ├── Quiz/                      # Quiz components
│   └── ...
├── services/                      # API clients and business logic
│   ├── quizApi.ts
│   ├── predictions.service.ts
│   ├── websocketClient.ts
│   ├── *CacheService.ts           # Client-side caching
│   └── ...
├── hooks/                         # Custom React hooks
│   ├── useMatchesData.ts
│   ├── useWebSocket.ts
│   └── ...
├── contexts/                      # React Context providers
│   ├── LanguageContext.tsx
│   ├── CoinsContext.tsx
│   └── ...
├── src/
│   ├── store/                     # Zustand state management
│   └── i18n/                      # Internationalization
├── locales/                       # Translation files (en.ts, ar.ts, etc.)
├── constants/                     # App constants and themes
├── utils/                         # Utility functions
├── types/                         # TypeScript type definitions
├── config/                        # App configuration
│   └── api.config.ts              # API endpoints
├── data/                          # Static data (clubs, leagues, etc.)
└── assets/                        # Images, sounds, fonts
```

### Frontend Patterns

- **File-based routing** via expo-router in `app/` directory
- **Tab navigation** in `app/(tabs)/` for main screens
- **Component organization** by feature (Home, Matches, Quiz, etc.)
- **Services** handle API calls and external integrations
- **Hooks** encapsulate reusable logic
- **Contexts** for global state (language, coins, settings)
- **Zustand stores** in `src/store/` for complex state
- Path alias `@/*` maps to project root

## Key Conventions

### Backend

- Controllers export functions: `export const functionName = async (req, res) => {}`
- Services export classes or functions
- Routes use Express Router: `router.get('/path', middleware, controller)`
- Middleware follows Express signature: `(req, res, next) => {}`
- Database queries use Prisma client from `lib/prisma.ts`
- Redis caching via `lib/redis.ts`
- Error handling with try-catch and proper HTTP status codes
- Rate limiting per endpoint basis
- Property-based tests for critical business logic

### Frontend

- Components use functional components with TypeScript
- Hooks follow `use*` naming convention
- Services follow `*Service.ts` or `*Api.ts` naming
- Screens in `app/` directory use default exports
- Components in `components/` use named exports
- Async operations use try-catch with error handling
- Loading states and error boundaries for UX
- Optimistic updates for better perceived performance
- Cache-first strategies for offline support

## Database Schema Organization

Prisma schema organized by domain:
- User & Authentication (User, Session, RefreshTokens)
- Football Data (Leagues, Teams, Players, Matches)
- Quiz System (QuizCategories, QuizQuestions, QuizAttempts)
- Social Features (Follows, Reels, Likes, Comments)
- Gamification (CoinTransactions, Achievements, UserAchievements)
- Moderation (Reports, Notifications, Strikes)

## API Structure

Backend API follows RESTful conventions:
- Base path: `/api`
- Authentication: Clerk middleware on protected routes
- Rate limiting: Applied per route
- Response format: JSON with consistent structure
- Error responses: `{ error: string, details?: any }`
- Success responses: `{ data: any, message?: string }`

## Testing Strategy

- **Backend:** Property-based tests for business logic invariants
- **Frontend:** Unit tests for utilities and hooks
- **Integration:** API endpoint testing with Jest
- Test files colocated with source: `__tests__/` directories
