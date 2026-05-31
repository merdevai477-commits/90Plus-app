# Push Notification Forensic Report

Generated: 2026-05-31

## ROOT CAUSE

**Remote push token registration never ran on a physical EAS/dev-client build** — all testing used **Emulator/Simulator (`Device.isDevice=false`)** and/or **Expo Go (`appOwnership=expo`)**, which intentionally skip `getExpoPushTokenAsync` and never call `POST /api/matches/push-token`, leaving **23/23 users with `expoPushToken=NULL`** despite `pushNotificationsConsent=true`.

---

## EVIDENCE

### Phase 1 — Trace logging

Added `[PUSH TRACE]` lines in `front/services/pushTokenRegistration.service.ts` (gated by `__DEV__` or `EXPO_PUBLIC_PUSH_TRACE=1`).

**Expected log on Emulator (Metro):**

```
[PUSH TRACE] start
[PUSH TRACE] platform=android|ios
[PUSH TRACE] appOwnership=expo|standalone
[PUSH TRACE] isDevice=false
[PUSH TRACE] EXIT → reason: Device.isDevice=false
```

**Expected log on Expo Go:**

```
[PUSH TRACE] isDevice=true|false
[PUSH TRACE] EXIT → reason: Expo Go (appOwnership=expo, no remote push)
```

**Expected log on real EAS build with permission granted:**

```
[PUSH TRACE] permissions=granted
[PUSH TRACE] projectId=254843d8-c368-4507-9a58-033539c77298
[PUSH TRACE] before getExpoPushTokenAsync
[PUSH TRACE] token=ExponentPushToken[...]
[PUSH TRACE] before registerPushToken API call
[PUSH TRACE] registerPushToken response=success
[PUSH TRACE] success ✓
```

### Phase 2 — Call-site audit

| # | File | Line | Function | Runtime | Guards | Context |
|---|------|------|----------|---------|--------|---------|
| 1 | `front/components/common/PushTokenSyncBootstrap.tsx` | 22–23 | `flushPendingPushToken`, `syncExpoPushTokenIfGranted` | Yes when signed in | `isPushRegistrationAvailable()` → false on emulator/Expo Go | `useEffect` on login + AppState `active` |
| 2 | `front/src/hooks/usePushNotifications.tsx` | 259, 285 | `capturePushTokenAfterPermission` | Yes | `loadNotifications()` null in Expo Go | `useEffect` permission check + modal grant |
| 3 | `front/src/hooks/usePushNotifications.tsx` | 308–319 | `flushPendingPushToken`, `syncExpoPushTokenIfGranted` | Yes when signed in | Same as #1 | `useEffect` + AppState |
| 4 | `front/contexts/SettingsContext.tsx` | 289 | `syncExpoPushToken` | Only if user toggles notifications ON | `!isExpoGo && Notifications`; needs granted permission | `toggleNotifications` async |
| 5 | `front/app/(tabs)/profile.tsx` | 1353 | `syncExpoPushToken` | After reel upload success | Only if reel flow requests permission first | Fire-and-forget after upload |
| 6 | `front/services/reelUploadNotification.ts` | 98, 103, 227 | `capturePushTokenAfterPermission` | After local notification permission | Permission path only | Reel upload / permission helpers |
| 7 | `front/app/notifications.tsx` | 613 | `syncExpoPushTokenIfGranted` | On notifications screen focus | `isPushRegistrationAvailable()` | `useFocusEffect` |

**Conclusion:** All call sites are reachable in production builds, but **every path depends on `Device.isDevice` + not Expo Go** before a token exists.

### Phase 3 — API endpoint logging

Added `[PUSH API]` logs in `POST /api/matches/push-token` (`src/routes/matches.routes.ts`), gated by `PUSH_TRACE_LOGS=true` or non-production.

Includes post-UPDATE `SELECT` verify of `expoPushToken` and `pushNotificationsConsent`.

**Observed:** No `[PUSH API] request received` in production logs while testing only on emulator — **confirms API never hit**.

### Phase 4 — DB diagnostics (actual output)

Run: `npx tsx scripts/push-diagnostics.ts`

```
========== PUSH DB DIAGNOSTICS ==========
Total users:                   23
Users with expoPushToken:      0
Users with consent=true:       23
Users with token + consent:    0

First 20 tokens:
  (none)
=========================================
```

### Phase 5 — In-app diagnostics

- Route: `/push-diagnostics` (`front/app/push-diagnostics.tsx`)
- Component: `front/components/dev/PushDiagnosticsScreen.tsx`
- **Hidden on production standalone** (`__DEV__ || appOwnership !== 'standalone'`)

Open in dev: navigate to `/push-diagnostics` in Expo Router.

### Phase 6 — End-to-end test

**BLOCKED:** Requires **physical device** with **EAS development or production build** (not Expo Go, not emulator).

After unblock:

1. Open app → grant notifications → confirm `[PUSH TRACE] success ✓`
2. Re-run `npx tsx scripts/push-diagnostics.ts` — expect `Users with expoPushToken: 1+`
3. Run `npx tsx scripts/audit-push-tokens.ts --send-test --clerk-user-id <your_id>`
4. Capture Ticket + Receipt JSON from script output

---

## FILES MODIFIED

| File | Change |
|------|--------|
| `front/services/pushTokenRegistration.service.ts` | Phase 1 `[PUSH TRACE]` logging |
| `front/utils/pushTrace.ts` | Feature flag helper |
| `src/utils/pushTrace.ts` | Server `[PUSH API]` flag |
| `src/routes/matches.routes.ts` | Phase 3 API logs + DB verify |
| `scripts/push-diagnostics.ts` | Phase 4 DB script |
| `front/components/dev/PushDiagnosticsScreen.tsx` | Phase 5 UI |
| `front/app/push-diagnostics.tsx` | Phase 5 route + gate |
| `front/app/_layout.tsx` | Register push-diagnostics screen |
| `docs/PUSH_FORENSIC_REPORT.md` | This report |
| `.env.example` / `front/.env.example` | Trace env vars documented |

---

## FAILURE CATEGORY

- [x] Emulator / Simulator (`isDevice=false`)
- [x] Expo Go (`appOwnership=expo`, no FCM)
- [ ] Permission not requested / denied (not tested on real device)
- [ ] Token generation error (projectId missing?) — projectId present in `app.json`
- [x] API call never made / wrong endpoint — endpoint correct, **never called**
- [ ] DB write silently failing — no writes attempted
- [ ] Expo credentials misconfigured — FCM uploaded; untested without token
- [ ] Backend sending logic broken — cannot test with zero tokens

---

## FINAL STATUS

Push Notifications working for (requires Phase 6 on real device):

- [ ] Like
- [ ] Follow
- [ ] Comment
- [ ] Match Alert
- [ ] Goal Alert
- [ ] System

**Local notifications (reel upload)** work on emulator — they use `scheduleNotificationAsync`, not remote push.

---

## Next steps

1. `eas build --profile development --platform ios` (or android)
2. Install on physical phone → sign in → allow notifications
3. Open `/push-diagnostics` → Run Diagnostics
4. Verify DB with `npx tsx scripts/push-diagnostics.ts`
5. Send test push via `scripts/audit-push-tokens.ts --send-test`
