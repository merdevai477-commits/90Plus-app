# 90Plus Chat — Comprehensive Fix Prompt

You are working on the **90Plus** football social app (React Native / Expo + Node.js/Express + Prisma).
Read every file reference carefully before touching anything. Fix **all** issues listed below in one pass.
Follow the project conventions in `.kiro/steering/` (structure.md, Mr.dev.md, product.md).

---

## Repository layout (relevant to this task)

```
front/
├── app/(tabs)/chat.tsx                          ← Main chat screen
├── hooks/useAIChatNative.ts                     ← Core chat hook (SSE, conversations)
├── hooks/useChatProfile.ts                      ← Profile slice hook (avatar, name, FIFA fields)
├── components/chat/
│   ├── ChatInternalComponents.tsx               ← HistoryPanel, HistoryItem, chips, etc.
│   ├── MessageBubble.tsx                        ← AIMessageBubble + UserMessageBubble
│   ├── ScrollToBottomButton.tsx                 ← Floating scroll button
│   ├── LimitReachedMessage.tsx                  ← Daily limit card
│   └── ThinkingIndicator.tsx
├── services/chatStorageService.ts               ← AsyncStorage helpers (userId, lastConvId)
└── locales/
    ├── en.ts                                    ← English strings
    └── ar.ts                                    ← Arabic strings (RTL)

src/
├── routes/chat.routes.ts                        ← All chat API routes
└── services/chat.service.ts                     ← Prisma persistence layer
```

---

## Issues to fix — read each one fully before writing code

---

### FIX 1 — Message bubbles are swapped (MessageBubble.tsx)

**File:** `front/components/chat/MessageBubble.tsx`

**Problem:** AI messages use `justifyContent: 'flex-end'` (right side) and User messages use `justifyContent: 'flex-start'` (left side). This is the opposite of every chat app convention. The user's own messages should be on the RIGHT, AI messages on the LEFT.

**Fix:**
- In `styles.aiRow`: change `justifyContent: 'flex-end'` → `justifyContent: 'flex-start'`
- In `styles.userRow`: change `justifyContent: 'flex-start'` → `justifyContent: 'flex-end'`
- In `styles.aiBubble`: swap `borderTopRightRadius: 4` / `borderBottomRightRadius: 4` → `borderTopLeftRadius: 4` / `borderBottomLeftRadius: 4` (tail on the left)
- In `styles.userBubble`: swap `borderTopLeftRadius: 4` / `borderBottomLeftRadius: 4` → `borderTopRightRadius: 4` / `borderBottomRightRadius: 4` (tail on the right)
- `aiTs` timestamp: change `textAlign: 'right'` → `textAlign: 'left'`, `paddingRight: 4` → `paddingLeft: 4`
- `userTs` timestamp: change `textAlign: 'left'` → `textAlign: 'right'`, `paddingLeft: 4` → `paddingRight: 4`
- The `FadeIn.withInitialValues` slide direction for AI bubble should come from the LEFT (`translateX: -20`), and for User bubble from the RIGHT (`translateX: 20`). Currently they are also swapped.

---

### FIX 2 — History animation replays on every open (MessageBubble.tsx)

**File:** `front/components/chat/MessageBubble.tsx`

**Problem:** `AIMessageBubble` runs a character-by-character typing animation for ALL messages including old history messages loaded from the server. Every time the user opens a past conversation, all messages animate from scratch. This is wrong — only NEW streaming messages should animate. History messages should render instantly.

**Root cause:** The logic `if (initialText.current === '') { ... streaming path }` only skips animation when the message starts empty. But history messages arrive with full text, so they always go through the slow `setInterval` typing animation.

**Fix:** Add a prop `isHistory?: boolean` to `MessageBubbleProps`. When `isHistory` is true, skip the animation entirely and render the full text immediately:

```typescript
// In AIMessageBubble useEffect:
if (isHistory) {
  setVisible(message.text ?? '');
  setDone(true);
  return;
}
```

In `chat.tsx`, when rendering messages loaded from `loadConversationMessages` (i.e., all messages except the very last one being streamed), pass `isHistory={true}`. You can detect this by checking if `isLoading` is false and the message already existed before the current session started. The simplest approach: track a `Set<string>` of message IDs that existed when the conversation was loaded, and pass `isHistory={streamingMessageId !== msg.id}` where `streamingMessageId` is the ID of the currently-streaming AI message (stored in a ref in `useAIChatNative`).

Expose `streamingMessageId: string | null` from `useAIChatNative` hook so `chat.tsx` can pass it down to `renderMessage`.

---

### FIX 3 — Avatar not showing in HistoryPanel sidebar (ChatInternalComponents.tsx + useChatProfile.ts)

**File:** `front/components/chat/ChatInternalComponents.tsx` — `HistoryPanel` component
**File:** `front/hooks/useChatProfile.ts`

**Problem:** The `HistoryPanel` receives `avatar` and `displayName` props from `chat.tsx`, which gets them from `useChatProfile`. However `useChatProfile` calls `AuthService.syncUserWithBackend(token)` which returns a `UserProfile`. The `toSlice()` function maps `p.avatar` — but the actual avatar URL stored in the backend is under `p.avatar` (Cloudflare R2 URL). If the user's profile was loaded via the Clerk fallback path (no backend call), `avatar` will be `null` even though Clerk has `imageUrl`.

**Fix in `useChatProfile.ts`:**
1. Import `useUser` from `@clerk/clerk-expo` alongside `useAuth`.
2. In `toSlice()`, fall back to Clerk's `imageUrl` when `p.avatar` is null:
```typescript
import { useAuth, useUser } from '@clerk/clerk-expo';

// inside useChatProfile():
const { user: clerkUser } = useUser();

// in the fresh-fetch block, after getting `fresh`:
const slice = toSlice(fresh);
// If backend avatar is null, use Clerk's imageUrl as fallback
if (!slice.avatar && clerkUser?.imageUrl) {
  slice.avatar = clerkUser.imageUrl;
}
updateProfile(slice);
```
3. Also apply the same fallback when hydrating from AsyncStorage cache:
```typescript
// after updateProfile(entry.data):
if (!entry.data.avatar && clerkUser?.imageUrl) {
  updateProfile({ ...entry.data, avatar: clerkUser.imageUrl });
}
```

**Fix in `ChatInternalComponents.tsx` — `HistoryPanel`:**
The `avatar` prop is already passed to the `Image` component inside the profile card. Verify the `Image` component from `expo-image` has a valid `source`. Add a console.warn in dev if avatar is null after profile loads, to help debug. No structural change needed here if the hook fix above is applied.

---

### FIX 4 — Auto-scroll not working reliably (chat.tsx)

**File:** `front/app/(tabs)/chat.tsx`

**Problem:** The auto-scroll to bottom has multiple competing mechanisms that interfere with each other:
1. `onContentSizeChange` calls `scrollToEnd({ animated: false })` — fires on EVERY content change including keyboard
2. `onLayout` calls `scrollToEnd({ animated: false })` — fires on every layout change
3. The `useEffect` on `messages.length` uses `setTimeout(50ms)` which races with the above
4. The keyboard `useEffect` calls `scrollToEnd` inside `requestAnimationFrame` — but `KeyboardAvoidingView` with `behavior="padding"` on iOS already handles this
5. On Android, `behavior={undefined}` means the keyboard covers the input

**Fix:**
```typescript
// 1. Remove the onLayout scrollToEnd — it fires too often and causes jumps
// Remove: onLayout={() => { listRef.current?.scrollToEnd({ animated: false }); }}

// 2. Keep onContentSizeChange but guard it properly:
onContentSizeChange={() => {
  // Only auto-scroll if user is near bottom AND we're not in the middle of
  // a keyboard animation (keyboardHeight > 0 means keyboard just opened)
  if (isNearBottomRef.current) {
    listRef.current?.scrollToEnd({ animated: false });
  }
}}

// 3. Fix Android keyboard behavior:
behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
// AND add keyboardVerticalOffset for iOS:
keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}

// 4. In the keyboard show handler, use a longer delay on Android:
const onShow = (e: KeyboardEvent) => {
  setKeyboardHeight(e.endCoordinates.height);
  const delay = Platform.OS === 'ios' ? 0 : 100;
  setTimeout(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, delay);
};

// 5. In handleSend, the scroll is already correct — keep it.

// 6. In the messages.length useEffect, increase delay slightly:
setTimeout(() => {
  listRef.current?.scrollToEnd({ animated: true });
}, 80); // was 50ms — give layout time to settle
```

---

### FIX 5 — Remove microphone / voice recording feature (chat.tsx)

**File:** `front/app/(tabs)/chat.tsx`

**Problem:** The voice recording feature (microphone button) is not needed. Remove it entirely and clean up all related code.

**Remove from `chat.tsx`:**
1. All imports: `useAudioRecorder`, `AudioModule`, `RecordingPresets` from `expo-audio`
2. State variables: `isRecording`, `isTranscribing`
3. Refs: `recordingUri`
4. The entire `handleMicPress` callback function
5. The `VoiceButton` component render in the input row (wherever `<VoiceButton ... />` appears)
6. Any `isRecording` or `isTranscribing` props passed to child components

**Also remove the `VoiceButton` component definition** if it is defined inline in `chat.tsx` (search for `function VoiceButton` or `const VoiceButton`).

**Keep:** Everything else in the input bar — the `TextInput`, the send button, the edit banner.

**Note:** Do NOT remove the `/api/chat/transcribe` backend route — it may be used elsewhere. Only remove the frontend UI.

---

### FIX 6 — Conversation dates hardcoded as "اليوم" (ChatInternalComponents.tsx)

**File:** `front/components/chat/ChatInternalComponents.tsx` — `HistoryItem` component and `HistoryPanel`

**Problem:** Every conversation in the sidebar shows "اليوم" as the date regardless of when it was created. The `Conversation` type has `updatedAt: string` (ISO 8601).

**Fix:** Add a `formatConversationDate` helper and use `updatedAt`:

```typescript
function formatConversationDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'اليوم';
  if (diffDays === 1) return 'أمس';
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`;
  return `منذ ${Math.floor(diffDays / 30)} شهور`;
}
```

In `HistoryPanel`, pass `c.updatedAt` to `HistoryItem`:
```typescript
// Before (wrong):
<HistoryItem date="اليوم" ... />

// After (correct):
<HistoryItem date={formatConversationDate(c.updatedAt)} ... />
```

---

### FIX 7 — LimitReachedMessage has hardcoded English strings (LimitReachedMessage.tsx)

**File:** `front/components/chat/LimitReachedMessage.tsx`

**Problem:** The component has hardcoded English strings `"Daily message limit reached"` and `"Resets after the countdown"` — violates the i18n rule (all user-facing strings must come from `front/locales/`).

**Fix:**
1. Add keys to `front/locales/en.ts`:
```typescript
chat: {
  // ... existing keys if any
  limitReached: 'Daily message limit reached',
  limitResetsAfter: 'Resets after the countdown',
}
```

2. Add keys to `front/locales/ar.ts`:
```typescript
chat: {
  limitReached: 'انتهت رسائلك اليومية',
  limitResetsAfter: 'يتجدد بعد العد التنازلي',
}
```

3. In `LimitReachedMessage.tsx`, use `useTranslation` from `../../src/i18n`:
```typescript
import { useTranslation } from '../../src/i18n';

export function LimitReachedMessage({ resetTime }: LimitReachedMessageProps) {
  const { t } = useTranslation();
  // ...
  <Text style={styles.label}>{t('chat.limitReached')}</Text>
  // ...
  <Text style={styles.sublabel}>{t('chat.limitResetsAfter')}</Text>
}
```

---

### FIX 8 — getLastConversationId is saved but never used (useAIChatNative.ts + chatStorageService.ts)

**File:** `front/hooks/useAIChatNative.ts` — `bootstrapConversation` function
**File:** `front/services/chatStorageService.ts`

**Problem:** `Storage.saveLastConversationId(id)` is called every time a conversation is selected, but `Storage.getLastConversationId()` is NEVER called during bootstrap. The app always opens the first conversation from the server list instead of the one the user was last in.

**Fix in `bootstrapConversation`:**
```typescript
const bootstrapConversation = useCallback(async () => {
  try {
    const existing = await fetchConversations();
    
    // Try to restore the last active conversation
    const lastId = await Storage.getLastConversationId();
    
    if (existing.length > 0) {
      // Prefer the last active conversation if it still exists
      const lastConv = lastId ? existing.find(c => c.id === lastId) : null;
      const target = lastConv ?? existing[0];
      
      setCurrentConversationId(target.id);
      await loadConversationMessages(target.id);
      await Storage.saveLastConversationId(target.id);
      return;
    }
    
    // No conversations exist — create one
    const created = await createConversation();
    setCurrentConversationId(created.id);
    setConversations([created]);
    setMessages(INITIAL_MESSAGES);
    await Storage.saveLastConversationId(created.id);
  } catch {
    // warn only — don't crash
  }
}, [fetchConversations, createConversation, loadConversationMessages]);
```

---

### FIX 9 — fetchLimit and bootstrapConversation run sequentially (useAIChatNative.ts)

**File:** `front/hooks/useAIChatNative.ts` — `init` function inside the mount `useEffect`

**Problem:**
```typescript
// Current (slow — sequential):
await fetchLimit();
await bootstrapConversation();
```
These two calls are independent. Running them sequentially adds unnecessary latency on every chat screen open.

**Fix:**
```typescript
// Parallel — saves ~300-500ms on every mount:
await Promise.all([fetchLimit(), bootstrapConversation()]);
```

---

### FIX 10 — Voice transcription sends hardcoded userId (chat.tsx)

**File:** `front/app/(tabs)/chat.tsx` — `handleMicPress` function

> **Note:** This fix is superseded by FIX 5 (removing the mic feature entirely). If FIX 5 is applied, skip this fix. If for any reason the mic feature is kept, fix the hardcoded `'voice'` userId:

```typescript
// Wrong:
headers: { 'x-user-id': 'voice' }

// Correct — use the actual userId from the hook:
headers: { 'x-user-id': userIdRef.current || 'guest' }
```

Since `userIdRef` is internal to `useAIChatNative`, expose it or pass the userId via a separate mechanism. The simplest fix: expose `userId: string` from the hook's return value.

---

### FIX 11 — messagesRemaining initializes to 5 instead of unknown (useAIChatNative.ts)

**File:** `front/hooks/useAIChatNative.ts`

**Problem:**
```typescript
const [messagesRemaining, setMessagesRemaining] = useState(5);
```
The UI shows "5 messages remaining" for a brief moment before the real limit loads from the backend. If the user's actual limit is 20, this is misleading.

**Fix:** Initialize to `null` and show a loading state in the counter:
```typescript
const [messagesRemaining, setMessagesRemaining] = useState<number | null>(null);
```

Update `MessageCounter` component (in `ChatInternalComponents.tsx`) to handle `null` gracefully — show a small spinner or `"..."` until the real value arrives.

Update all places that check `messagesRemaining <= 0` to also handle `null`:
```typescript
// In sendMessage:
if (!trimmed || isLoading || (messagesRemaining !== null && messagesRemaining <= 0)) return;

// In the input bar render:
{messagesRemaining === 0 && resetTime ? (
  <LimitBanner />
) : (
  <InputBar />
)}
```

---

### FIX 12 — Empty state has broken emoji (ChatInternalComponents.tsx)

**File:** `front/components/chat/ChatInternalComponents.tsx` — `HistoryPanel` empty state

**Problem:**
```typescript
<Text style={styles.emptyEmoji}>{searchQuery.trim() ? '🔍' : '🔍💬'}</Text>
```
The no-search-results branch shows `'🔍'` but the no-conversations branch shows `'🔍💬'` — both use the magnifying glass. The no-conversations state should show a chat bubble emoji, not a search icon.

**Fix:**
```typescript
<Text style={styles.emptyEmoji}>{searchQuery.trim() ? '🔍' : '💬'}</Text>
```

---

## Summary of files to modify

| File | Fixes |
|------|-------|
| `front/components/chat/MessageBubble.tsx` | FIX 1, FIX 2 |
| `front/app/(tabs)/chat.tsx` | FIX 2 (streamingMessageId), FIX 4, FIX 5 |
| `front/hooks/useChatProfile.ts` | FIX 3 |
| `front/components/chat/ChatInternalComponents.tsx` | FIX 6, FIX 11 (MessageCounter), FIX 12 |
| `front/components/chat/LimitReachedMessage.tsx` | FIX 7 |
| `front/locales/en.ts` | FIX 7 |
| `front/locales/ar.ts` | FIX 7 |
| `front/hooks/useAIChatNative.ts` | FIX 8, FIX 9, FIX 11 |
| `front/services/chatStorageService.ts` | FIX 8 (no change needed — already has getLastConversationId) |

---

## Constraints

- Do NOT add new dependencies.
- Do NOT modify `prisma/schema.prisma` or any migration files.
- Do NOT touch backend routes or services unless explicitly listed above.
- Do NOT remove the `/api/chat/transcribe` backend endpoint.
- All new user-facing strings must be added to BOTH `en.ts` AND `ar.ts`.
- Use `start`/`end` instead of `left`/`right` for RTL-safe layout where applicable.
- No `console.log` in committed code — use the app logger or remove.
- No `any` types unless unavoidable (comment why).
- Every async function must have `try/catch`.
- Produce complete, runnable file contents — no placeholders, no `// ... rest of file`.
