/**
 * ChatScreen.tsx — 90Plus AI Chat (v3 — text input + retry banner)
 *
 * Key design decisions:
 *  - Personalized greeting from Clerk profile (falls back to "كابتن").
 *  - FIFA-card fields injected into the AI system prompt (silent when
 *    the card is incomplete → user just gets the generic experience).
 *  - One-time soft nudge (via AsyncStorage) to fill the profile.
 *  - LiquidGlass UI ONLY on header, BETA badge, online/offline indicator,
 *    and the input bar — message bubbles keep their existing look.
 *  - Consistent with the Rank screen title style (90 + purple PLUS chip).
 *  - Keyboard-aware FlatList with smart auto-scroll + scroll-to-bottom button.
 *  - BottomNav hides itself when pathname includes /chat — no tabBarStyle
 *    hacks needed (we use a custom nav, not expo-router's default tab bar).
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    FlatList,
    StyleSheet,
    Platform,
    Keyboard,
    KeyboardEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
    useSharedValue,
    withSpring,
    useAnimatedStyle,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';

import { useAIChatNative } from '../../hooks/useAIChatNative';
import { useChatProfile, buildProfileSystemPromptSuffix } from '../../hooks/useChatProfile';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { AIMessageBubble, UserMessageBubble } from '../../components/chat/MessageBubble';
import { ThinkingIndicator } from '../../components/chat/ThinkingIndicator';
import { ScrollToBottomButton } from '../../components/chat/ScrollToBottomButton';
import {
    AppBackground,
    HistoryPanel,
    ChipButton,
    SpinnerRing,
} from '../../components/chat/ChatInternalComponents';
import { Toast } from '../../components/chat/Toast';
import { Colors, Gradients, BlurIntensity } from '../../constants/theme';
import { useScreenFont } from '../../utils/fontSetup';
import { useTranslation } from '../../src/i18n';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#A855F7';
const SCROLL_NEAR_BOTTOM_THRESHOLD = 120; // px
const NUDGE_FLAG_PREFIX = '@chat_fifa_nudge_shown_v1_';

// ─── Animated components ──────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── Glass helpers ────────────────────────────────────────────────────────────

function GlassSurface({
    style,
    children,
    tint = 'rgba(14,10,22,0.72)',
    effect = 'regular' as const,
    interactive = false,
}: {
    style?: any;
    children?: React.ReactNode;
    tint?: string;
    effect?: 'regular' | 'clear';
    interactive?: boolean;
}) {
    if (isLiquidGlassSupported) {
        return (
            <LiquidGlassView
                {...({
                    style: [{ overflow: 'hidden' }, style],
                    tint,
                    effect,
                    interactive,
                } as any)}
            >
                {children}
            </LiquidGlassView>
        );
    }
    // Fallback: BlurView + solid tint so Android still gets a reasonable glass look.
    return (
        <View style={[{ overflow: 'hidden' }, style]}>
            <BlurView
                intensity={BlurIntensity.header}
                tint="dark"
                style={StyleSheet.absoluteFill}
            />
            <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: tint }]}
            />
            {children}
        </View>
    );
}

// ─── Main ChatScreen ──────────────────────────────────────────────────────────

export default function ChatScreen() {
    useScreenFont();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const listRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);
    const { t } = useTranslation();
    const tChat = t.chat;

    // ─── State ──────────────────────────────────────────────────────────────
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [nudgeText, setNudgeText] = useState<string | null>(null);

    // Track whether user is near the bottom — used to auto-scroll on new msgs
    const isNearBottomRef = useRef(true);
    const lastMessageCountRef = useRef(0);

    // ─── Profile & connectivity ─────────────────────────────────────────────
    const { profileRef, profile, isFifaCardComplete } = useChatProfile();
    const { isOnline } = useNetworkStatus();

    // ─── Connection toast ────────────────────────────────────────────────────
    const [connToast, setConnToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const prevOnlineRef = useRef<boolean | null>(null);

    useEffect(() => {
        if (prevOnlineRef.current === null) {
            prevOnlineRef.current = isOnline;
            return;
        }
        if (prevOnlineRef.current === isOnline) return;
        prevOnlineRef.current = isOnline;

        if (isOnline) {
            setConnToast({ message: tChat.backOnline, type: 'success' });
        } else {
            setConnToast({ message: tChat.offline, type: 'error' });
        }
    }, [isOnline, tChat.backOnline, tChat.offline]);

    const greetingName = useMemo(
        () => (profile?.displayName?.trim() || tChat.welcomeGreetingFallback),
        [profile?.displayName, tChat.welcomeGreetingFallback],
    );

    // Hook uses a ref builder so we don't need to re-memoize sendMessage when
    // the profile slice arrives from the network.
    const getSystemPromptSuffix = useCallback(
        () => buildProfileSystemPromptSuffix(
            profileRef.current,
            profileRef.current?.displayName?.trim() || tChat.welcomeGreetingFallback,
        ),
        [profileRef, tChat.welcomeGreetingFallback],
    );

    // ─── Chat hook ──────────────────────────────────────────────────────────
    const {
        messages, conversations, currentConversationId,
        inputValue, setInputValue, isLoading, isThinking, isRetrying,
        messagesRemaining, resetTime, error,
        streamingMessageId,
        sendMessage, editMessage, deleteMessage, clearChat,
        selectConversation, startNewConversation,
        togglePinConversation, renameConversation, deleteConversation,
        retryLastMessage, dismissError,
    } = useAIChatNative({ getSystemPromptSuffix });

    // ─── One-time nudge to complete the FIFA card ───────────────────────────
    useEffect(() => {
        // Only consider showing the nudge once the profile has loaded and
        // we know it's incomplete. `profile` being null = still loading.
        if (!profile) return;
        if (isFifaCardComplete) return;
        const userKey = profile.displayName ?? 'anon';
        const storageKey = `${NUDGE_FLAG_PREFIX}${userKey}`;
        let cancelled = false;

        (async () => {
            try {
                const seen = await AsyncStorage.getItem(storageKey);
                if (seen || cancelled) return;
                setNudgeText(tChat.profileNudge);
                AsyncStorage.setItem(storageKey, '1').catch(() => {});
                // Auto-dismiss after ~6s so it never lingers.
                setTimeout(() => {
                    if (!cancelled) setNudgeText(null);
                }, 6000);
            } catch {
                // silent
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [profile, isFifaCardComplete]);

    // ─── Keyboard tracking ───────────────────────────────────────────────
    // keyboardHeight is used for:
    //   1) Auto-scrolling to the bottom when the keyboard opens.
    //   2) Lifting the bottomArea on Android (see bottomPad below). iOS
    //      relies on KeyboardAvoidingView instead of this value for layout.
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (e: KeyboardEvent) => {
            setKeyboardHeight(e.endCoordinates.height);
            const delay = Platform.OS === 'ios' ? 0 : 100;
            setTimeout(() => {
                listRef.current?.scrollToEnd({ animated: true });
            }, delay);
        };
        const onHide = () => setKeyboardHeight(0);

        const subShow = Keyboard.addListener(showEvent, onShow);
        const subHide = Keyboard.addListener(hideEvent, onHide);
        return () => { subShow.remove(); subHide.remove(); };
    }, []);

    // ─── Smart auto-scroll on new messages ──────────────────────────────────
    useEffect(() => {
        const newCount = messages.length;
        const prevCount = lastMessageCountRef.current;

        if (newCount > prevCount) {
            if (isNearBottomRef.current) {
                // Give the layout a beat to settle so we don't scroll to an
                // intermediate height and end up short.
                setTimeout(() => {
                    listRef.current?.scrollToEnd({ animated: true });
                }, 80);
            } else {
                // Count only AI-authored deltas as unread — the user's own
                // outbound message shouldn't count against them.
                const added = messages.slice(prevCount, newCount);
                const aiAdded = added.filter(m => m.role === 'ai').length;
                if (aiAdded > 0) setUnreadCount(c => c + aiAdded);
            }
        }
        lastMessageCountRef.current = newCount;
    }, [messages.length]);

    // While the assistant is streaming and the user has scrolled away, keep
    // the unread badge visible (≥1) so they know fresh content is landing.
    useEffect(() => {
        if (!streamingMessageId) return;
        if (isNearBottomRef.current) return;
        setUnreadCount(c => (c < 1 ? 1 : c));
    }, [streamingMessageId, messages]);

    // ─── Derived flags ──────────────────────────────────────────────────────
    const hasMessages = messages.length > 1;
    // Keyboard handling — single source of truth, no KeyboardAvoidingView.
    //   Android: app.json sets softwareKeyboardLayoutMode = "pan", so the OS
    //            pans the whole window up to keep the focused input visible.
    //            We do NOT add keyboardHeight on top of that or we get a
    //            double-lift / stretched screen.
    //   iOS:     no native pan — we lift the absolute-positioned bottomArea
    //            ourselves by setting `bottom = keyboardHeight + smallGap`.
    const isKbOpen = keyboardHeight > 0;
    const baseInset = Math.max(insets.bottom, 12);
    const bottomPad = isKbOpen
        ? Platform.OS === 'ios'
            ? keyboardHeight + 4    // iOS: lift manually above the keyboard
            : 4                     // Android: OS pan already lifted us
        : baseInset;

    // ─── Handlers ───────────────────────────────────────────────────────────
    const handleSend = useCallback((textOverride?: string) => {
        const textToSend = textOverride ?? inputValue;
        if (!textToSend.trim()) return;

        if (editingMessage) {
            editMessage(editingMessage.id, textToSend.trim());
            setEditingMessage(null);
            setInputValue('');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        sendMessage(textOverride);
        setInputValue('');
        // Force scroll to bottom (we just sent a message)
        isNearBottomRef.current = true;
        setUnreadCount(0);
        requestAnimationFrame(() => {
            listRef.current?.scrollToEnd({ animated: true });
        });
    }, [editingMessage, inputValue, editMessage, sendMessage, setInputValue]);

    const handleStartEdit = useCallback((id: string, text: string) => {
        setEditingMessage({ id, text });
        setInputValue(text);
        setTimeout(() => inputRef.current?.focus(), 100);
    }, [setInputValue]);

    const handleCancelEdit = useCallback(() => {
        setEditingMessage(null);
        setInputValue('');
    }, [setInputValue]);

    const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
        const near = distanceFromBottom < SCROLL_NEAR_BOTTOM_THRESHOLD;

        isNearBottomRef.current = near;

        if (near) {
            if (unreadCount > 0) setUnreadCount(0);
            if (showScrollButton) setShowScrollButton(false);
        } else if (!showScrollButton) {
            setShowScrollButton(true);
        }
    }, [showScrollButton, unreadCount]);

    const handleScrollToBottom = useCallback(() => {
        Haptics.selectionAsync().catch(() => {});
        isNearBottomRef.current = true;
        setUnreadCount(0);
        listRef.current?.scrollToEnd({ animated: true });
    }, []);

    const handleOpenPanel = useCallback(() => {
        Haptics.selectionAsync().catch(() => {});
        setIsPanelOpen(true);
    }, []);

    const handleBackHome = useCallback(() => {
        Haptics.selectionAsync().catch(() => {});
        router.push('/');
    }, [router]);

    // ─── Message renderer — memoized ─────────────────────────────────────────
    const renderMessage = useCallback(({ item: msg, index: i }: { item: any; index: number }) => {
        if (msg.role === 'ai') {
            // Skip the empty assistant placeholder while we're still waiting
            // for the first visible token. The ThinkingIndicator covers this
            // gap — rendering the bubble too early produces an ugly empty pill.
            // Once any text is in the message, fall through and render normally.
            const text = (msg.text ?? '').toString();
            if (msg.isStreaming && text.trim().length === 0) {
                return null;
            }
            // History = any AI message that isn't the one currently streaming.
            // This keeps the character-by-character animation on live replies
            // while making previously-saved conversations render instantly.
            const isHistory = msg.id !== streamingMessageId;
            return <AIMessageBubble message={msg} index={i} isHistory={isHistory} />;
        }
        return (
            <UserMessageBubble
                message={msg}
                index={i}
                onResend={() => handleSend(msg.text)}
                onEdit={() => handleStartEdit(msg.id, msg.text)}
                onDelete={() => deleteMessage(msg.id)}
                onCopy={() => ExpoClipboard.setStringAsync(msg.text).catch(() => {})}
            />
        );
    }, [handleSend, handleStartEdit, deleteMessage, streamingMessageId]);

    const keyExtractor = useCallback((item: any) => item.id, []);

    // Skip the welcome message (first one)
    const displayMessages = useMemo(() => messages.slice(1), [messages]);

    // ─── Render ─────────────────────────────────────────────────────────────
    return (
        <View style={styles.root}>
            <AppBackground />

            {/* ── History Panel ── */}
            <HistoryPanel
                isOpen={isPanelOpen}
                onClose={() => setIsPanelOpen(false)}
                messagesRemaining={messagesRemaining}
                resetTime={resetTime}
                conversations={conversations}
                activeConversationId={currentConversationId}
                onSelectConversation={async (id) => {
                    await selectConversation(id);
                    setIsPanelOpen(false);
                    // After loading the new history, pin to the bottom so
                    // the most recent exchange is visible.
                    isNearBottomRef.current = true;
                    setUnreadCount(0);
                    requestAnimationFrame(() => {
                        listRef.current?.scrollToEnd({ animated: false });
                    });
                }}
                onTogglePin={togglePinConversation}
                onRenameConversation={renameConversation}
                onDeleteConversation={deleteConversation}
                onNewChat={async () => {
                    clearChat();
                    await startNewConversation();
                    setIsPanelOpen(false);
                }}
                isOnline={isOnline}
                isLoading={isLoading}
                displayName={profile?.displayName ?? null}
                avatar={profile?.avatar ?? null}
            />

            {/* ── Floating Glass Header — same pattern as RankHeader ── */}
            {(() => {
                const HeaderGlass: any = isLiquidGlassSupported ? LiquidGlassView : BlurView;
                const glassProps: any = isLiquidGlassSupported
                    ? { effect: 'clear', interactive: true, tint: 'rgba(5,1,13,0.0)' }
                    : { intensity: 20, tint: 'dark' };
                return (
                    <HeaderGlass
                        {...glassProps}
                        style={[styles.header, { paddingTop: insets.top + 10 }]}
                    >
                        {/* Back arrow — LEFT */}
                        <Pressable
                            onPress={handleBackHome}
                            style={({ pressed }) => [
                                styles.iconButton,
                                pressed && styles.iconButtonPressed,
                            ]}
                            hitSlop={8}
                            accessibilityLabel={tChat.a11yBack}
                            accessibilityRole="button"
                        >
                            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}>
                                <Path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                        </Pressable>

                        {/* Center — single title pill: 90 + PLUS chip + Captain AI */}
                        <View style={styles.logoPillLarge}>
                            <Text style={styles.logo90Large}>90</Text>
                            <View style={styles.plusChipLarge}>
                                <Text style={styles.logoPlusLarge}>PLUS</Text>
                            </View>
                            <Text style={styles.captainText}>Captain AI</Text>
                        </View>

                        {/* Menu — RIGHT */}
                        <Pressable
                            onPress={handleOpenPanel}
                            style={({ pressed }) => [
                                styles.iconButton,
                                pressed && styles.iconButtonPressed,
                            ]}
                            hitSlop={8}
                            accessibilityLabel={tChat.a11yMenu}
                            accessibilityRole="button"
                        >
                            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}>
                                <Path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
                            </Svg>
                        </Pressable>
                    </HeaderGlass>
                );
            })()}

            {/* ── Connection toast ── */}
            {connToast && (
                <Toast
                    message={connToast.message}
                    type={connToast.type}
                    onClose={() => setConnToast(null)}
                    duration={3000}
                />
            )}

            {/* ── Content ── */}
            {/*
             * Keyboard handling lives in the bottomArea below — we lift the
             * input bar manually by `bottom = keyboardHeight + 4` on iOS,
             * and rely on Android's "pan" mode (set in app.json) to handle
             * the system slide. We deliberately do NOT use
             * KeyboardAvoidingView: combining KAV with android pan mode
             * stretched the screen, and on iOS it double-lifted the input
             * above the keyboard.
             */}
            <View style={styles.contentWrap}>
                {!hasMessages ? (
                    <WelcomeScreen
                        onPickChip={handleSend}
                        insetsTop={insets.top}
                        greetingName={greetingName}
                        tChat={tChat}
                    />
                ) : (
                    <FlatList
                        ref={listRef}
                        style={[styles.messagesList, { marginTop: insets.top + 64 }]}
                        contentContainerStyle={[
                            styles.messagesContent,
                            // Reserve space for the input bar (~52px) + the
                            // current bottomPad (which already includes
                            // safe-area + keyboard lift on iOS) + 24 px
                            // breathing room. Don't add insets.bottom again
                            // here — bottomPad already factors it in.
                            { paddingBottom: 52 + bottomPad + 24 },
                        ]}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        automaticallyAdjustKeyboardInsets={false}
                        data={displayMessages}
                        keyExtractor={keyExtractor}
                        renderItem={renderMessage}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        onContentSizeChange={() => {
                            // Auto-scroll while the user is at the bottom OR
                            // while the assistant is actively streaming (so
                            // every flushed chunk keeps the latest text in
                            // view). Never force-scroll mid-history-read.
                            if (isNearBottomRef.current || streamingMessageId) {
                                requestAnimationFrame(() => {
                                    listRef.current?.scrollToEnd({ animated: false });
                                });
                            }
                        }}
                        onLayout={() => {
                            // First render after data arrives — pin to bottom.
                            requestAnimationFrame(() => {
                                listRef.current?.scrollToEnd({ animated: false });
                            });
                        }}
                        removeClippedSubviews={Platform.OS === 'android'}
                        maxToRenderPerBatch={10}
                        updateCellsBatchingPeriod={50}
                        windowSize={10}
                        ListFooterComponent={
                            isThinking ? (
                                <ThinkingIndicator
                                    isThinking={isThinking}
                                    lastMessage={messages[messages.length - 1]?.text ?? ''}
                                />
                            ) : null
                        }
                    />
                )}

                {/* ── Scroll to bottom button ── */}
                {showScrollButton && hasMessages && (
                    <Animated.View
                        entering={FadeIn.duration(200).springify()}
                        exiting={FadeOut.duration(150)}
                        style={[styles.scrollBtnWrap, { bottom: bottomPad + 90 }]}
                        pointerEvents="box-none"
                    >
                        <ScrollToBottomButton
                            onPress={handleScrollToBottom}
                            newMessagesCount={unreadCount}
                        />
                    </Animated.View>
                )}

                {/* ── Nudge toast (one-time) ── */}
                {nudgeText && (
                    <Animated.View
                        entering={FadeIn.duration(220)}
                        exiting={FadeOut.duration(180)}
                        style={[styles.nudgeWrap, { bottom: bottomPad + 160 }]}
                        pointerEvents="box-none"
                    >
                        <GlassSurface
                            style={styles.nudgeCard}
                            tint="rgba(124,58,237,0.22)"
                            effect="regular"
                            interactive
                        >
                            <Text style={styles.nudgeText}>{nudgeText}</Text>
                            <Pressable
                                onPress={() => setNudgeText(null)}
                                hitSlop={8}
                                style={styles.nudgeDismiss}
                            >
                                <Text style={styles.nudgeDismissText}>×</Text>
                            </Pressable>
                        </GlassSurface>
                    </Animated.View>
                )}

                {/* ── Retry / disconnect banner ── */}
                {(isRetrying || (error && !isLoading)) && (
                    <Animated.View
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(150)}
                        style={[styles.retryBanner, { bottom: bottomPad + 100 }]}
                        pointerEvents="box-none"
                    >
                        <View style={styles.retryBannerInner}>
                            <Text style={styles.retryBannerText} numberOfLines={2}>
                                {error ?? tChat.connectionLost}
                            </Text>
                            {!isRetrying && (
                                <Pressable
                                    onPress={() => { dismissError(); retryLastMessage(); }}
                                    style={styles.retryBannerBtn}
                                    hitSlop={8}
                                >
                                    <Text style={styles.retryBannerBtnText}>{tChat.retryButton}</Text>
                                </Pressable>
                            )}
                            {!isRetrying && (
                                <Pressable onPress={dismissError} hitSlop={8} style={styles.retryBannerDismiss}>
                                    <Text style={styles.retryBannerDismissText}>×</Text>
                                </Pressable>
                            )}
                        </View>
                    </Animated.View>
                )}

                {/* ── Input Bar ── */}
                <View style={[styles.bottomArea, { bottom: bottomPad }]} pointerEvents="box-none">
                    {messagesRemaining === 0 && resetTime ? (
                        <View style={styles.limitBanner}>
                            <Text style={styles.limitText}>{tChat.dailyLimitOver}</Text>
                        </View>
                    ) : (
                        <GlassSurface
                            style={styles.inputWrapper}
                            tint="rgba(16,10,28,0.55)"
                            effect="regular"
                            interactive
                        >
                            <LinearGradient
                                colors={['rgba(124,58,237,0.08)', 'rgba(76,29,149,0.04)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                                pointerEvents="none"
                            />

                            {/* Edit banner */}
                            {editingMessage && (
                                <Animated.View
                                    entering={FadeIn.duration(180)}
                                    style={styles.editHeader}
                                >
                                    <View style={styles.editLabel}>
                                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.purpleSoft} strokeWidth={2}>
                                            <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </Svg>
                                        <Text style={styles.editText}>{tChat.editingMessage}</Text>
                                    </View>
                                    <Pressable onPress={handleCancelEdit} hitSlop={8}>
                                        <Text style={styles.editCancel}>×</Text>
                                    </Pressable>
                                </Animated.View>
                            )}

                            {/* Input row */}
                            <View style={styles.inputRow}>
                                <TextInput
                                    ref={inputRef}
                                    style={styles.textInput}
                                    value={inputValue}
                                    onChangeText={setInputValue}
                                    placeholder={editingMessage ? tChat.inputPlaceholderEdit : tChat.inputPlaceholder}
                                    placeholderTextColor="rgba(255,255,255,0.35)"
                                    multiline
                                    textAlign="right"
                                    onSubmitEditing={() => handleSend()}
                                    submitBehavior="submit"
                                    underlineColorAndroid="transparent"
                                    selectionColor={Colors.purpleSoft}
                                />
                                <SendButton
                                    active={Boolean(inputValue.trim())}
                                    loading={isLoading}
                                    onPress={() => handleSend()}
                                />
                            </View>
                        </GlassSurface>
                    )}

                    <View style={styles.footerInfo}>
                        <Text style={styles.footerText}>powered by mr.dev ai</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

// ─── Send Button (animated) ───────────────────────────────────────────────────

function SendButton({
    active, loading, onPress,
}: { active: boolean; loading: boolean; onPress: () => void }) {
    const scale = useSharedValue(1);

    const style = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <AnimatedPressable
            onPress={onPress}
            disabled={!active || loading}
            style={style}
            onPressIn={() => { scale.value = withSpring(0.9, { stiffness: 300, damping: 18 }); }}
            onPressOut={() => { scale.value = withSpring(1, { stiffness: 300, damping: 18 }); }}
            accessibilityRole="button"
            accessibilityLabel="Send message"
        >
            <View style={[styles.sendButton, active && styles.sendButtonActive]}>
                {active && (
                    <LinearGradient
                        colors={Gradients.purpleCTA}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                )}
                {loading ? (
                    <SpinnerRing />
                ) : (
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}>
                        <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                )}
            </View>
        </AnimatedPressable>
    );
}

// ─── Welcome Screen ───────────────────────────────────────────────────────────

const WelcomeScreen = React.memo(function WelcomeScreen({
    onPickChip, insetsTop, greetingName, tChat,
}: {
    onPickChip: (text: string) => void;
    insetsTop: number;
    greetingName: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tChat: any;
}) {
    const greeting = (tChat.welcomeGreeting as string).replace('{name}', greetingName);
    return (
        <ScrollView
            contentContainerStyle={[
                styles.welcomeContent,
                { paddingTop: insetsTop + 64 + 32 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            {/* Hero block — no decorative glow orb (removed by request) */}

            <Animated.View
                entering={FadeIn.duration(400)}
                style={styles.welcomeHero}
            >
                <Text style={styles.welcomeTitle}>{greeting}</Text>
                <Text style={styles.welcomeSubtitle}>{tChat.welcomeSubtitle}</Text>
                <Text style={styles.welcomeBrand}>{tChat.welcomeBrand}</Text>
            </Animated.View>

            <Animated.View
                entering={FadeIn.duration(400).delay(120)}
                style={styles.chipGrid}
            >
                <View style={styles.chipRow}>
                    <ChipButton
                        icon="⚽"
                        text={tChat.suggestionFootballInfo}
                        onClick={() => onPickChip(tChat.suggestionFootballInfo)}
                    />
                    <ChipButton
                        icon="📊"
                        text={tChat.suggestionLeagueStats}
                        onClick={() => onPickChip(tChat.suggestionLeagueStats)}
                    />
                </View>
                <View style={styles.chipRow}>
                    <ChipButton
                        icon="💪"
                        text={tChat.suggestionTrainingPlan}
                        onClick={() => onPickChip(tChat.suggestionTrainingPlan)}
                    />
                    <ChipButton
                        icon="🥗"
                        text={tChat.suggestionDietPlan}
                        onClick={() => onPickChip(tChat.suggestionDietPlan)}
                    />
                </View>
                <View style={styles.chipRow}>
                    <ChipButton
                        icon="🩹"
                        text={tChat.suggestionRecoveryTips}
                        onClick={() => onPickChip(tChat.suggestionRecoveryTips)}
                    />
                </View>
            </Animated.View>
        </ScrollView>
    );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: Colors.bgBase,
    },
    contentWrap: {
        flex: 1,
    },

    // ── Header — same structure as RankHeader ──
    header: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(5,1,13,0.0)',
    },

    // Single title pill: 90 + PLUS chip + Captain AI
    logoPillLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        gap: 6,
    },
    logo90Large: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    plusChipLarge: {
        backgroundColor: ACCENT,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    logoPlusLarge: {
        color: '#fff',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    captainText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: -0.1,
    },

    iconButton: {
        width: 38, height: 38, borderRadius: 19,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    iconButtonPressed: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        transform: [{ scale: 0.92 }],
    },

    // ── Welcome ──
    welcomeContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
        alignItems: 'center',
        paddingBottom: 140,
    },
    welcomeHero: {
        alignItems: 'center',
        marginBottom: 12,
    },
    welcomeTitle: {
        fontSize: 30, fontWeight: '800',
        color: 'white', textAlign: 'center',
        marginBottom: 6, letterSpacing: -0.5,
    },
    welcomeSubtitle: {
        fontSize: 22, fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center', marginBottom: 12,
    },
    welcomeBrand: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        letterSpacing: 0.3,
    },

    chipGrid: {
        width: '100%',
        marginTop: 8,
        gap: 10,
    },
    chipRow: {
        flexDirection: 'row-reverse',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 4,
    },

    // ── Messages ──
    messagesList: { flex: 1 },
    messagesContent: {
        paddingHorizontal: 12,
        paddingTop: 16,
        gap: 4,
    },

    // ── Scroll button ──
    scrollBtnWrap: {
        position: 'absolute',
        left: 0, right: 0,
        zIndex: 30,
    },

    // ── Nudge ──
    nudgeWrap: {
        position: 'absolute',
        left: 16, right: 16,
        zIndex: 35,
    },
    nudgeCard: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(167,139,250,0.35)',
    },
    nudgeText: {
        flex: 1,
        color: 'rgba(255,255,255,0.92)',
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'right',
    },
    nudgeDismiss: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    nudgeDismissText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 20,
        lineHeight: 20,
    },

    // ── Bottom / Input ──
    bottomArea: {
        position: 'absolute',
        left: 0, right: 0,
        paddingHorizontal: 12,
        zIndex: 40,
    },
    inputWrapper: {
        borderRadius: 26,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        minHeight: 52,
        paddingLeft: 6,
        paddingRight: 14,
        paddingVertical: 6,
    },
    sendButton: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
        flexShrink: 0,
    },
    sendButtonActive: {
        ...Platform.select({
            ios: {
                shadowColor: '#7C3AED',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.5,
                shadowRadius: 10,
            },
            android: { elevation: 6 },
        }),
    },
    textInput: {
        flex: 1,
        color: 'white',
        fontSize: 15,
        textAlign: 'right',
        paddingVertical: 10,
        paddingHorizontal: 10,
        maxHeight: 120,
        includeFontPadding: false,
    },
    editHeader: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(124,58,237,0.12)',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(124,58,237,0.25)',
        paddingHorizontal: 16, paddingVertical: 8,
    },
    editLabel: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
    editText: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
    editCancel: {
        fontSize: 22, color: 'rgba(255,255,255,0.6)',
        width: 24, height: 24, textAlign: 'center',
        lineHeight: 22,
    },
    footerInfo: { alignItems: 'center', marginTop: 8 },
    footerText: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.22)',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    limitBanner: {
        flexDirection: 'row-reverse',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 24,
        paddingHorizontal: 24, paddingVertical: 14,
    },
    limitText: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },

    // ── Retry / disconnect banner ──
    retryBanner: {
        position: 'absolute',
        left: 12, right: 12,
        zIndex: 38,
    },
    retryBannerInner: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        backgroundColor: 'rgba(239,68,68,0.18)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(239,68,68,0.4)',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 8,
    },
    retryBannerText: {
        flex: 1,
        color: '#FCA5A5',
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'right',
    },
    retryBannerBtn: {
        backgroundColor: 'rgba(239,68,68,0.35)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    retryBannerBtnText: {
        color: '#FCA5A5',
        fontSize: 12,
        fontWeight: '700',
    },
    retryBannerDismiss: {
        width: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    retryBannerDismissText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 18,
        lineHeight: 20,
    },
});
