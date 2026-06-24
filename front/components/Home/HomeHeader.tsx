import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    AppState,
    type AppStateStatus,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Settings, Search, Bell, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
    LIVE_RED,
    PURPLE_SOFT,
    TEXT_PRIMARY,
    SCREEN_PADDING_H,
} from '../../constants/tokens';
import { useCoins } from '../../contexts/CoinsContext';
import { NotificationService } from '../../src/services/authService';
import { CoinsInfoModal } from '../common/CoinsInfoModal';
import { useTranslation } from '../../src/i18n';

const ICON_SIZE = 18;
const CLUSTER_PAD = 4;

interface HomeHeaderProps {
    userName?: string;
    onSettingsPress?: () => void;
    onSearchPress?: () => void;
    onNotificationPress?: () => void;
    /** Show a small red dot on the bell when the device is offline. */
    isOffline?: boolean;
}

export const HomeHeader = React.memo(function HomeHeader({
    userName = '',
    onSettingsPress,
    onSearchPress,
    onNotificationPress,
    isOffline = false,
}: HomeHeaderProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { getToken } = useAuth();
    const { coins } = useCoins();

    const [backendUnreadCount, setBackendUnreadCount] = useState<number>(0);
    const appState = useRef<AppStateStatus>(AppState.currentState);
    const lastFetchTime = useRef<number>(0);

    const notificationCount = backendUnreadCount;

    const fetchUnreadCount = useCallback(async (): Promise<void> => {
        const now = Date.now();
        if (now - lastFetchTime.current < 60_000) return;
        lastFetchTime.current = now;
        try {
            const token = await getToken();
            if (!token) return;
            const count = await NotificationService.getUnreadCount(token);
            setBackendUnreadCount(count);
        } catch {
            // silent — badge stays on last known value
        }
    }, [getToken]);

    useEffect(() => {
        void fetchUnreadCount();
        const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
            if (appState.current.match(/inactive|background/) && next === 'active') {
                void fetchUnreadCount();
            }
            appState.current = next;
        });
        const interval = setInterval(() => {
            void fetchUnreadCount();
        }, 60_000);
        return () => {
            subscription.remove();
            clearInterval(interval);
        };
    }, [fetchUnreadCount]);

    const handleSettings = useCallback((): void => {
        void Haptics.selectionAsync();
        if (onSettingsPress) onSettingsPress();
        else router.push('/(tabs)/settings');
    }, [onSettingsPress, router]);

    const handleSearch = useCallback((): void => {
        void Haptics.selectionAsync();
        onSearchPress?.();
    }, [onSearchPress]);

    const handleNotifications = useCallback((): void => {
        void Haptics.selectionAsync();
        if (onNotificationPress) onNotificationPress();
        else router.push('/notifications');
    }, [onNotificationPress, router]);

    const [showCoinsInfo, setShowCoinsInfo] = React.useState(false);
    const handleCoinsPress = useCallback((): void => {
        void Haptics.selectionAsync();
        setShowCoinsInfo(true);
    }, []);

    // LiquidGlassView / BlurView have very different prop surfaces — we
    // branch at the JSX level instead of casting a shared wrapper.
    const containerStyle = [styles.container, { paddingTop: insets.top }];

    const content = (
        <>
            <View style={styles.inner}>
                <View style={styles.titleBlock}>
                    <Text style={styles.brand}>90PLUS</Text>
                    {userName ? (
                        <Text style={styles.greeting} numberOfLines={1}>
                            {t.home.greetingHi.replace('{name}', userName)}
                        </Text>
                    ) : null}
                </View>

                <View style={styles.trailing}>
                    <TouchableOpacity
                        activeOpacity={0.72}
                        onPress={handleCoinsPress}
                        onLongPress={() => router.push('/(tabs)/profile')}
                        style={styles.coins}
                        accessibilityRole="button"
                    >
                        <Zap size={14} color="#A855F7" fill="#A855F7" strokeWidth={2.5} />
                        <Text style={styles.coinsVal}>{coins.toLocaleString()}</Text>
                    </TouchableOpacity>

                    <CoinsInfoModal
                        visible={showCoinsInfo}
                        onClose={() => setShowCoinsInfo(false)}
                        onPrimaryAction={() => {
                            setShowCoinsInfo(false);
                            router.push('/(tabs)/profile');
                        }}
                    />

                    <View style={styles.toolbar}>
                        <TouchableOpacity
                            activeOpacity={0.72}
                            hitSlop={8}
                            style={styles.toolBtn}
                            onPress={handleSettings}
                            accessibilityRole="button"
                            accessibilityLabel={t.home.headerSettings}
                        >
                            <Settings color={TEXT_PRIMARY} size={ICON_SIZE} strokeWidth={2} />
                        </TouchableOpacity>
                        <View style={styles.sep} />
                        <TouchableOpacity
                            activeOpacity={0.72}
                            hitSlop={8}
                            style={styles.toolBtn}
                            onPress={handleSearch}
                            accessibilityRole="button"
                            accessibilityLabel={t.home.headerSearch}
                        >
                            <Search color={TEXT_PRIMARY} size={ICON_SIZE} strokeWidth={2} />
                        </TouchableOpacity>
                        <View style={styles.sep} />
                        <View>
                            <TouchableOpacity
                                activeOpacity={0.72}
                                hitSlop={8}
                                style={styles.toolBtn}
                                onPress={handleNotifications}
                                accessibilityRole="button"
                                accessibilityLabel={t.home.headerNotifications}
                            >
                                <Bell color={TEXT_PRIMARY} size={ICON_SIZE} strokeWidth={2} />
                            </TouchableOpacity>
                            {notificationCount > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeTxt}>
                                        {notificationCount > 99 ? '99+' : String(notificationCount)}
                                    </Text>
                                </View>
                            )}
                            {isOffline && notificationCount === 0 && (
                                <View style={styles.offlineDot} accessibilityLabel={t.home.headerOffline} />
                            )}
                        </View>
                    </View>
                </View>
            </View>
            <View style={styles.hairline} />
        </>
    );

    const shell = (
        <>
            <LinearGradient
                colors={['#030008', '#05010F', 'rgba(5,1,15,0.98)']}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
            />
            {isLiquidGlassSupported ? (
                <LiquidGlassView
                    effect="regular"
                    tint="rgba(5,1,13,0.92)"
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                />
            ) : (
                <BlurView
                    intensity={48}
                    tint="dark"
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                />
            )}
            {content}
        </>
    );

    return (
        <View style={containerStyle} pointerEvents="box-none">
            {shell}
        </View>
    );
});

export const HOME_HEADER_BODY_HEIGHT = 56;

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        elevation: 12,
        overflow: 'hidden',
        backgroundColor: '#05010F',
    },
    inner: {
        minHeight: HOME_HEADER_BODY_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SCREEN_PADDING_H,
        gap: 10,
        paddingVertical: 6,
    },
    titleBlock: { flex: 1, minWidth: 0 },
    brand: {
        fontSize: 10,
        fontWeight: '800',
        color: PURPLE_SOFT,
        letterSpacing: 0.8,
        marginBottom: 2,
    },
    greeting: {
        fontSize: 17,
        fontWeight: '700',
        color: TEXT_PRIMARY,
        letterSpacing: -0.3,
        textAlign: 'left',
    },
    trailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    coins: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        minWidth: 54,
    },
    coinsVal: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.055)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.09)',
        paddingHorizontal: CLUSTER_PAD,
        paddingVertical: CLUSTER_PAD / 2,
    },
    toolBtn: { width: 36, height: 34, alignItems: 'center', justifyContent: 'center' },
    sep: {
        width: StyleSheet.hairlineWidth,
        height: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginHorizontal: 1,
    },
    badge: {
        position: 'absolute',
        top: 4,
        right: 6,
        minWidth: 15,
        height: 15,
        borderRadius: 8,
        paddingHorizontal: 3,
        backgroundColor: LIVE_RED,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.45)',
    },
    badgeTxt: { fontSize: 9, fontWeight: '800', color: '#fff' },
    offlineDot: {
        position: 'absolute',
        top: 5,
        right: 7,
        width: 9,
        height: 9,
        borderRadius: 5,
        backgroundColor: LIVE_RED,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.55)',
    },
    hairline: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: SCREEN_PADDING_H,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
});
