import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActionSheetIOS,
  Image,
} from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../src/i18n';
import { useMatchLiveChat } from '../../hooks/useMatchLiveChat';
import type { MatchChatUiMessage } from '../../hooks/matchLiveChat.reducer';
import type { MatchChatReportReason } from '../../types/matchChat';
import { safeFlashListScrollToEnd } from '../chat/safeFlashListScroll';

type MatchChatTabProps = {
  fixtureId: number;
};

const REPORT_REASONS: MatchChatReportReason[] = [
  'PROFANITY',
  'ABUSE',
  'HARASSMENT',
  'SPAM',
  'ADVERTISEMENT',
  'SUSPICIOUS_LINK',
  'OTHER',
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

const ChatBubble = memo(function ChatBubble({
  item,
  isOwn,
  onReport,
}: {
  item: MatchChatUiMessage;
  isOwn: boolean;
  onReport: (message: MatchChatUiMessage) => void;
}) {
  const name = item.user.displayName || item.user.username || '';
  return (
    <TouchableOpacity
      activeOpacity={isOwn ? 1 : 0.8}
      onLongPress={isOwn || item.pending ? undefined : () => onReport(item)}
      style={[styles.bubbleRow, isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther]}
    >
      {!isOwn ? (
        item.user.avatar ? (
          <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{initials(name)}</Text>
          </View>
        )
      ) : null}
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther, item.failed && styles.bubbleFailed]}>
        {!isOwn ? <Text style={styles.author}>{name}</Text> : null}
        <Text style={styles.body}>{item.text}</Text>
        <Text style={styles.time}>
          {item.pending ? '…' : item.failed ? '!' : formatTime(item.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export function MatchChatTab({ fixtureId }: MatchChatTabProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useTranslation();
  const md = t.matchDetails;
  const listRef = useRef<FlashListRef<MatchChatUiMessage> | null>(null);
  const [draft, setDraft] = useState('');
  const [now, setNow] = useState(Date.now());
  const nearBottomLatest = useRef(true);

  const {
    messages,
    signedIn,
    connection,
    warning,
    frozenUntil,
    unseenCount,
    nearBottom,
    lastError,
    send,
    loadOlder,
    setNearBottom,
    clearUnseen,
    clearWarning,
    report,
    ownUserId,
    maxLength,
  } = useMatchLiveChat({
    matchId: fixtureId,
    enabled: fixtureId > 0,
  });

  useEffect(() => {
    nearBottomLatest.current = nearBottom;
  }, [nearBottom]);

  useEffect(() => {
    if (!frozenUntil) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [frozenUntil]);

  useEffect(() => {
    if (!nearBottomLatest.current || messages.length === 0) return;
    const id = requestAnimationFrame(() => safeFlashListScrollToEnd(listRef.current, false));
    return () => cancelAnimationFrame(id);
  }, [messages.length]);

  const frozenMs = frozenUntil ? Math.max(0, frozenUntil - now) : 0;
  const frozen = frozenMs > 0;
  const online = connection === 'connected';
  const hasDraft = draft.trim().length > 0 && draft.trim().length <= maxLength;
  const canCompose = signedIn && !frozen;

  const reasonLabels = useMemo(
    () => ({
      PROFANITY: md.chatReportProfanity,
      ABUSE: md.chatReportAbuse,
      HARASSMENT: md.chatReportHarassment,
      SPAM: md.chatReportSpam,
      ADVERTISEMENT: md.chatReportAd,
      SUSPICIOUS_LINK: md.chatReportLink,
      OTHER: md.chatReportOther,
    }),
    [md],
  );

  const onReport = useCallback(
    (message: MatchChatUiMessage) => {
      const apply = (reason: MatchChatReportReason) => {
        void report(message.id, reason).then(
          () => Alert.alert(md.chatReportSent),
          () => Alert.alert(md.chatReportFailed),
        );
      };
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [md.chatReportCancel, ...REPORT_REASONS.map((r) => reasonLabels[r])],
            cancelButtonIndex: 0,
          },
          (index) => {
            if (!index) return;
            const reason = REPORT_REASONS[index - 1];
            if (reason) apply(reason);
          },
        );
        return;
      }
      Alert.alert(md.chatReportTitle, undefined, [
        { text: md.chatReportCancel, style: 'cancel' },
        ...REPORT_REASONS.map((reason) => ({
          text: reasonLabels[reason],
          onPress: () => apply(reason),
        })),
      ]);
    },
    [report, md, reasonLabels],
  );

  const onSend = useCallback(() => {
    if (!signedIn) {
      router.push('/auth');
      return;
    }
    if (frozen) return;
    if (!hasDraft) return;
    if (!online) {
      Alert.alert(md.chatSendBlockedTitle, md.chatSendBlockedOffline);
      return;
    }
    const ok = send(draft);
    if (ok) setDraft('');
  }, [signedIn, frozen, hasDraft, online, send, draft, router, md]);

  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } } }) => {
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      const gap = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      setNearBottom(gap < 80);
      if (contentOffset.y < 48) {
        void loadOlder();
      }
    },
    [loadOlder, setNearBottom],
  );

  const renderItem = useCallback(
    ({ item }: { item: MatchChatUiMessage }) => {
      const isOwn =
        item.pending ||
        item.user.id === 'me' ||
        (ownUserId != null && item.user.id === ownUserId);
      return <ChatBubble item={item} isOwn={isOwn} onReport={onReport} />;
    },
    [ownUserId, onReport],
  );

  const empty = (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons name="chatbubbles-outline" size={34} color="#810af2" />
      </View>
      <Text style={styles.emptyTitle}>{signedIn ? md.chatEmptyTitle : md.chatLoginTitle}</Text>
      <Text style={styles.emptyHint}>{signedIn ? md.chatEmptyHint : md.chatLoginHint}</Text>
      {!signedIn ? (
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth')} accessibilityRole="button">
          <Text style={styles.loginBtnText}>{md.chatLoginCta}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      {warning ? (
        <TouchableOpacity style={styles.warnBanner} onPress={clearWarning}>
          <Text style={styles.warnText}>{md.chatWarning}</Text>
        </TouchableOpacity>
      ) : null}
      {signedIn && connection === 'connecting' ? (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>{md.chatConnecting}</Text>
        </View>
      ) : null}
      {signedIn && connection === 'disconnected' ? (
        <View style={styles.statusBannerOffline}>
          <Text style={styles.statusTextOffline}>{md.chatDisconnected}</Text>
          {lastError ? <Text style={styles.statusError}>{lastError}</Text> : null}
        </View>
      ) : null}
      {frozen ? (
        <View style={styles.freezeBanner}>
          <Text style={styles.freezeText}>
            {md.chatFrozen.replace('{seconds}', String(Math.ceil(frozenMs / 1000)))}
          </Text>
        </View>
      ) : null}

      <View style={styles.feed}>
        {messages.length === 0 ? (
          empty
        ) : (
          <FlashList
            ref={listRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
          />
        )}
        {unseenCount > 0 ? (
          <TouchableOpacity
            style={styles.newChip}
            onPress={() => {
              clearUnseen();
              safeFlashListScrollToEnd(listRef.current, true);
            }}
          >
            <Text style={styles.newChipText}>{md.chatNewMessages}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[styles.sendBtn, !(canCompose && hasDraft) && styles.sendBtnDisabled]}
          disabled={!(canCompose && hasDraft)}
          onPress={onSend}
          accessibilityRole="button"
          accessibilityLabel={md.chatSend}
          accessibilityState={{ disabled: !(canCompose && hasDraft) }}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={[styles.inputShell, (frozen || !signedIn) && styles.inputDisabled]}>
          <TextInput
            style={[styles.input, { textAlign: isRTL ? 'right' : 'left' }]}
            placeholder={frozen ? md.chatFrozenPlaceholder : md.chatPlaceholder}
            placeholderTextColor="#8a8a8a"
            editable={signedIn && !frozen}
            value={draft}
            onChangeText={setDraft}
            maxLength={maxLength}
            multiline
          />
          {draft.length > maxLength - 40 ? (
            <Text style={styles.counter}>{maxLength - draft.length}</Text>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#12071f',
  },
  feed: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(129,10,242,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyHint: {
    color: '#9a9a9a',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  loginBtn: {
    marginTop: 12,
    backgroundColor: '#810af2',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  warnBanner: {
    backgroundColor: 'rgba(245, 166, 35, 0.18)',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  warnText: {
    color: '#ffd27a',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBanner: {
    backgroundColor: 'rgba(129,10,242,0.18)',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  statusBannerOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 4,
  },
  statusText: {
    color: '#d4b3ff',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextOffline: {
    color: '#fecaca',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  statusError: {
    color: 'rgba(254,202,202,0.75)',
    textAlign: 'center',
    fontSize: 10,
  },
  freezeBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  freezeText: {
    color: '#fecaca',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  newChip: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 12,
    backgroundColor: '#810af2',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  newChipText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(129,10,242,0.25)',
    backgroundColor: '#0c051a',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#810af2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  inputShell: {
    flex: 1,
    minHeight: 44,
    maxHeight: 96,
    borderRadius: 22,
    backgroundColor: '#1a0b2e',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(129,10,242,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 8,
  },
  counter: {
    color: '#9a9a9a',
    fontSize: 11,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginVertical: 4,
    maxWidth: '86%',
    gap: 8,
  },
  bubbleRowOwn: {
    alignSelf: 'flex-end',
  },
  bubbleRowOther: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  bubbleOwn: {
    backgroundColor: '#810af2',
  },
  bubbleOther: {
    backgroundColor: '#1a0b2e',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(129,10,242,0.28)',
  },
  bubbleFailed: {
    opacity: 0.65,
  },
  author: {
    color: '#d4b3ff',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  body: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  time: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 4,
  },
  avatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 4,
    backgroundColor: '#3a1d5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
