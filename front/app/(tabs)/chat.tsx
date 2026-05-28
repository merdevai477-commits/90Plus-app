/**
 * ChatScreen — 90Plus AI Chat
 * Layout: SafeAreaView → header (in-flow) → flex:1 messages → ChatComposer (outside FlatList).
 * iOS: KeyboardAvoidingView padding. Android: windowSoftInputMode resize (app.json).
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
    KeyboardAvoidingView,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';

import { useAIChatNative, Message } from '../../hooks/useAIChatNative';
import { useChatProfile, buildProfileSystemPromptSuffix } from '../../hooks/useChatProfile';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { AIMessageBubble, UserMessageBubble } from '../../components/chat/MessageBubble';
import { ChatComposer } from '../../components/chat/ChatComposer';
import { ThinkingIndicator } from '../../components/chat/ThinkingIndicator';
import { ScrollToBottomButton } from '../../components/chat/ScrollToBottomButton';
import {
    AppBackground,
    HistoryPanel,
    ChipButton,
} from '../../components/chat/ChatInternalComponents';
import { Toast } from '../../components/chat/Toast';
import { Colors, BlurIntensity } from '../../constants/theme';
import { useScreenFont } from '../../utils/fontSetup';
import { useTranslation } from '../../src/i18n';

const ACCENT = '#A855F7';
const SCROLL_NEAR_BOTTOM_THRESHOLD = 120;
const NUDGE_FLAG_PREFIX = '@chat_fifa_nudge_shown_v1_';
const FAB_GAP = 16;
/** FlatList bottom inset only — composer is a sibling, not an overlay. Do not add composer height here. */
const LIST_BOTTOM_PADDING = 12;

function GlassSurface({
    style,
    children,
    tint = 'rgba(14,10,22,0.72)',
    effect = 'regular' as const,
    interactive = false,
}: {
    style?: object;
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
                } as object)}
            >
                {children}
            </LiquidGlassView>
        );
    }
    return (
        <View style={[{ overflow: 'hidden' }, style]}>
            <BlurView intensity={BlurIntensity.header} tint="dark" style={StyleSheet.absoluteFill} />
            <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: tint }]}
            />
            {children}
        </View>
    );
}

function ChatHeader({
    onBack,
    onMenu,
    backLabel,
    menuLabel,
}: {
    onBack: () => void;
    onMenu: () => void;
    backLabel: string;
    menuLabel: string;
}) {
    const HeaderGlass: React.ComponentType<Record<string, unknown>> = isLiquidGlassSupported
        ? (LiquidGlassView as React.ComponentType<Record<string, unknown>>)
        : (BlurView as React.ComponentType<Record<string, unknown>>);
    const glassProps: Record<string, unknown> = isLiquidGlassSupported
        ? { effect: 'clear', interactive: true, tint: 'rgba(5,1,13,0.0)' }
        : { intensity: 20, tint: 'dark' };

    return (
        <HeaderGlass {...glassProps} style={styles.header}>
            <Pressable
                onPress={onBack}
                style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
                hitSlop={8}
                accessibilityLabel={backLabel}
                accessibilityRole="button"
            >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}>
                    <Path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
            </Pressable>

            <View style={styles.logoPillLarge}>
                <Text style={styles.logo90Large}>90</Text>
                <View style={styles.plusChipLarge}>
                    <Text style={styles.logoPlusLarge}>PLUS</Text>
                </View>
                <Text style={styles.captainText}>Captain AI</Text>
            </View>

            <Pressable
                onPress={onMenu}
                style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
                hitSlop={8}
                accessibilityLabel={menuLabel}
                accessibilityRole="button"
            >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}>
                    <Path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
                </Svg>
            </Pressable>
        </HeaderGlass>
    );
}

export default function ChatScreen() {
    useScreenFont();
    const router = useRouter();
    const listRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);
    const { t } = useTranslation();
    const tChat = t.chat;

    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [nudgeText, setNudgeText] = useState<string | null>(null);

    const isNearBottomRef = useRef(true);
    const lastMessageCountRef = useRef(0);

    const { profileRef, profile, isFifaCardComplete } = useChatProfile();
    const { isOnline } = useNetworkStatus();

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

    const getSystemPromptSuffix = useCallback(
        () => buildProfileSystemPromptSuffix(
            profileRef.current,
            profileRef.current?.displayName?.trim() || tChat.welcomeGreetingFallback,
        ),
        [profileRef, tChat.welcomeGreetingFallback],
    );

    const {
        messages, conversations, currentConversationId,
        inputValue, setInputValue, isLoading, isThinking, isRetrying,
        messagesRemaining, dailyMessageLimit, resetTime, error,
        streamingMessageId,
        sendMessage, editMessage, deleteMessage, clearChat,
        selectConversation, startNewConversation,
        togglePinConversation, renameConversation, deleteConversation,
        retryLastMessage, dismissError,
    } = useAIChatNative({ getSystemPromptSuffix });

    useEffect(() => {
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
                setTimeout(() => {
                    if (!cancelled) setNudgeText(null);
                }, 6000);
            } catch {
                // silent
            }
        })();

        return () => { cancelled = true; };
    }, [profile, isFifaCardComplete, tChat.profileNudge]);

    // Keyboard: scroll only — no layout padding from keyboard height
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = () => {
            setKeyboardVisible(true);
            if (!isNearBottomRef.current) return;
            const delay = Platform.OS === 'ios' ? 0 : 100;
            setTimeout(() => {
                listRef.current?.scrollToEnd({ animated: true });
            }, delay);
        };
        const onHide = () => setKeyboardVisible(false);

        const subShow = Keyboard.addListener(showEvent, onShow);
        const subHide = Keyboard.addListener(hideEvent, onHide);
        return () => { subShow.remove(); subHide.remove(); };
    }, []);

    useEffect(() => {
        const newCount = messages.length;
        const prevCount = lastMessageCountRef.current;

        if (newCount > prevCount) {
            if (isNearBottomRef.current) {
                setTimeout(() => {
                    listRef.current?.scrollToEnd({ animated: true });
                }, 80);
            } else {
                const added = messages.slice(prevCount, newCount);
                const aiAdded = added.filter(m => m.role === 'ai').length;
                if (aiAdded > 0) setUnreadCount(c => c + aiAdded);
            }
        }
        lastMessageCountRef.current = newCount;
    }, [messages.length, messages]);

    useEffect(() => {
        if (!streamingMessageId) return;
        if (isNearBottomRef.current) return;
        setUnreadCount(c => (c < 1 ? 1 : c));
    }, [streamingMessageId, messages]);

    const hasMessages = messages.length > 1;

    useEffect(() => {
        if (!hasMessages) return;
        requestAnimationFrame(() => {
            listRef.current?.scrollToEnd({ animated: false });
        });
    }, [hasMessages]);

    const listContentStyle = useMemo(
        () => ({
            paddingHorizontal: 12,
            paddingTop: 16,
            paddingBottom: LIST_BOTTOM_PADDING,
            gap: 4,
        }),
        [],
    );

    const overlayBottom = FAB_GAP;
    const bannerBottom = FAB_GAP + 8;

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
        isNearBottomRef.current = true;
        setUnreadCount(0);
        requestAnimationFrame(() => {
            listRef.current?.scrollToEnd({ animated: true });
            inputRef.current?.focus();
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

    const renderMessage = useCallback(({ item: msg, index: i }: { item: Message; index: number }) => {
        if (msg.role === 'ai') {
            const text = (msg.text ?? '').toString();
            if (msg.isStreaming && text.trim().length === 0) {
                return null;
            }
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

    const keyExtractor = useCallback((item: Message) => item.id, []);
    const displayMessages = useMemo(() => messages.slice(1), [messages]);

    const chatBody = (
        <View style={styles.body}>
            {!hasMessages ? (
                <WelcomeScreen
                    onPickChip={handleSend}
                    greetingName={greetingName}
                    tChat={tChat}
                    keyboardOpen={keyboardVisible}
                />
            ) : (
                <View style={styles.messagesPane}>
                    <FlatList
                        ref={listRef}
                        style={styles.messagesList}
                        contentContainerStyle={listContentStyle}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        data={displayMessages}
                        keyExtractor={keyExtractor}
                        renderItem={renderMessage}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        onContentSizeChange={() => {
                            if (streamingMessageId && isNearBottomRef.current) {
                                requestAnimationFrame(() => {
                                    listRef.current?.scrollToEnd({ animated: false });
                                });
                            }
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

                    {showScrollButton && (
                        <Animated.View
                            entering={FadeIn.duration(200).springify()}
                            exiting={FadeOut.duration(150)}
                            style={[styles.scrollFab, { bottom: overlayBottom }]}
                            pointerEvents="box-none"
                        >
                            <ScrollToBottomButton
                                onPress={handleScrollToBottom}
                                newMessagesCount={unreadCount}
                            />
                        </Animated.View>
                    )}

                    {nudgeText && (
                        <Animated.View
                            entering={FadeIn.duration(220)}
                            exiting={FadeOut.duration(180)}
                            style={[styles.nudgeFab, { bottom: bannerBottom }]}
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

                    {(isRetrying || (error && !isLoading)) && (
                        <Animated.View
                            entering={FadeIn.duration(200)}
                            exiting={FadeOut.duration(150)}
                            style={[styles.retryFab, { bottom: bannerBottom }]}
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
                </View>
            )}

            <ChatComposer
                inputRef={inputRef}
                value={inputValue}
                onChangeText={setInputValue}
                onSend={() => handleSend()}
                placeholder={tChat.inputPlaceholder}
                editPlaceholder={tChat.inputPlaceholderEdit}
                editingMessage={editingMessage}
                onCancelEdit={handleCancelEdit}
                editingLabel={tChat.editingMessage}
                isLoading={isLoading}
                messagesRemaining={messagesRemaining}
                resetTime={resetTime}
                dailyLimitOverText={tChat.dailyLimitOver}
            />
        </View>
    );

    return (
        <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
            <AppBackground />

            <HistoryPanel
                isOpen={isPanelOpen}
                onClose={() => setIsPanelOpen(false)}
                messagesRemaining={messagesRemaining}
                dailyMessageLimit={dailyMessageLimit}
                resetTime={resetTime}
                conversations={conversations}
                activeConversationId={currentConversationId}
                onSelectConversation={async (id) => {
                    await selectConversation(id);
                    setIsPanelOpen(false);
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

            <ChatHeader
                onBack={handleBackHome}
                onMenu={handleOpenPanel}
                backLabel={tChat.a11yBack}
                menuLabel={tChat.a11yMenu}
            />

            {connToast && (
                <Toast
                    message={connToast.message}
                    type={connToast.type}
                    onClose={() => setConnToast(null)}
                    duration={3000}
                />
            )}

            {Platform.OS === 'ios' ? (
                <KeyboardAvoidingView style={styles.flex1} behavior="padding">
                    {chatBody}
                </KeyboardAvoidingView>
            ) : (
                <View style={styles.flex1}>{chatBody}</View>
            )}
        </SafeAreaView>
    );
}

const WelcomeScreen = React.memo(function WelcomeScreen({
    onPickChip, greetingName, tChat, keyboardOpen,
}: {
    onPickChip: (text: string) => void;
    greetingName: string;
    keyboardOpen?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tChat: any;
}) {
    const greeting = (tChat.welcomeGreeting as string).replace('{name}', greetingName);
    return (
        <ScrollView
            style={[styles.welcomeScroll, keyboardOpen && styles.welcomeScrollCompact]}
            contentContainerStyle={[
                styles.welcomeContent,
                keyboardOpen && styles.welcomeContentCompact,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            <Animated.View entering={FadeIn.duration(400)} style={styles.welcomeHero}>
                <Text style={styles.welcomeTitle}>{greeting}</Text>
                <Text style={styles.welcomeSubtitle}>{tChat.welcomeSubtitle}</Text>
                <Text style={styles.welcomeBrand}>{tChat.welcomeBrand}</Text>
            </Animated.View>

            {!keyboardOpen && (
            <Animated.View entering={FadeIn.duration(400).delay(120)} style={styles.chipGrid}>
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
            )}
        </ScrollView>
    );
});

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: Colors.bgBase,
    },
    flex1: {
        flex: 1,
    },
    body: {
        flex: 1,
    },
    messagesPane: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(5,1,13,0.0)',
        zIndex: 50,
    },
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
    welcomeScroll: {
        flex: 1,
    },
    welcomeScrollCompact: {
        flexGrow: 0,
        flexShrink: 1,
    },
    welcomeContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 32,
        paddingBottom: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    welcomeContentCompact: {
        paddingTop: 12,
        paddingBottom: 8,
        justifyContent: 'flex-start',
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
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 4,
    },
    messagesList: { flex: 1 },
    scrollFab: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 30,
    },
    nudgeFab: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 35,
    },
    nudgeCard: {
        flexDirection: 'row',
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
        textAlign: 'left',
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
    retryFab: {
        position: 'absolute',
        left: 12,
        right: 12,
        zIndex: 38,
    },
    retryBannerInner: {
        flexDirection: 'row',
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
        textAlign: 'left',
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
