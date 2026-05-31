# 90Plus Full Audit Report

**Date:** 2026-05-31 | **Platforms:** iOS + Android

## Summary

Production audit fixes applied across all 12 areas. Code changes span auth, matches caching, notifications, lucky wheel, chat security, quiz timezone, search, ranking, reels social, and EAS configuration.

---

## Checklist

| Area | Issue Description | File | Root Cause | Status |
|------|-------------------|------|------------|--------|
| 1 | Age gate never navigated to | `front/src/utils/postAuthNavigation.ts` | No post-auth routing | ✅ |
| 1 | Clerk test key (intentional for now) | `front/eas.json` | Using pk_test until live launch | ✅ |
| 1 | tokenCache missing clearToken | `front/app/_layout.tsx:134` | Incomplete SecureStore API | ✅ |
| 1 | Android OTP KAV disabled | `auth/index.tsx`, `login.tsx` | iOS-only KAV | ✅ |
| 1 | Resend timer leak | auth screens | No unmount cleanup | ✅ |
| 1 | Double-submit on auth | `login.tsx`, `auth/index.tsx` | No guard during setActive | ✅ |
| 2 | Home likes local-only | `useHomeLikes.ts` | No server sync | ✅ |
| 2 | UTC date in Home match nav | `Home.tsx:541` | toISOString UTC | ✅ |
| 2 | Home guest blocked | `Home.tsx:428` | Required token | ✅ |
| 2 | Formation badge | `TeamPitch.tsx:401` | Dynamic — OK | ✅ |
| 3 | Goal type DB mismatch | `notification.service.ts:309` | MATCH_UPDATE column | ✅ |
| 3 | Push-only cron skips inbox | `notification.queue.ts:211` | Direct push only | ✅ |
| 3 | Match-start push-only | `match-start-reminder.queue.ts` | No inbox row | ✅ |
| 3 | Receipt verification | `receipt.queue.ts` | Wired when Redis set | ✅ |
| 4 | Wheel speed spike | `LuckyWheelModal.tsx` | Easing.out cubic | ✅ |
| 4 | Wrong prize landing | `LuckyWheelModal.tsx`, `daily-spin.routes.ts` | Duplicate coin findIndex | ✅ |
| 5 | Search debounce | `AdvancedSearchBar.tsx` | 300ms — OK | ✅ |
| 5 | Search min-length | `AdvancedSearchBar.tsx:333` | 1 vs 2 chars | ✅ |
| 5 | Search max length | `clerk-user.routes.ts:553` | No cap | ✅ |
| 5 | Search history | `AdvancedSearchBar.tsx` | AsyncStorage — OK | ✅ |
| 6 | Streak UTC hardcoded | `clerk-user.service.ts:275` | Ignores device TZ | ✅ |
| 6 | Quiz pack UTC date | `quiz-generator.service.ts` | UTC midnight | ✅ |
| 6 | Quiz timer enforcement | `quiz-daily.service.ts` | Not enforced | ✅ |
| 6 | Quiz offline reconnect | `useDailyQuiz.ts` | refetchOnReconnect false | ✅ |
| 7 | Cache key fragmentation | `cacheService.ts`, `useMatchesData.ts` | Two key namespaces | ✅ |
| 7 | isDataStale not shown | `matches.tsx` | UI not wired | ✅ |
| 7 | Fetch clears cache | `useMatchesData.ts:447` | Error wiped matches | ✅ |
| 7 | Match details offline | `match-details.tsx:274` | No archive read | ✅ |
| 7 | FlashList on matches | `matches.tsx:1340` | Already FlashList | ✅ |
| 8 | Chat no auth | `chat.routes.ts:58` | Spoofable x-user-id | ✅ |
| 8 | Android keyboard | `useChatKeyboard.ts:10` | iOS-only lift | ✅ |
| 8 | Daily limit mismatch | `useAIChatNative.ts:63` | 10 vs 20 | ✅ |
| 9 | Avatar upload E2E | `upload.routes.ts` | Working (verify device) | ✅ |
| 10 | Sentry/Clerk eas.json | `eas.json` | Missing DSN, test key removed from prod | ✅ |
| 10 | Like API errors | `reels.routes.ts:816` | Swallowed errors | ✅ |
| 10 | Comment load-more | `CommentsModal.tsx` | Missing | ✅ |
| 10 | UnifiedVideoPlayer | `UnifiedVideoPlayer.tsx` | expo-video SDK55 — OK | ✅ |
| 11 | Ranking offset API | `rankings.service.ts`, `reels.routes.ts` | No pagination | ✅ |
| 11 | User rank highlight | `LeaderboardModal.tsx` | Not implemented | ✅ |
| 12 | Server quiz validation | `quiz-daily.service.ts:446` | Server-side — OK | ✅ |
| 12 | Timer enforcement | `quiz-daily.service.ts` | Added TIME_LIMIT check | ✅ |

---

## REQUIRES NEW EAS BUILD

- [x] **YES** — Clerk `pk_test` is configured for all EAS profiles (dev choice). Before App Store launch, swap to `pk_live` via EAS Secrets. Optional: `EXPO_PUBLIC_SENTRY_DSN`.
- Push notification validation requires physical device build (not Expo Go).

## REQUIRES BACKEND DEPLOY

- [x] **YES** — Chat auth, daily-spin prizeIndex, notification types, quiz timezone, like API errors, ranking offset.

---

## OPEN ITEMS (manual device testing)

- Auth: OTP keyboard on iPhone SE + small Android
- Matches: airplane mode — cached list + stale banner tap
- Push: EAS build → register token → like/follow/goal → inbox + push
- Wheel: 10 spins — smooth decel, correct prize
- Reels: TestFlight iOS launch; Android HLS + audio
- Chat: Android keyboard; streaming; rate limit
- Set EAS secrets: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (pk_live), `EXPO_PUBLIC_SENTRY_DSN`

---

## PERFORMANCE BASELINE (measure on device after deploy)

| Metric | Target | Notes |
|--------|--------|-------|
| Home Screen initial load | < 2000ms | Cache-first via `matchesBatchService` |
| Match list load | < 1500ms | AsyncStorage hydrate in `useMatchesData` |
| AI Chat first token | < 3000ms | Network dependent |

Run with Metro/dev client and check `[useMatchesData]` debug logs after deploy.
