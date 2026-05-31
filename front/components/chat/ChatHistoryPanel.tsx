import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
  useAnimatedStyle,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Conversation } from '../../hooks/useAIChatNative';
import { MessageCounter } from './MessageCounter';
import { Toast } from './Toast';
import { ConversationContextMenu } from './ConversationContextMenu';
import { ConversationSkeleton, UserProfileSkeleton } from './SkeletonLoader';
import { Colors, Gradients } from '../../constants/theme';
import { useTranslation } from '../../src/i18n';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatConversationDate(
  isoString: string,
  labels: {
    dateToday: string;
    dateYesterday: string;
    dateDaysAgo: string;
    dateWeeksAgo: string;
    dateMonthsAgo: string;
  },
): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return labels.dateToday;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return labels.dateToday;
  if (diffDays === 1) return labels.dateYesterday;
  if (diffDays < 7) return labels.dateDaysAgo.replace('{n}', String(diffDays));
  if (diffDays < 30) return labels.dateWeeksAgo.replace('{n}', String(Math.floor(diffDays / 7)));
  return labels.dateMonthsAgo.replace('{n}', String(Math.floor(diffDays / 30)));
}

// ─── Online Pulse ─────────────────────────────────────────────────────────────

export function OnlinePulse() {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.8);
  useEffect(() => {
    pulseScale.value = withRepeat(withTiming(1.8, { duration: 1200 }), -1, true);
    pulseOpacity.value = withRepeat(withTiming(0, { duration: 1200 }), -1, true);
  }, []);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));
  return (
    <View style={styles.onlinePulseContainer}>
      <Animated.View style={[styles.onlinePulseRing, ringStyle]} />
      <View style={styles.onlinePulseDot} />
    </View>
  );
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────

interface RenameModalProps {
  visible: boolean;
  initialValue: string;
  onConfirm: (v: string) => void;
  onCancel: () => void;
  title: string;
  subtitle: string;
  placeholder: string;
  cancelLabel: string;
  confirmLabel: string;
}
export function RenameModal({
  visible,
  initialValue,
  onConfirm,
  onCancel,
  title,
  subtitle,
  placeholder,
  cancelLabel,
  confirmLabel,
}: RenameModalProps) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => { if (visible) setValue(initialValue); }, [visible, initialValue]);
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={[
        styles.renameOverlay,
        Platform.OS === 'android' && { backgroundColor: 'rgba(0,0,0,0.85)' }
      ]}>
        <BlurView 
          intensity={Platform.OS === 'ios' ? 30 : 100} 
          tint="dark" 
          style={StyleSheet.absoluteFill} 
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.renameCard, { backgroundColor: '#1A1525' }]}>
          <View style={styles.renameContent}>
            <Text style={styles.renameTitle}>{title}</Text>
            <Text style={styles.renameSubtitle}>{subtitle}</Text>
            <TextInput
              style={styles.renameInput}
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
              autoFocus
              maxLength={60}
            />
            <View style={styles.renameActions}>
              <Pressable onPress={onCancel} style={styles.renameCancelBtn}>
                <Text style={styles.renameCancelText}>{cancelLabel}</Text>
              </Pressable>
              <Pressable
                onPress={() => { if (value.trim()) onConfirm(value.trim()); }}
                style={styles.renameConfirmBtn}
              >
                <LinearGradient
                  colors={Gradients.purpleCTA}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.renameConfirmGradient}
                >
                  <Text style={styles.renameConfirmText}>{confirmLabel}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── History Item ─────────────────────────────────────────────────────────────

export function HistoryItem({
  title, date, isActive, isPinned, onPress, onLongPress,
}: {
  id: string; title: string; date: string;
  isActive: boolean; isPinned: boolean;
  onPress: () => void; onLongPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.historyItem, isActive && styles.historyItemActive]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.historyItemIcon}><Text style={{ fontSize: 14 }}>💬</Text></View>
      <View style={styles.historyItemContent}>
        <View style={styles.historyItemTitleRow}>
          <Text style={styles.historyItemTitle} numberOfLines={1}>{title}</Text>
          {isPinned && <Text style={{ fontSize: 10 }}>📌</Text>}
        </View>
        <Text style={styles.historyItemDate}>{date}</Text>
      </View>
    </Pressable>
  );
}

// ─── History Panel ────────────────────────────────────────────────────────────

export interface ChatHistoryPanelProps {
  isOpen: boolean; onClose: () => void;
  messagesRemaining: number | null;
  dailyMessageLimit: number | null;
  resetTime: Date | null;
  conversations: Conversation[]; activeConversationId: string | null;
  onSelectConversation: (id: string) => Promise<void>;
  onTogglePin: (id: string, isPinned: boolean) => Promise<void>;
  onRenameConversation: (id: string, title: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  onCopyConversation: (id: string) => Promise<void>;
  onNewChat: () => Promise<void>;
  isOnline: boolean; isLoading: boolean;
  /** Display name — falls back to "كابتن" when omitted. */
  displayName?: string | null;
  /** Avatar URL (Cloudflare R2 typically). Falls back to first-letter avatar. */
  avatar?: string | null;
}

export function ChatHistoryPanel({
  isOpen, onClose, messagesRemaining, dailyMessageLimit, resetTime,
  conversations, activeConversationId,
  onSelectConversation, onTogglePin, onRenameConversation, onDeleteConversation,
  onCopyConversation,
  onNewChat, isOnline, isLoading,
  displayName, avatar,
}: ChatHistoryPanelProps) {
  const { t } = useTranslation();
  const p = t.chat.panel;
  const fallbackName = t.chat.welcomeGreetingFallback;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [contextMenu, setContextMenu] = useState<{ conversation: Conversation } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [renameModal, setRenameModal] = useState<{ conversation: Conversation } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered conversations — local search, no backend call needed
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const pinned = filteredConversations.filter(c => c.isPinned);
  const unpinned = filteredConversations.filter(c => !c.isPinned);

  // Mount / unmount control — keeps panel mounted during closing animation
  const [mounted, setMounted] = useState(isOpen);

  const PANEL_WIDTH = Math.min(width * 0.85, 380);
  const translateX = useSharedValue(PANEL_WIDTH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Opening animation — spring slide from right
      translateX.value = withSpring(0, {
        stiffness: 200,
        damping: 24,
        mass: 0.9,
      });
      backdropOpacity.value = withTiming(1, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });
    } else if (mounted) {
      // Closing animation — smoother timing
      translateX.value = withTiming(PANEL_WIDTH, {
        duration: 260,
        easing: Easing.in(Easing.cubic),
      }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
      backdropOpacity.value = withTiming(0, {
        duration: 200,
        easing: Easing.in(Easing.cubic),
      });
    }
  }, [isOpen, PANEL_WIDTH]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop with blur */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.panelBackdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Slide-in panel */}
      <Animated.View
        style={[
          styles.panel,
          { width: PANEL_WIDTH, paddingTop: insets.top + 8 },
          panelStyle,
        ]}
      >
        {/* Glass background layer */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 40 : 90}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.panelOverlay} />
        <View style={styles.panelInnerBorder} />

        <View style={styles.panelContent}>
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

          {/* Header */}
          <View style={styles.panelHeader}>
            <Pressable onPress={onClose} style={styles.panelCloseButton} hitSlop={8}>
              <Text style={styles.panelCloseText}>×</Text>
            </Pressable>
            <View>
              <Text style={styles.panelTitle}>{p.title}</Text>
              <Text style={styles.panelSubtitle}>
                {conversations.length > 0
                  ? (conversations.length === 1
                    ? p.subtitleCount.replace('{count}', String(conversations.length))
                    : p.subtitleCountPlural.replace('{count}', String(conversations.length)))
                  : p.subtitleEmpty}
              </Text>
            </View>
          </View>

          {isLoading && conversations.length === 0 ? (
            <>
              <UserProfileSkeleton />
              <ConversationSkeleton />
            </>
          ) : (
            <>
              {/* Profile Card */}
              <View style={styles.profileCard}>
                <View style={styles.profileCardShine} pointerEvents="none" />
                <View style={styles.profileLeft}>
                  <View style={styles.avatar}>
                    {avatar ? (
                      <Image
                        source={{ uri: avatar }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={150}
                      />
                    ) : (
                      <>
                        <LinearGradient
                          colors={['#8B5CF6', '#7C3AED']}
                          style={StyleSheet.absoluteFill}
                        />
                        <Text style={styles.avatarText}>
                          {(displayName?.trim()?.[0] ?? 'ك').toUpperCase()}
                        </Text>
                      </>
                    )}
                    <View style={[
                      styles.onlineDot,
                      !isOnline && { backgroundColor: '#EF4444' },
                    ]} />
                  </View>
                  <View>
                    <Text style={styles.profileName}>
                      {displayName?.trim() || fallbackName}
                    </Text>
                    <View style={styles.onlineRow}>
                      {isOnline && <OnlinePulse />}
                      <Text style={[
                        styles.onlineText,
                        !isOnline && { color: '#FCA5A5' },
                      ]}>
                        {isOnline ? p.online : p.offline}
                      </Text>
                    </View>
                  </View>
                </View>
                <MessageCounter
                  messagesRemaining={messagesRemaining}
                  total={dailyMessageLimit ?? 10}
                />
              </View>

              {/* New chat button (top, more prominent) */}
              <Pressable
                onPress={onNewChat}
                style={({ pressed }) => [
                  styles.newChatButton,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
              >
                <LinearGradient
                  colors={Gradients.purpleCTA}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.newChatGradient}
                >
                  <Text style={styles.newChatText}>{p.newChatButton}</Text>
                </LinearGradient>
              </Pressable>

              {/* Search bar */}
              <View style={styles.searchBar}>
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={p.searchPlaceholder}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  textAlign="right"
                  returnKeyType="search"
                  clearButtonMode="never"
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    onPress={() => setSearchQuery('')}
                    hitSlop={8}
                    style={styles.searchClear}
                  >
                    <Text style={styles.searchClearText}>×</Text>
                  </Pressable>
                )}
              </View>

              <ScrollView
                style={styles.conversationsList}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                {pinned.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionLabel}>{p.pinnedSection}</Text>
                    </View>
                    <View style={styles.conversationsGroup}>
                      {pinned.map(c => (
                        <HistoryItem
                          key={c.id} id={c.id} title={c.title} date={formatConversationDate(c.updatedAt, p)}
                          isActive={c.id === activeConversationId} isPinned={c.isPinned}
                          onPress={() => onSelectConversation(c.id)}
                          onLongPress={() => setContextMenu({ conversation: c })}
                        />
                      ))}
                    </View>
                  </>
                )}

                {unpinned.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionLabel}>{p.previousSection}</Text>
                    </View>
                    <View style={styles.conversationsGroup}>
                      {unpinned.map(c => (
                        <HistoryItem
                          key={c.id} id={c.id} title={c.title} date={formatConversationDate(c.updatedAt, p)}
                          isActive={c.id === activeConversationId} isPinned={c.isPinned}
                          onPress={() => onSelectConversation(c.id)}
                          onLongPress={() => setContextMenu({ conversation: c })}
                        />
                      ))}
                    </View>
                  </>
                )}

                {/* Empty state — no conversations at all, or no search results */}
                {filteredConversations.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyEmoji}>{searchQuery.trim() ? '🔍' : '💬'}</Text>
                    <Text style={styles.emptyTitle}>
                      {searchQuery.trim() ? p.emptyTitleNoResults : p.emptyTitleNoConversations}
                    </Text>
                    <Text style={styles.emptySub}>
                      {searchQuery.trim()
                        ? p.emptySubNoResults.replace('{query}', searchQuery.trim())
                        : p.emptySubStartChat}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </>
          )}
        </View>
      </Animated.View>

      {contextMenu && (
        <ConversationContextMenu
          conversationTitle={contextMenu.conversation.title}
          isPinned={contextMenu.conversation.isPinned}
          onPin={async () => {
            await onTogglePin(contextMenu.conversation.id, contextMenu.conversation.isPinned);
            setToast({
              message: contextMenu.conversation.isPinned ? p.toastUnpinned : p.toastPinned,
              type: 'success',
            });
            setContextMenu(null);
          }}
          onRename={() => { setContextMenu(null); setRenameModal({ conversation: contextMenu.conversation }); }}
          onDelete={() => {
            const c = contextMenu.conversation;
            setContextMenu(null);
            Alert.alert(
              p.deleteAlertTitle,
              p.deleteAlertMessage.replace('{title}', c.title),
              [
                { text: p.deleteAlertCancel, style: 'cancel' },
                {
                  text: p.deleteAlertConfirm,
                  style: 'destructive',
                  onPress: async () => {
                    await onDeleteConversation(c.id);
                    setToast({ message: p.toastDeleted, type: 'success' });
                  },
                },
              ],
            );
          }}
          onCopy={async () => {
            const c = contextMenu.conversation;
            try {
              await onCopyConversation(c.id);
              setToast({ message: p.toastCopied, type: 'success' });
            } catch {
              setToast({ message: t.chat.connectionLost, type: 'error' });
            }
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      <RenameModal
        visible={renameModal !== null}
        initialValue={renameModal?.conversation.title ?? ''}
        title={p.renameTitle}
        subtitle={p.renameSubtitle}
        placeholder={p.renamePlaceholder}
        cancelLabel={p.renameCancel}
        confirmLabel={p.renameConfirm}
        onConfirm={async (newName) => {
          if (renameModal) {
            await onRenameConversation(renameModal.conversation.id, newName);
            setToast({ message: p.toastRenamed, type: 'success' });
            setRenameModal(null);
          }
        }}
        onCancel={() => setRenameModal(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // ── History Panel ──
  panel: {
    position: 'absolute', top: 0, bottom: 0, right: 0,
    zIndex: 100,
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: -8, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
      },
      android: {
        elevation: 24,
        backgroundColor: 'rgba(13,10,20,0.98)',
      },
    }),
  },
  panelOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(13,10,20,0.72)' : 'transparent',
  },
  panelInnerBorder: {
    position: 'absolute',
    top: 1, left: 1, right: 0, bottom: 1,
    borderTopLeftRadius: 23,
    borderBottomLeftRadius: 23,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
    pointerEvents: 'none',
  },
  panelBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 99,
  },
  panelContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 4,
    zIndex: 1,
  },
  panelHeader: {
        flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 8,
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: 'white',
    textAlign: 'right',
    letterSpacing: -0.3,
  },
  panelSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'right',
    marginTop: 2,
  },
  panelCloseButton: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  panelCloseText: {
    color: 'white',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '300',
  },

  // Profile card
  profileCard: {
        flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  profileCardShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  profileLeft: {
        flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 18,
    zIndex: 1,
  },
  onlineDot: {
    position: 'absolute',
    bottom: -2, right: -2,
    width: 12, height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0D0A14',
  },
  profileName: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'right',
  },
  onlineRow: {
        flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#34D399',
  },

  conversationsList: { flex: 1, marginTop: 4 },
  sectionHeader: {
        flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 18,
  },
  sectionLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  conversationsGroup: { gap: 6 },
  historyItem: {
        flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  historyItemActive: {
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderColor: 'rgba(124,58,237,0.35)',
  },
  historyItemIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  historyItemContent: { flex: 1, gap: 2 },
  historyItemTitleRow: {
        flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyItemTitle: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
  historyItemDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'right',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyEmoji: { fontSize: 42, marginBottom: 8 },
  emptyTitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },

  // New chat button
  newChatButton: {
    marginVertical: 4,
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  newChatGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },

  // Search bar
  searchBar: {
        flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 13,
    paddingVertical: 8,
    includeFontPadding: false,
  },
  searchClear: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  searchClearText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 18,
    lineHeight: 20,
  },

  // ── Rename Modal ──
  renameOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  renameCard: { width: '100%', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  renameContent: { padding: 24, alignItems: 'center' },
  renameTitle: { fontSize: 20, fontWeight: '700', color: 'white', marginBottom: 8 },
  renameSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 24 },
  renameInput: { width: '100%', backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, color: 'white', fontSize: 16, marginBottom: 24 },
  renameActions: { flexDirection: 'row', gap: 12, width: '100%' },
  renameCancelBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  renameCancelText: { color: 'white', fontSize: 16, fontWeight: '600' },
  renameConfirmBtn: { flex: 1, height: 48, borderRadius: 12, overflow: 'hidden' },
  renameConfirmGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  renameConfirmText: { color: 'white', fontSize: 16, fontWeight: '600' },

  onlinePulseContainer: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  onlinePulseRing: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#10B981' },
  onlinePulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },

});
