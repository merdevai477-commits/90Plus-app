# 90Plus Rank Screen — Comprehensive Fix Prompt

You are working on the **90Plus** football social app (React Native / Expo + Node.js/Express + Prisma).
Read every file reference carefully before touching anything. Fix **all** issues listed below in one pass.
Follow the project conventions in `.kiro/steering/` (structure.md, Mr.dev.md, product.md).

---

## Repository layout (relevant to this task)

```
front/
├── app/(tabs)/rank.tsx                          ← Main rank screen
├── components/rank/
│   ├── RankHeader.tsx                           ← Floating header (90PLUS logo + coins)
│   ├── ProfileCard.tsx                          ← User profile strip
│   ├── CompCard.tsx                             ← Competition card (horizontal list)
│   ├── WCCard.tsx                               ← World Cup countdown banner
│   ├── PodiumCard.tsx                           ← Podium FIFA card wrapper (top 3)
│   ├── FifaCard.tsx                             ← FIFA-style card component
│   ├── LeaderboardModal.tsx                     ← Top-11 modal
│   └── SoonModal.tsx                            ← "Coming soon" modal
├── contexts/CoinsContext.tsx                    ← Real-time coins (useCoins())
├── src/services/authService.ts                  ← AuthService.syncUserWithBackend(), UserProfile type
├── hooks/useProfileCache.ts                     ← Cached profile loader (reuse if possible)
├── constants/                                   ← Add WC_DATE here
├── config/api.config.ts                         ← API base URL + endpoints
└── locales/
    ├── en.ts
    └── ar.ts

src/routes/reels.routes.ts                       ← Backend rankings endpoints:
  GET /api/reels/rankings/top-players            ← returns { data: { players: [...] } }
  GET /api/reels/rankings/user-rank              ← current user's rank
src/routes/predictions.routes.ts
  GET /api/predictions/leaderboard               ← predictor leaderboard
```

---

## Backend response shape you must consume (already implemented)

`GET /api/reels/rankings/top-players?limit=11&period=weekly` returns:

```typescript
{
  status: 'SUCCESS',
  data: {
    players: Array<{
      id: string;
      username: string;
      displayName: string | null;
      avatar: string | null;
      isVerified: boolean;
      level: number;
      xp: number;
      position: string;        // e.g. 'ST'
      countryFlag: string;     // e.g. '🇪🇬'  (NOTE: this is an emoji, not a 2-letter code)
      clubLogo: string | null;
      followersCount: number;
      stats: { totalViews: number; totalLikes: number; profileViews: number };
      score: number;
      rank: number;
      badge: 'gold' | 'silver' | 'bronze' | null;
    }>;
    totalCount: number;
    period: 'weekly' | 'monthly';
  }
}
```

**Important:** `countryFlag` from the backend is an **emoji string**, but `FifaCard.tsx` currently renders a flag from `flagcdn.com` using a **2-letter country code**. You must bridge this — see FIX 11.

`GET /api/reels/rankings/user-rank` returns the current user's rank across categories (auth required).

---

## Issues to fix — read each one fully before writing code

---

### FIX 1 — Remove the `mr.dev` verified badge

**File:** `front/components/rank/ProfileCard.tsx`

**Problem:** The profile card always shows a blue verified tick next to the username — it's a hardcoded `mr.dev` placeholder, not driven by real user verification state.

**Fix:** Remove the `verifiedBadge` View + its `verifiedTxt` child entirely. Remove the unused styles `verifiedBadge` and `verifiedTxt`. The username row should just show the name (and later we can add a real verified badge driven by `user.isVerified` from the backend, but NOT now).

---

### FIX 2 — Wire `ProfileCard` to the real user (avatar, name, level, XP)

**File:** `front/components/rank/ProfileCard.tsx`

**Problem:** Everything is hardcoded:
```typescript
source={{ uri: 'https://i.pravatar.cc/150?img=12' }}   // ❌ pravatar
<Text style={s.username}>mr.dev</Text>                  // ❌ static
<Text style={s.lvlTxt}>Lv. 18</Text>                    // ❌ static
<Text style={s.xpCur}>2400</Text>                       // ❌ static
<Text style={s.xpMax}> / 3000 XP</Text>                 // ❌ static
width: '80%'                                            // ❌ hardcoded bar fill
```

**Fix:** Use the existing `useProfileCache` hook (or `useUser` from `@clerk/clerk-expo` + `AuthService.syncUserWithBackend`) to get real user data. Then:

- **Avatar:** `user.avatar` (Cloudflare R2 URL). Fallback to Clerk's `imageUrl`. Fallback to a local placeholder (`require('../../assets/images/plear 90Plus.png')`). Use `expo-image` for caching, matching the chat fix.
- **Username:** `user.displayName || user.username || 'كابتن'`.
- **Level:** `level = 1` for now. Do NOT show `Lv. 18`. Show `Lv. 1`.
- **XP:** `currentXp = 0`, `nextLevelXp = 100` for now. Do NOT show `2400 / 3000 XP`. Show `0 / 100 XP`.
- **XP bar fill:** computed as `${(currentXp / nextLevelXp) * 100}%`. With `0 / 100`, the bar is empty (`0%`).

**Rationale (from the user):** "المستخدم يكون ليفيل 1 … يتم استيراد النقاط بتاعت الخبره خليها دلوقتي 0 لان كدا كدا مفيش مصنفين استنا لما اقولك نظام النقاط هيكون ازاي." So level is 1 and XP is 0 until the scoring system is defined. Expose `level` and `xp` as props with defaults `{ level = 1, xp = 0, xpToNextLevel = 100 }` so swapping to real data later is a one-line change.

**Types:** Export a `ProfileCardProps` interface. No `any`.

---

### FIX 3 — Make the profile card navigate to the user's own profile on tap

**File:** `front/components/rank/ProfileCard.tsx`

**Problem:** The card is currently a plain `View` — it's not tappable.

**Fix:** Wrap the entire card in a `Pressable` (preferred over `TouchableOpacity` for consistency with the rest of the codebase). On press, navigate to the user's own profile tab using `expo-router`:

```typescript
import { useRouter } from 'expo-router';
// ...
const router = useRouter();
// ...
<Pressable onPress={() => router.push('/(tabs)/profile' as any)}>
  {/* existing card */}
</Pressable>
```

Add a light press feedback (opacity `0.85` when pressed) and an `accessibilityRole="button"` with a localized label.

**User's words:** "لو عملت كليك عليهاا ااروح على البروفايل بتاعي في التصنيف."

---

### FIX 4 — Replace the hardcoded coin counter with real coins

**File:** `front/components/rank/RankHeader.tsx`

**Problem:**
```typescript
<Text style={s.coinTxt}>50</Text>   // ❌ hardcoded
```

**Fix:** Import `useCoins` from `../../contexts/CoinsContext` and bind the display to `coins`. While `loading` is true, show a dash (`—`) instead of a misleading number.

```typescript
import { useCoins } from '../../contexts/CoinsContext';
// ...
const { coins, loading } = useCoins();
// ...
<Text style={s.coinTxt}>{loading ? '—' : coins}</Text>
```

Do NOT introduce a new state. The `CoinsProvider` is already mounted at the app root.

---

### FIX 5 — Connect Top 3 podium + lower leaderboard to real data

**File:** `front/app/(tabs)/rank.tsx`

**Problem:** `PODIUM` and `LOWER` arrays are hardcoded with `"Start Now!"`, `"Be the First!"`, etc. Even the `avatar: 'https://i.pravatar.cc/150?u=4'` is a third-party placeholder.

**Fix:**
1. Create a new hook file `front/hooks/useTopPlayers.ts` that fetches `GET /api/reels/rankings/top-players?limit=11&period=weekly` using React Query (`@tanstack/react-query` — already in the project). Cache for 5 minutes (match backend TTL). Return `{ players, isLoading, isError, refetch }`.
2. In `rank.tsx`, call `useTopPlayers()`. Derive:
   - `podium` = players 1, 2, 3 (but display order visually is 2 → 1 → 3, as the existing code does)
   - `lower` = players 4 and 5
3. While loading, show skeleton placeholders (use `ConversationSkeleton` pattern from `front/components/chat/SkeletonLoader.tsx` as a reference — build a simple `PodiumSkeleton` and `BoardRowSkeleton` in `front/components/rank/RankSkeletons.tsx`).
4. On error, show a small inline retry banner (use localized text — see FIX 13).
5. **Empty-state handling (critical per user's brief):** if the API returns fewer than 3 players (which is the current reality — there are no ranked players yet), **render empty-slot placeholders**. User's words: "المراكز الباقيه بيتم استيراد برده نفس الكلام."

   Concretely — for every missing rank 1/2/3/4/5, render the same styled card/row but with:
   - avatar = local `plear 90Plus.png` asset
   - name = `t.rank.emptySlot` (localized)
   - xp = `0 XP`
   - position/country: neutral defaults

   When the backend returns a real player, use their real data.

**Important:** NEVER fall back to `https://i.pravatar.cc/...` or any external avatar service. Use the user's `avatar` (Cloudflare R2), or the local placeholder.

---

### FIX 6 — `LeaderboardModal` must show real top-11 with the logged-in user included

**File:** `front/components/rank/LeaderboardModal.tsx` and `front/app/(tabs)/rank.tsx`

**Problem:** The `TOP_11` array in `rank.tsx` is generated from `https://i.pravatar.cc/...` and hardcoded names `"Player #1"`, `"Player #2"`, etc. The `entries` prop receives this fake data.

**Fix:**
- Pass the real `players` array from `useTopPlayers()` as the `entries` prop.
- For each entry, show: rank, avatar (from backend), displayName, XP (`${xp} XP`, or `0 XP` if null).
- Rank 1/2/3 keep the medal emojis; ranks 4+ show the plain number.
- Update the `LeaderboardEntry` interface to match the real API shape:
  ```typescript
  interface LeaderboardEntry {
    rank: number;
    id: string;
    displayName: string;
    username: string;
    avatar: string | null;
    xp: number;
  }
  ```
- **Empty-slot fill:** if fewer than 11 real players exist, pad the list to 11 entries with `emptySlot` placeholders (same as FIX 5).
- Fix the accidental `onClose` trigger: the current `<TouchableOpacity style={s.modalOverlay} onPress={onClose}>` wraps the content. Restructure so the overlay is a sibling `Pressable` that sits behind the content, and the content View does NOT call `onClose`. The close button (✕) still calls `onClose`.

---

### FIX 7 — Centralize `WC_DATE` in one place

**Files:** `front/components/rank/WCCard.tsx`, `front/components/rank/SoonModal.tsx`, (new) `front/constants/worldCup.ts`

**Problem:** `const WC_DATE = new Date('2026-06-11T00:00:00').getTime();` is duplicated in both files.

**Fix:** Create `front/constants/worldCup.ts`:

```typescript
/**
 * FIFA World Cup 2026 opening match:
 * Thursday, June 11, 2026 — Estadio Azteca, Mexico City.
 * Kickoff: 20:00 local (CDT, UTC-5) → 2026-06-12T01:00:00Z.
 * We keep the date in UTC so countdowns are correct in every timezone.
 */
export const WC_2026_KICKOFF_UTC = new Date('2026-06-12T01:00:00Z');
export const WC_2026_KICKOFF_MS = WC_2026_KICKOFF_UTC.getTime();
```

Import `WC_2026_KICKOFF_MS` in both `WCCard.tsx` and `SoonModal.tsx` and remove the local `WC_DATE` constants.

**User's words:** "عداد كاس العالم يكون مبظط بالظبط على الوقت الي الباقي لكاس العالم 2026." Make sure the countdown is anchored to the real World Cup 2026 opening kickoff (June 11, 2026, Mexico City, 20:00 CDT) expressed as a UTC timestamp so all devices see the same remaining time.

---

### FIX 8 — Countdown intervals must stop when not visible

**Files:** `front/components/rank/WCCard.tsx`, `front/components/rank/SoonModal.tsx`

**Problem:**
```typescript
useEffect(() => {
  const id = setInterval(() => setT(getTimeLeft()), 1000);
  return () => clearInterval(id);
}, []);
```

Runs every second forever. In `SoonModal`, it runs even when `visible` is false. In `WCCard`, it re-renders the tab every second when the user is looking at something else.

**Fix:**

- In `SoonModal.tsx`: change `useEffect` deps to `[visible]` and start the interval only when `visible === true`. When the modal closes, clear the interval AND the derived state goes stale — but that's fine because the next open recomputes.

  ```typescript
  useEffect(() => {
    if (!visible) return;
    setT(getTimeLeft());
    const id = setInterval(() => setT(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, [visible]);
  ```

- In `WCCard.tsx`: expose the component as-is, but gate the interval behind the tab focus. Use `useIsFocused` from `@react-navigation/native` (already in the project) to pause the interval when the Rank tab is NOT focused:

  ```typescript
  import { useIsFocused } from '@react-navigation/native';
  // ...
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) return;
    const id = setInterval(() => setT(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, [isFocused]);
  ```

Also: drop the per-second granularity when the remaining time is > 1 day. When `days > 1`, tick every minute (`60 * 1000`). When `days <= 1`, tick every second. This reduces wasted re-renders without hurting UX (no one stares at a ticking seconds counter when the event is months away).

---

### FIX 9 — Full i18n for the rank screen

**Files:** `front/locales/en.ts`, `front/locales/ar.ts`, all rank components.

**Problem:** Every user-facing string on the rank screen is hardcoded in English.

**Fix:** Add a `rank` branch to both locale files. Minimum keys required:

```typescript
rank: {
  competitions: { title: string; tagline: string; subtitle: string };  // "Competitions" / "Play. Compete. Win." / "Join challenges and climb the ranks!"
  allCompetitions: string;                                             // "All Competitions"
  topPlayers: string;                                                  // "Top Players"
  viewAll: string;                                                     // "VIEW ALL"
  emptySlot: string;                                                   // "Empty Slot"
  emptySlotHint: string;                                               // "Challenge to appear here"
  futureChampion: string;                                              // "Future Champion"
  beTheFirst: string;                                                  // "Be the First!"
  startNow: string;                                                    // "Start Now!"
  createGlory: string;                                                 // "Create Glory!"
  xpSuffix: string;                                                    // "XP"
  levelPrefix: string;                                                 // "Lv."
  globalRank: string;                                                  // "Global Rank"
  leaderboardTitle: string;                                            // "Top 11 Leaderboard"
  worldCup: {
    headline: string;        // "Create\nGlory"
    body: string;            // "Compete with others and reach\nthe top of the leaderboard!"
    comingSoon: string;      // "Coming Soon"
    countdownLabel: string;  // "World Cup starts in"
    anticipate: string;      // "ANTICIPATE"
    brand: string;           // "90 PLUS WORLD CUP"
    getReady: string;        // "GET READY"
    days: string; hours: string; mins: string; secs: string;
  };
  competitionNames: {
    kingOfPredictions: { title: string; sub: string; action: string };
    engagementHero:    { title: string; sub: string; action: string };
    dailyQuiz:         { title: string; sub: string; action: string };
    shareAndEarn:      { title: string; sub: string; action: string };
  };
  errors: { loadFailed: string; retry: string };
}
```

Add the Arabic translations for every key. The rank screen must work without any English leaking through.

Then replace every hardcoded string in:
- `rank.tsx` (`COMPETITIONS` entries, section headers, view-all button)
- `ProfileCard.tsx` (level prefix, XP suffix)
- `PodiumCard.tsx` (`podXpLabel` — the "XP" part)
- `CompCard.tsx` (action text falls back to translated `playNow`)
- `WCCard.tsx` (headline, body, CTA, countdown labels)
- `SoonModal.tsx` (title, brand, close CTA, labels)
- `LeaderboardModal.tsx` (title, "Global Rank" sublabel)
- `RankHeader.tsx` (accessibility labels)

Usage: `const { t } = useTranslation();` (existing project hook — see how `LimitReachedMessage.tsx` uses it after the chat fixes).

---

### FIX 10 — RTL-safe styles

**Files:** `rank.tsx`, `ProfileCard.tsx`, `PodiumCard.tsx`, `CompCard.tsx`, `WCCard.tsx`, `SoonModal.tsx`, `LeaderboardModal.tsx`, `RankHeader.tsx`.

**Problem:** Every `flexDirection: 'row'` is hardcoded LTR. In Arabic the layout is visually mirrored.

**Fix:** For every row that contains asymmetric content (icon + text, avatar + info, left + right CTA), do one of:

- Use `I18nManager.isRTL` to flip direction:
  ```typescript
  import { I18nManager } from 'react-native';
  const rowDirection: 'row' | 'row-reverse' = I18nManager.isRTL ? 'row-reverse' : 'row';
  ```
- OR use `start`/`end` margin/padding instead of `left`/`right`.

Specifically apply this to:
- `rank.tsx`: `titleRow`, `podiumRow`, `secHead` (the section header with "VIEW ALL").
- `ProfileCard.tsx`: `profileRow`, `nameRow`, `xpRow`.
- `RankHeader.tsx`: `headerContainer` (logo on start, coin chip on end).
- `LeaderboardModal.tsx`: `modalRow`, `modalHeader`.
- `WCCard.tsx`: `wcInner` (left text block + right countdown block).
- `CompCard.tsx`: `livePill` (icon + text inside the CTA pill).

For absolute-positioned elements (`wcRight: position: 'absolute', right: 0`), use `end: 0` instead of `right: 0`.

---

### FIX 11 — Country flag handling in FIFA card

**File:** `front/components/rank/FifaCard.tsx`, `front/components/rank/PodiumCard.tsx`

**Problem:** `FifaCard` expects a 2-letter country code and builds `https://flagcdn.com/w80/${countryFlag}.png`. But the backend returns an **emoji** like `🇪🇬`. Also, `flagcdn.com` is an external dependency that fails offline.

**Fix:**
1. Change the `FifaCard` `countryFlag` prop type to accept either:
   - a 2-letter ISO code (legacy)
   - OR a flag emoji string
2. Detect which format arrived. If the string contains non-ASCII codepoints (emoji), render it as `<Text>` instead of an `<Image>`. If it's a 2-letter code, keep the `flagcdn.com` path BUT gate the network image behind an error fallback (render the emoji `🏳️` or nothing if the image 404s).
3. In `PodiumCard.tsx`, when real backend data is used, pass the backend emoji directly. The hardcoded `'eg' / 'pt' / 'ar'` 2-letter codes must go away when real data is present.

```typescript
// Inside FifaCard
const isEmojiFlag = /[\u{1F1E6}-\u{1F1FF}]/u.test(countryFlag ?? '');
if (isEmojiFlag) {
  return <Text style={{ fontSize: 28 * scale }}>{countryFlag}</Text>;
}
// else: existing <Image /> code
```

Add a local fallback asset so offline users see something: `require('../../assets/images/football.png')` (or a neutral flag icon if available). Use `onError` on the Image to swap to the fallback.

---

### FIX 12 — Loading / error / empty states on the rank screen

**File:** `front/app/(tabs)/rank.tsx`

**Problem:** No loading skeleton, no error UI, no empty state. If the backend is down, the screen silently shows fake data — a product-safety issue because the invariant "moderation / strikes must preserve referential integrity" doesn't hold when the UI lies about the leaderboard.

**Fix:**
- While `useTopPlayers().isLoading`, render `<PodiumSkeleton />` (3 placeholder cards) and 2 `<BoardRowSkeleton />` rows.
- If `isError`, render a single error card with `t.rank.errors.loadFailed` and a `t.rank.errors.retry` button that calls `refetch()`. Use the same glass style as the existing board rows.
- If `!isLoading && players.length === 0`, render the empty-slot pattern described in FIX 5.

Create skeleton components in `front/components/rank/RankSkeletons.tsx` using the same `Animated.View` shimmer used elsewhere in the app (see `front/components/chat/SkeletonLoader.tsx`).

---

### FIX 13 — Fix `gap: -15` (unsupported)

**File:** `front/app/(tabs)/rank.tsx`

**Problem:**
```typescript
podiumRow: { ... gap: -15 }
```

Negative `gap` is not in the RN spec; behavior varies across platforms.

**Fix:** Replace with `marginHorizontal: -7.5` on the middle card OR use explicit `marginLeft: -15` / `marginRight: -15` on the outer two cards so they visually overlap. The explicit margins approach is the safer platform-agnostic fix.

---

### FIX 14 — Low-contrast `boardRole` color

**File:** `front/app/(tabs)/rank.tsx`

**Problem:**
```typescript
boardRole: { color: '#555', fontSize: 12 }
```
Contrast ratio against the dark background is < 3:1 → fails WCAG AA.

**Fix:** Use `rgba(255,255,255,0.55)` (≈ AA compliant on `#0A0612`). Same treatment for other muted labels across rank components where `color` is below `rgba(255,255,255,0.45)`.

---

### FIX 15 — `zIndex: -1` + weird arena dimensions

**File:** `front/app/(tabs)/rank.tsx`

**Problem:**
```typescript
arenaBgContainerExtended: { ..., zIndex: -1 }
arenaImgExtended: { width: '120%', height: '115%', top: -200, opacity: 0.5 }
```

`zIndex: -1` inside a `ScrollView` causes Android z-order bugs. `width: '120%'` is a hack.

**Fix:**
- Drop `zIndex: -1`. Instead, render the arena image **before** the content within the same parent and let the natural stacking order handle it.
- Constrain dimensions properly: `width: '100%'`, `height: 600` (or whatever the actual needed height is), `resizeMode: 'cover'`. No `top: -200`. If the design needs the image to "bleed" upward, use negative `marginTop` on the **container** instead.

---

### FIX 16 — `TouchableOpacity` → `Pressable`, and `activeOpacity` conflict with LiquidGlass

**Files:** `rank.tsx`, `CompCard.tsx`, `LeaderboardModal.tsx`, `WCCard.tsx`, `SoonModal.tsx`

**Problem:**
- The project prefers `Pressable` (used in chat components); `TouchableOpacity` is inconsistent.
- `CompCard` wraps a `LiquidGlassView` (which has its own `interactive` feedback) inside a `TouchableOpacity` with `activeOpacity={0.8}`. The two feedback layers conflict visually.

**Fix:**
- Replace every `TouchableOpacity` in rank components with `Pressable`.
- For `CompCard`: keep the `interactive` prop on the LiquidGlassView on iOS, and add manual press feedback inside the `Pressable` (`opacity: pressed ? 0.85 : 1`) only on Android / fallback path where LiquidGlass is not supported.

---

### FIX 17 — Use `expo-image` consistently

**Files:** `ProfileCard.tsx`, `LeaderboardModal.tsx`, `PodiumCard.tsx` (via FifaCard already uses `expo-image`), `rank.tsx`.

**Problem:** `ProfileCard` and `LeaderboardModal` use `Image` from `react-native`. The rest of the app uses `expo-image` (better caching, WebP support — required by mobile-perf rules in `Mr.dev.md`).

**Fix:** Swap `import { Image } from 'react-native'` → `import { Image } from 'expo-image'`. Add `contentFit="cover"`, `cachePolicy="memory-disk"`, and `transition={150}` on each `<Image>` that loads a remote URL.

Keep `Image` from `react-native` ONLY if the usage is for a local `require(...)` asset where `expo-image` behaves identically and swapping would add noise. When in doubt, prefer `expo-image`.

---

### FIX 18 — Fix the `Trophy` icon rendering

**File:** `front/app/(tabs)/rank.tsx`

**Problem:**
```typescript
<Trophy size={20} color="#fff" fill="#fff" />
```
`lucide-react-native` icons are stroke-based SVGs. Filling them with white loses the detail.

**Fix:** Remove the `fill="#fff"` — just use `color="#fff"`. Keep the size.

---

### FIX 19 — Proper modal overlay pattern

**Files:** `front/components/rank/LeaderboardModal.tsx`, `front/components/rank/SoonModal.tsx`

**Problem:** The outer `TouchableOpacity` with `activeOpacity={1}` is both the dismiss backdrop AND the container for the content. Taps on content can register as backdrop taps under some gestures.

**Fix:** Standard modal pattern:

```typescript
<Modal ...>
  <View style={StyleSheet.absoluteFill}>
    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
    <BlurView ... pointerEvents="none" />
    <View style={styles.content}>
      {/* content; NO onPress on this view */}
    </View>
  </View>
</Modal>
```

The backdrop dismisses; the content is a separate sibling that does NOT bubble the press.

---

### FIX 20 — `CompCard` fixed `height: 32` on subtitle

**File:** `front/components/rank/CompCard.tsx`

**Problem:**
```typescript
compSub: { ... height: 32 }
```

Fails once the text is translated to longer locales (Arabic, German). The text clips.

**Fix:** Remove the hardcoded `height: 32`. Instead use `minHeight: 32` and let the text wrap up to 2 lines with `numberOfLines={2}` on the `<Text>`.

---

## Summary of files to add or modify

| File | Status | Fixes |
|------|--------|-------|
| `front/app/(tabs)/rank.tsx` | modify | FIX 5, FIX 9, FIX 10, FIX 12, FIX 13, FIX 15, FIX 16, FIX 18 |
| `front/components/rank/ProfileCard.tsx` | modify | FIX 1, FIX 2, FIX 3, FIX 9, FIX 10, FIX 17 |
| `front/components/rank/RankHeader.tsx` | modify | FIX 4, FIX 9, FIX 10 |
| `front/components/rank/CompCard.tsx` | modify | FIX 9, FIX 10, FIX 16, FIX 20 |
| `front/components/rank/WCCard.tsx` | modify | FIX 7, FIX 8, FIX 9, FIX 10, FIX 16 |
| `front/components/rank/SoonModal.tsx` | modify | FIX 7, FIX 8, FIX 9, FIX 16, FIX 19 |
| `front/components/rank/PodiumCard.tsx` | modify | FIX 9, FIX 11 |
| `front/components/rank/FifaCard.tsx` | modify | FIX 11 |
| `front/components/rank/LeaderboardModal.tsx` | modify | FIX 6, FIX 9, FIX 10, FIX 17, FIX 19 |
| `front/components/rank/RankSkeletons.tsx` | **new** | FIX 12 |
| `front/hooks/useTopPlayers.ts` | **new** | FIX 5, FIX 6, FIX 12 |
| `front/constants/worldCup.ts` | **new** | FIX 7 |
| `front/locales/en.ts` | modify | FIX 9 |
| `front/locales/ar.ts` | modify | FIX 9 |

---

## Verification checklist (do not mark the task done until every box is ticked)

- [ ] Rank tab compiles without TypeScript errors.
- [ ] `mr.dev` verified blue tick is gone from `ProfileCard`.
- [ ] `ProfileCard` shows the actual logged-in user's avatar (from backend or Clerk fallback). No `pravatar.cc` anywhere.
- [ ] `ProfileCard` shows `Lv. 1` and `0 / 100 XP` (static placeholders — no `Lv. 18` / `2400 XP`).
- [ ] Tapping `ProfileCard` navigates to `/(tabs)/profile`.
- [ ] `RankHeader` coin counter reflects `useCoins().coins` (and shows `—` while loading). No hardcoded `50`.
- [ ] `useTopPlayers` hook exists and calls `/api/reels/rankings/top-players?limit=11&period=weekly` with React Query.
- [ ] Podium shows real top-3 from the API; if API returns < 3, empty-slot placeholders fill the remaining positions using the local `plear 90Plus.png` asset, name `t.rank.emptySlot`, and `0 XP`.
- [ ] Lower-leaderboard rows (ranks 4 and 5) apply the same empty-slot fill.
- [ ] `LeaderboardModal` shows the real 11 players (padded with empty slots to reach 11 if needed). Tapping content does NOT close the modal.
- [ ] Countdown in `WCCard` and `SoonModal` is sourced from `front/constants/worldCup.ts` (no duplicated `WC_DATE`).
- [ ] `WC_2026_KICKOFF_UTC` is set to the real World Cup 2026 opening kickoff (June 11, 2026 — 20:00 CDT → `2026-06-12T01:00:00Z`).
- [ ] `SoonModal` countdown interval only runs while the modal is visible.
- [ ] `WCCard` countdown interval pauses when the Rank tab is NOT focused. Tick rate is 60s when > 1 day remains, 1s when ≤ 1 day.
- [ ] Every user-facing string on the rank screen is loaded via `useTranslation()`. No English text hardcoded in JSX.
- [ ] Both `en.ts` AND `ar.ts` contain all new keys.
- [ ] Arabic render is RTL-correct: the coin chip sits on the logical `end` side; profile rows flip under `I18nManager.isRTL`.
- [ ] `FifaCard` handles both emoji-flag and 2-letter-code flag inputs without crashing.
- [ ] No external avatar URL (`pravatar.cc`) remains anywhere in the rank folder.
- [ ] `gap: -15` replaced with explicit margins.
- [ ] `boardRole` color meets WCAG AA contrast.
- [ ] `zIndex: -1` removed; arena image z-order handled via natural stacking.
- [ ] `TouchableOpacity` replaced with `Pressable` in all modified rank components.
- [ ] `<Image>` from `react-native` swapped to `expo-image` for remote URLs (with `cachePolicy="memory-disk"`).
- [ ] `Trophy` icon no longer uses `fill="#fff"`.
- [ ] `compSub` no longer has a hardcoded `height`.
- [ ] Loading skeleton renders while the top-players fetch is in flight.
- [ ] Error state with a retry button renders on fetch failure.
- [ ] No `console.log` introduced. No `any` types added (use the project logger / real types).
- [ ] No new dependencies added.

---

## Constraints

- Do NOT add new dependencies. React Query, expo-image, lucide-react-native, @callstack/liquid-glass, @react-navigation/native are already available.
- Do NOT modify `prisma/schema.prisma` or any migration.
- Do NOT modify `src/routes/reels.routes.ts` — the backend endpoints already exist. Use them as-is.
- Do NOT introduce a new leaderboard "scoring system" yet — per the user's explicit instruction ("استنا لما اقولك نظام النقاط هيكون ازاي"). XP stays at 0 everywhere for now.
- All new locale keys must exist in BOTH `en.ts` AND `ar.ts`.
- Every async function uses `try/catch` with structured error handling.
- Explicit TypeScript types on all props and exported values. No `any`.
- Use `start`/`end` instead of `left`/`right` for RTL-safe positioning.
- Follow the layering rule from `Mr.dev.md`: components stay declarative; data-fetching lives in a hook (`useTopPlayers`).
- When the user is not signed in, the profile card falls back to a "Sign in to play" state — but since the app already gates rank behind auth, this is a minor path; a plain Clerk fallback is acceptable.
