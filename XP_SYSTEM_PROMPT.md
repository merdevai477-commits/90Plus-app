# 90Plus — XP & Level System (Full Build)

You are working on the **90Plus** football social app (React Native/Expo + Node.js/Express + Prisma). Build a complete XP and level system end-to-end. Read every section before writing code. Follow `.kiro/steering/structure.md`, `Mr.dev.md`, and `product.md`.

---

## Repository layout (relevant)

```
src/                                 ← Backend (TS source of truth)
├── lib/prisma.ts                    ← shared Prisma singleton
├── lib/redis.ts                     ← shared Redis singleton
├── routes/                          ← all routers
├── controllers/                     ← thin HTTP handlers
├── services/                        ← business logic (xp.service.ts goes here)
├── middleware/                      ← clerk, rbac, rate-limit
└── __tests__/                       ← property-based tests (fast-check)

prisma/
├── schema.prisma                    ← single source of truth (DO NOT touch existing models without migrations)
└── migrations/                      ← never edit applied migrations

front/
├── app/(tabs)/profile.tsx           ← own profile tab
├── app/(tabs)/rank.tsx              ← rank screen (already wired to /api/reels/rankings/top-players)
├── app/user/[username].tsx          ← public profile of any user
├── components/profile/              ← profile UI (ProfileCompletionCard*, ProfileHeader)
├── components/rank/                 ← rank UI (ProfileCard, RankHeader, FifaCard, ...)
├── components/common/               ← CoinsBadge (model for XpBadge), Toast (model for XpToast)
├── components/Matches/GradientMatchCard.tsx  ← prediction Modal (model for LevelUpModal)
├── contexts/CoinsContext.tsx        ← model for XpContext
├── services/                        ← *Api.ts, *Service.ts (client-side)
├── src/services/authService.ts      ← AuthService.syncUserWithBackend, profile updates
├── locales/{en,ar}.ts               ← all 8 languages
├── hooks/                           ← custom hooks (use*)
└── config/api.config.ts             ← API base URL
```

**Existing User model fields (already in `prisma/schema.prisma`):**
- `xp: Int @default(0)`
- `level: Int @default(1)`
- `coins: Int @default(0)`
- `profileCompletionSteps: Json? @default("{}")`
- `profileCompletionPercentage: Int? @default(0)`
- `lastAvatarChange: DateTime?`
- `lastUsernameChange: DateTime?`
- `bio: String?`, `avatar: String?`, `country: String?`, FIFA fields, social links columns
- `LEVEL_UP` already exists in `NotificationType` enum

You **must** use these existing fields. **Do not** create parallel xp/level columns.

---

## Product spec (single source of truth)

### Level curve

```
xpRequired(1) = 0
xpRequired(2) = 290
xpRequired(N) = 290 + 250 × (N − 2) × (N − 1) / 2     for N ≥ 3
```

| Level | Cumulative XP | Title |
|---|---|---|
| 1 | 0 | Rookie |
| 2 | 290 | Captain |
| 3 | 790 | Striker |
| 5 | 2,540 | Star |
| 10 | 11,290 | Legend |
| 20 | 47,540 | Icon |
| 50 | 308,290 | Hall of Fame |

No level cap. The `(level − 2) × (level − 1) / 2` formula is the triangular number — pure JS math, no DB.

### XP awards (fixed values — do not deviate)

**One-time milestones (paid once per user lifetime):**

| Action | XP | Idempotency key |
|---|---|---|
| First avatar upload | 50 | `profile.avatar.first` |
| First display name set/change | 30 | `profile.displayName.first` |
| First bio (≥ 20 chars) | 30 | `profile.bio.first` |
| Each social link added (instagram/twitter/tiktok/snapchat) | 20 | `profile.social.<platform>.first` |
| Each FIFA card field filled (position/age/height/weight/foot/country/club/brand) | 10 | `profile.fifa.<field>.first` |
| FIFA card 100% complete (all 8 fields) | +20 bonus | `profile.fifa.complete` |

Total profile completion = exactly **290 XP = Level 2**.

**Repeatable activities (with daily caps, timezone-aware):**

| Action | XP | Daily cap | Notes |
|---|---|---|---|
| Upload reel | 30 | max 3 reels/day | per-user/day |
| Comment on reel (≥ 5 chars) | 5 | max 10/day | own comments only |
| Share / save a reel | 3 | max 20/day | distinct reel IDs only |
| Reel reaches 100 views | 5 | once per reel | award fires per reel, not per user/day |
| Correct prediction (exact score) | 30 | per match | fires when match settles |
| Correct prediction (winner only) | 10 | per match | fires when match settles, never both |
| Quiz correct answer | 2 | max 50/day | distinct question per user |
| Quiz completed with ≥ 80% | +20 bonus | once per quiz attempt | |
| Daily login streak | 5 → 50 | streak based | see below |

**Daily login streak XP:**
- Day 1: 5
- Day 2: 10
- Day 3: 15
- Day 4: 20
- Day 5: 30
- Day 6: 40
- Day 7+: 50 (capped, every following consecutive day = 50)
- Streak resets to 1 if user misses a day (no freeze tokens for now)

**Anti-abuse rules (server-side, non-negotiable):**
- All idempotency keys are stored per `(userId, key)` pair. Re-attempts return 0 XP earned.
- Daily caps reset at midnight in the user's IANA timezone (read from `x-user-timezone` header — same pattern as the chat daily limit).
- Social-link XP only awards once a valid URL is saved (must match `^https?://` and the platform's domain pattern below). Removing then re-adding the same platform → 0 XP on re-add.
- Bio XP only awards when length ≥ 20 chars **and** there was no prior bio that hit the threshold.
- Reel/comment/share XP requires the resource to NOT be soft-deleted (`deletedAt` IS NULL).
- View-threshold XP fires once per reel via a unique row in `XpTransaction` keyed by `reel:<reelId>:views100`.

**Social-link URL validation:**
- `instagram`: must contain `instagram.com/` after `https?://`
- `twitter`: `twitter.com/` or `x.com/`
- `tiktok`: `tiktok.com/`
- `snapchat`: `snapchat.com/`
- Server-side regex; reject if invalid; do NOT award XP on a stored invalid URL.

### Domain invariants (enforce in tests)

- **XP never decreases.** `awardXp` only adds. Reverting a transaction creates an inverse `XpTransaction` entry; the running aggregate is recomputed but the audit trail is append-only.
- **Level is monotonic.** `levelFromXp(xp)` is a pure function; given the same xp, always returns the same level.
- **Daily caps are enforced atomically.** No race condition can let a user exceed a cap.
- **Idempotency keys are unique per user.** Concurrent calls awarding the same key result in exactly one transaction.

---

## What to build

### 1. Backend — Prisma schema additions

Add these new models to `prisma/schema.prisma` **without modifying the existing User model except to add relations**:

```prisma
model XpTransaction {
  id              String   @id @default(uuid())
  userId          String
  action          XpActionType
  amount          Int                       // can be negative for reversals
  idempotencyKey  String?                   // null for repeatable actions; set for one-time/per-resource awards
  metadata        Json?                     // e.g. { reelId, matchId, questionId }
  createdAt       DateTime @default(now())
  user            User     @relation("UserXpTransactions", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, idempotencyKey])
  @@index([userId, createdAt])
  @@index([action])
  @@map("xp_transactions")
}

model XpDailyCap {
  id        String   @id @default(uuid())
  userId    String
  action    XpActionType
  date      String                          // YYYY-MM-DD in user's timezone
  count     Int      @default(0)
  user      User     @relation("UserXpDailyCaps", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, action, date])
  @@index([userId, date])
  @@map("xp_daily_caps")
}

model LoginStreak {
  id              String   @id @default(uuid())
  userId          String   @unique
  current         Int      @default(0)
  longest         Int      @default(0)
  lastLoginDate   String?                   // YYYY-MM-DD in user's timezone
  user            User     @relation("UserLoginStreak", fields: [userId], references: [id], onDelete: Cascade)

  @@map("login_streaks")
}

enum XpActionType {
  PROFILE_AVATAR
  PROFILE_DISPLAY_NAME
  PROFILE_BIO
  PROFILE_SOCIAL_INSTAGRAM
  PROFILE_SOCIAL_TWITTER
  PROFILE_SOCIAL_TIKTOK
  PROFILE_SOCIAL_SNAPCHAT
  PROFILE_FIFA_POSITION
  PROFILE_FIFA_AGE
  PROFILE_FIFA_HEIGHT
  PROFILE_FIFA_WEIGHT
  PROFILE_FIFA_FOOT
  PROFILE_FIFA_COUNTRY
  PROFILE_FIFA_CLUB
  PROFILE_FIFA_BRAND
  PROFILE_FIFA_COMPLETE
  REEL_UPLOAD
  REEL_COMMENT
  REEL_SHARE
  REEL_VIEWS_100
  PREDICTION_EXACT
  PREDICTION_WINNER
  QUIZ_ANSWER_CORRECT
  QUIZ_COMPLETED_HIGH
  DAILY_LOGIN
  ADMIN_ADJUSTMENT                          // reserved for support tooling
}
```

Also add the inverse relations on `User`:

```prisma
model User {
  // ... existing fields ...
  xpTransactions  XpTransaction[]  @relation("UserXpTransactions")
  xpDailyCaps     XpDailyCap[]     @relation("UserXpDailyCaps")
  loginStreak     LoginStreak?     @relation("UserLoginStreak")
}
```

Generate and apply a migration: `prisma migrate dev --name add_xp_system`.

**Do not** edit any existing migration. Do not drop or rename existing columns.

---

### 2. Backend — `src/services/xp.service.ts`

Single entry point for all XP awards. Pure, testable, transaction-safe.

```typescript
// src/services/xp.service.ts
export interface AwardXpInput {
  userId: string;
  action: XpActionType;
  idempotencyKey?: string;             // required for one-time and per-resource awards
  dailyCap?: number;                   // if provided, increments XpDailyCap and rejects past cap
  amount?: number;                     // override default for the action; otherwise look up XP_VALUES[action]
  timezone: string;                    // IANA tz, sanitized
  metadata?: Record<string, unknown>;
}

export interface AwardXpResult {
  awarded: number;                     // 0 if rejected/duplicate/cap-hit
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
  previousLevel: number;
  reason?: 'duplicate' | 'cap_reached' | 'invalid' | 'ok';
}

export async function awardXp(input: AwardXpInput): Promise<AwardXpResult>;
export function levelFromXp(xp: number): number;
export function xpForLevel(level: number): number;
export function xpForNextLevel(currentLevel: number): number;
export function levelTitle(level: number): string;          // Rookie/Captain/Striker/Star/Legend/Icon/Hall of Fame
```

Implementation rules:
- Use `prisma.$transaction([...])` for: insert `XpTransaction` row, increment `User.xp`, recompute `User.level`, increment `XpDailyCap.count` (if applicable). All in one atomic block.
- The `XpTransaction.@@unique([userId, idempotencyKey])` constraint is the source of truth for one-time awards. Catch the unique-violation error (`P2002`) and return `{ awarded: 0, reason: 'duplicate' }` instead of throwing.
- Cap check uses `prisma.xpDailyCap.upsert` with a conditional update. If `count + 1 > cap`, return `{ awarded: 0, reason: 'cap_reached' }`.
- The `XP_VALUES` map (action → amount) is the single source of truth. Export it.
- `levelFromXp` uses the closed-form inverse of the curve: solve `290 + 125·(N−2)·(N−1) ≤ xp` for N. Implement as a binary search bounded by 200 (handles 308k XP comfortably). Pure function — write a property test that round-trips xpForLevel ↔ levelFromXp.
- Always return `previousLevel` and `newLevel` so the controller can decide whether to push a `LEVEL_UP` notification.
- On level-up, also create a `Notification` row with `type = LEVEL_UP` (existing enum) so the in-app notification feed stays in sync.

---

### 3. Backend — wire `awardXp` into existing endpoints

**Profile updates (`src/routes/clerk-auth.routes.ts` or wherever profile updates live — search for `updateProfile`/`syncUserWithBackend`):**
- After saving the avatar: if `lastAvatarChange` was previously null, fire `awardXp(PROFILE_AVATAR, key='profile.avatar.first')`.
- After saving displayName: if the user previously had no displayName (null/empty), fire `PROFILE_DISPLAY_NAME` with key `profile.displayName.first`.
- After saving bio: if the new bio length ≥ 20 AND no prior bio with length ≥ 20 was recorded (check via XpTransaction lookup with the idempotency key), fire `PROFILE_BIO` with key `profile.bio.first`.
- After saving each social link: validate URL pattern, then fire `PROFILE_SOCIAL_<PLATFORM>` with key `profile.social.<platform>.first`.
- After saving each FIFA field: fire `PROFILE_FIFA_<FIELD>` with key `profile.fifa.<field>.first`.
- After saving any FIFA field: check if all 8 fields are now non-null; if yes, fire `PROFILE_FIFA_COMPLETE` with key `profile.fifa.complete`.
- Update `profileCompletionSteps` and `profileCompletionPercentage` in the same transaction so the existing UI keeps working.

**Reels (`src/routes/upload.routes.ts` and `src/routes/reels.routes.ts`):**
- Reel upload (after Mux confirms / DB row created): `awardXp(REEL_UPLOAD, dailyCap=3)`.
- Comment created (≥ 5 chars after trim, not a duplicate of the user's last comment on the same reel): `awardXp(REEL_COMMENT, dailyCap=10)`.
- Share/save endpoint: `awardXp(REEL_SHARE, dailyCap=20, idempotencyKey='reel:<reelId>:share')` so the same reel can't farm multiple shares from one user.
- View counter increment: when a reel's `views` crosses 100 for the first time, fire `REEL_VIEWS_100` to the **owner** with key `reel:<reelId>:views100`.

**Predictions (`src/routes/predictions.routes.ts` and the queue that settles matches):**
- When a match is settled, for each user prediction: if exact score correct → `awardXp(PREDICTION_EXACT, idempotencyKey='match:<matchId>:user:<userId>:exact')`. Else if winner correct → `awardXp(PREDICTION_WINNER, idempotencyKey='match:<matchId>:user:<userId>:winner')`. Never both.
- If a match is canceled/abandoned, **revert** any XP awarded for that match by inserting a negative `XpTransaction` and decrementing `User.xp` (recomputing level). This is the only path that decreases `User.xp` aggregate.

**Quizzes (`src/routes/quiz.routes.ts`):**
- Per correct answer: `awardXp(QUIZ_ANSWER_CORRECT, dailyCap=50, idempotencyKey='quiz:question:<questionId>:user:<userId>')`.
- On quiz completion if score ≥ 80%: `awardXp(QUIZ_COMPLETED_HIGH, idempotencyKey='quiz:attempt:<attemptId>')`.

**Daily login (the place where Clerk users sync — same handler that already updates `consecutiveLoginDays`):**
- Compute today's date in user's timezone. Compare with `LoginStreak.lastLoginDate`:
  - Same date → no-op (already counted today).
  - Yesterday → `current += 1`.
  - Older → `current = 1` (streak broken).
  - First time → create row, `current = 1`.
- Award XP using `LOGIN_STREAK_TABLE[Math.min(current, 7)]` — so day 7 and beyond all award 50 XP.
- Idempotency key: `login:<YYYY-MM-DD>` per user → guarantees one-per-day even with multiple opens.
- Update `User.consecutiveLoginDays` to `LoginStreak.current` so the existing UI keeps working.

**API response augmentation:**
- Every endpoint that may award XP **must** include `xpEvents: XpEvent[]` in its response, where `XpEvent` is `{ action, amount, leveledUp, newLevel, newTitle? }`.
- The frontend reads `xpEvents` and displays toasts + level-up modal.
- For endpoints that don't yet return JSON envelopes, wrap the existing payload as `{ data: <existing>, xpEvents: [...] }`.

---

### 4. Backend — public XP/level read endpoint

```
GET /api/xp/me                         → { xp, level, title, xpToNext, progressPct, streak: { current, longest } }
GET /api/xp/users/:userId              → { xp, level, title }   (PUBLIC — for viewing other users)
GET /api/xp/me/history?limit=20        → { transactions: [{ action, amount, createdAt, metadata }] }
GET /api/xp/curve                      → { levels: [{ level, xpRequired, title }] }   (cached 1h)
```

- All endpoints under `/api/xp/me*` require Clerk auth.
- `/api/xp/users/:userId` is public-readable but never exposes daily caps, transaction history, or internal IDs.
- Cache `/api/xp/curve` and `/api/xp/users/:userId` via `responseCacheMiddleware`.

---

### 5. Backend — retroactive migration script

Create `src/scripts/backfill-xp.ts` that runs once over all existing users and awards XP for completed profile actions **without** triggering toasts (toasts only fire for live actions post-launch).

Implementation:
- For each user, check current state: `avatar` set → award; `bio.length >= 20` → award; each social → award; each FIFA field → award; if all 8 FIFA fields → bonus.
- Skip awards whose idempotency key already exists (so re-running is safe).
- Recompute `User.xp` and `User.level` at the end of each user's pass.
- Log a summary: `{ usersProcessed, xpAwarded, levelUps }`.
- Do NOT fire `LEVEL_UP` notifications during backfill (silent migration).
- Add an npm script `backfill:xp` in `package.json`.

---

### 6. Backend — property-based tests

Create `src/__tests__/xp.property.test.ts` using `fast-check`:

- `xpForLevel` is strictly increasing on level.
- `levelFromXp(xpForLevel(N)) === N` for any N in [1, 200].
- `levelFromXp(x)` is monotonically non-decreasing in `x`.
- `awardXp` is idempotent: calling twice with same `idempotencyKey` results in only one transaction (use a test DB or mocked Prisma).
- Daily cap: awarding `cap + 1` times in one day yields exactly `cap × amount` total XP.
- Reverting an awarded transaction never produces negative `User.xp` (balance stays ≥ 0).

These tests must pass before the system ships.

---

### 7. Frontend — `XpContext` + `useXp` hook

Create `front/contexts/XpContext.tsx` modeled exactly on `front/contexts/CoinsContext.tsx`. It:

- Reads from `GET /api/xp/me` on mount and on `useUser` change.
- Polls every 60s OR refreshes when the app foregrounds (use `AppState` listener).
- Exposes:
  ```typescript
  interface XpContextType {
    xp: number;
    level: number;
    title: string;
    xpToNext: number;       // XP needed to reach the next level
    progressPct: number;    // 0..100
    streak: { current: number; longest: number };
    loading: boolean;
    refresh: () => Promise<void>;
    /** Frontend hook into server-driven xp events to trigger toasts/modal. */
    handleXpEvents: (events: XpEvent[]) => void;
  }
  ```
- `handleXpEvents` queues toasts via the existing toast system (`front/services/toastManager.ts` already exists — extend it with an `xp` variant, or create `XpToast` if needed).
- When any event has `leveledUp: true`, push it to a shared `LevelUpModalContext` queue so the modal opens immediately.

Mount `XpProvider` inside `front/app/_layout.tsx` next to `CoinsProvider`.

---

### 8. Frontend — server-driven event dispatch

Create `front/services/apiClient.ts` (or extend the existing fetch wrapper). Every successful response is intercepted; if `xpEvents` array is present:

```typescript
import { useXp } from '@/contexts/XpContext';

// in api wrapper:
if (response.xpEvents?.length) {
  XpEventBus.emit(response.xpEvents);
}
```

Then a single subscriber inside `XpProvider` calls `handleXpEvents` so toasts and modal fire even when the call site doesn't know about XP.

If a fetch wrapper doesn't exist, create a thin one: `apiFetch(path, options)` that returns `{ data, xpEvents }`. Don't touch every existing fetch — but DO wrap the ones in: `clerk-auth.routes` profile updates, reels upload/comment/share, predictions submit, quiz submit, daily login. Update those call sites to use `apiFetch`.

---

### 9. Frontend — `XpBadge` component

Create `front/components/common/XpBadge.tsx` modeled on `CoinsBadge.tsx` (same look, purple instead of yellow):

- Props: `{ xp: number; level: number; size?: 'sm' | 'md' | 'lg'; onPress?: () => void }`
- Shows: `{xp.toLocaleString()} XP · Lv. {level}` exactly (per user request: "يظهر النقاط وجمبها المستوى").
- Glass background (LiquidGlassView with BlurView fallback), purple gradient border, lightning-bolt icon.
- Animated count-up when `xp` prop changes (use Reanimated `withTiming` on a derived shared value).
- Tappable → navigates to `/(tabs)/rank` (so the user can "see what level they reached" — per spec).

**Where to render it:**
- `front/app/(tabs)/profile.tsx` → next to `CoinsBadge` in the profile header (mirror layout).
- `front/app/user/[username].tsx` → next to the username/verified badge (public read; takes raw `xp`/`level` from the public profile API).
- `front/components/rank/ProfileCard.tsx` → REPLACE the current placeholder `Lv. 1 / 0 XP` markup with `<XpBadge xp={xp} level={level} />` driven by `useXp()`.

Do NOT show the daily-cap status, streak count, or transaction history on the public profile — only `xp` and `level`.

---

### 10. Frontend — `LevelUpModal`

Create `front/components/common/LevelUpModal.tsx`. Visual reference: the prediction Modal in `front/components/Matches/GradientMatchCard.tsx` (search for `showPredictionModal` and `modalScaleAnim`).

Specs:
- Triggered by `LevelUpModalContext` queue. If multiple level-ups happen back-to-back (rare but possible), show them one after the other.
- **Backdrop:** full-screen `LiquidGlassView` (with `BlurView intensity={60}` fallback) so the rest of the app is "frozen" behind a glass layer. Per user: "تعمل عزل للباك جرواند مع ليككيود جلاس".
- **Card:** centered, glass effect, purple gradient border, ~320px wide.
- **Content (top to bottom):**
  - "✨ LEVEL UP ✨" headline (i18n key)
  - Animated big number transition: `previousLevel` → `newLevel` (use Reanimated to morph)
  - New title (e.g. "Captain") below
  - Optional sparkle / glow effects (LinearGradient + Animated views)
  - "Claim" / dismiss button at the bottom
- **Auto-dismiss:** 5 seconds. User can dismiss earlier via tap-anywhere or the close button. Use a `setTimeout` cleared on unmount.
- **Haptics on open:** `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`.
- **Vibration fallback (Android, when haptics not supported):** `Vibration.vibrate([0, 80, 50, 80])` — short double-pulse pattern. Use a feature check: if `Haptics.notificationAsync` resolves, skip vibration; otherwise call `Vibration.vibrate`.
- **NO sound effect.** Do not import `expo-av`. Per user instruction.
- **i18n:** every label in `en.ts` AND `ar.ts` (and the other 6 locales — at minimum en + ar, leave a TODO comment for the other six).

Mount `<LevelUpModal />` once in `front/app/_layout.tsx` so it can fire from anywhere.

---

### 11. Frontend — XP toast

Extend `front/services/toastManager.ts` with an XP variant:

```typescript
toastManager.showXp({
  amount: 50,
  reason: t.xp.toasts.firstAvatar,    // localized text
});
```

- Visual: glass pill in top-of-screen, purple border, lightning icon, "+50 XP" big, reason small.
- Animation: spring slide-down from top, auto-dismiss 2.5s.
- Queueable: if multiple events arrive (e.g. quiz with 5 correct in a row), display them stacked or sequenced — your call, but don't drop any.

---

### 12. Frontend — i18n keys

Add to `front/locales/en.ts` AND `front/locales/ar.ts` under a new `xp` namespace:

```typescript
xp: {
  badge: { suffix: 'XP', levelPrefix: 'Lv.' },
  titles: {
    rookie: 'Rookie',
    captain: 'Captain',
    striker: 'Striker',
    star: 'Star',
    legend: 'Legend',
    icon: 'Icon',
    hallOfFame: 'Hall of Fame',
  },
  levelUpModal: {
    headline: 'LEVEL UP',
    youAreNow: "You're now Level {{level}}",
    claim: 'Claim',
    dismiss: 'Dismiss',
  },
  toasts: {
    earned: '+{{amount}} XP earned',
    firstAvatar: 'First profile picture',
    firstDisplayName: 'Display name set',
    firstBio: 'Bio added',
    firstSocial: '{{platform}} link added',
    fifaField: 'Profile detail saved',
    fifaComplete: 'Card complete!',
    reelUpload: 'Reel uploaded',
    reelComment: 'Comment posted',
    reelShare: 'Reel shared',
    reelViews100: 'Your reel hit 100 views',
    predictionExact: 'Exact prediction!',
    predictionWinner: 'Correct prediction',
    quizCorrect: 'Correct answer',
    quizCompleted: 'Quiz completed',
    dailyLogin: 'Daily login streak {{day}}',
  },
  errors: {
    capReached: "You've hit today's cap for that action",
  },
},
```

Provide the Arabic translations in `ar.ts`. For the other 6 locales (es/fr/de/it/pt/tr), add the same keys with English fallback values and a `// TODO: translate` comment so the build doesn't break.

---

### 13. Verification checklist (the agent must tick every box)

**Backend**
- [ ] Migration `add_xp_system` created and applied locally without errors.
- [ ] `XpTransaction`, `XpDailyCap`, `LoginStreak` tables exist with the exact schema above.
- [ ] `XpActionType` enum contains every action listed.
- [ ] `awardXp` is the single entry point — no controller writes to `User.xp` directly.
- [ ] `awardXp` uses `prisma.$transaction` for the atomic write set.
- [ ] Unique-violation on `(userId, idempotencyKey)` returns `{ awarded: 0, reason: 'duplicate' }` instead of throwing.
- [ ] Daily cap rejection returns `{ awarded: 0, reason: 'cap_reached' }`.
- [ ] `levelFromXp` and `xpForLevel` are pure and round-trip in tests.
- [ ] All endpoints listed in §3 fire the correct `awardXp` calls with the documented idempotency keys.
- [ ] All endpoints in §3 return `xpEvents` in the response envelope.
- [ ] Match cancellation reverts XP via a negative `XpTransaction` and recomputes level.
- [ ] `/api/xp/me`, `/api/xp/users/:userId`, `/api/xp/me/history`, `/api/xp/curve` all work.
- [ ] `/api/xp/users/:userId` does NOT expose daily caps or transaction history.
- [ ] Property tests in `src/__tests__/xp.property.test.ts` pass.
- [ ] `backfill:xp` script runs cleanly on a sample DB (rerunnable, no duplicates).
- [ ] Daily login streak resets correctly when a day is missed.
- [ ] Daily caps reset at midnight in the user's timezone (uses `x-user-timezone` header).
- [ ] Social-link XP fires only on valid `https?://<platform>.com/...` URLs.
- [ ] Bio XP fires only when length ≥ 20.
- [ ] No `console.log` in committed code; all logs use the Winston logger.
- [ ] No new `Prisma` client instances; everything imports from `src/lib/prisma`.

**Frontend**
- [ ] `XpProvider` is mounted in `_layout.tsx` next to `CoinsProvider`.
- [ ] `useXp()` returns `{ xp, level, title, xpToNext, progressPct, streak, loading, refresh, handleXpEvents }`.
- [ ] `XpBadge` renders `{xp} XP · Lv. {level}` and is purple, glass, with lightning icon.
- [ ] `XpBadge` appears in `app/(tabs)/profile.tsx` next to `CoinsBadge`.
- [ ] `XpBadge` appears in `app/user/[username].tsx` next to the user's name.
- [ ] `components/rank/ProfileCard.tsx` now reads xp/level from `useXp()` instead of placeholder props.
- [ ] `LevelUpModal` opens with a `LiquidGlassView` backdrop (BlurView fallback), auto-dismisses after 5s, can be tapped to dismiss earlier.
- [ ] `LevelUpModal` triggers `Haptics.notificationAsync(Success)` on open; falls back to `Vibration.vibrate([0, 80, 50, 80])` if haptics unavailable.
- [ ] No `expo-av` import anywhere related to XP.
- [ ] XP toasts appear in top-of-screen, queue correctly when multiple events arrive together (test with quiz multi-answer).
- [ ] `apiClient` (or per-call wrappers) intercepts `xpEvents` and dispatches them to `XpProvider`.
- [ ] All `xp.*` i18n keys exist in `en.ts` AND `ar.ts`.
- [ ] No `any` types in new files; no suppressions.
- [ ] No external avatar URLs (`pravatar`/`flagcdn`) introduced.
- [ ] Tests run: `npm test` (backend) and `npm test --workspace=front` (frontend) pass.
- [ ] App compiles: `npm run build` (backend) succeeds.

---

## Constraints

- **Do NOT** add new dependencies. The stack already has: `prisma`, `@tanstack/react-query`, `expo-image`, `expo-haptics`, `react-native-reanimated`, `@callstack/liquid-glass`, `expo-blur`, `lucide-react-native`. `Vibration` ships with React Native core.
- **Do NOT** introduce a sound system (`expo-av`).
- **Do NOT** modify `prisma/schema.prisma` outside the additions described in §1.
- **Do NOT** edit any applied migration. Create a new one.
- **Do NOT** weaken the daily caps or idempotency guarantees, even for "developer accounts". Use the existing RBAC `ADMIN_ADJUSTMENT` action via the dedicated admin path if you need to grant XP manually.
- **Do NOT** decrement `User.xp` directly — only via a negative `XpTransaction` recorded in the audit table.
- **Do NOT** leak emails, internal IDs, raw Clerk IDs, or daily-cap state in any public XP response.
- **Do NOT** show toasts for retroactive backfill; only for live post-launch actions.
- **Do NOT** depend on the client to compute level — backend recomputes on every award.
- All new strings must be in `en.ts` AND `ar.ts` at minimum; leave `// TODO: translate` for the other six locales.
- Follow existing patterns: routes → controllers → services. No business logic in controllers. Shared singletons for Prisma/Redis. RTL-safe styles. `start`/`end` over `left`/`right`.

---

## Suggested execution order

1. Schema + migration + enum.
2. `xp.service.ts` with pure helpers + property tests.
3. `awardXp` core implementation + integration tests.
4. Wire one endpoint end-to-end (profile avatar) and verify the full chain works.
5. Wire remaining endpoints.
6. Add `/api/xp/*` read endpoints.
7. Backfill script.
8. Frontend `XpContext` + `XpBadge`.
9. Frontend `LevelUpModal` + toast.
10. Wire the response interceptor.
11. Mount badges in profile/rank/user screens.
12. i18n.
13. Run all tests, build, and tick the verification checklist.
