import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { COLORS } from '../components/reels/constants';
import { useHomeStore, Notification } from '../src/store/home.store';
import { Bell, Info, CheckCircle, AlertTriangle } from 'lucide-react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../contexts/LanguageContext';

const NotificationItem: React.FC<{ notification: Notification; index: number }> = ({ notification, index }) => {
    const getIcon = () => {
        // Match event specific icons
        if (notification.eventType === 'goal') {
            return <Text style={styles.eventEmoji}>⚽</Text>;
        }
        if (notification.eventType === 'red_card') {
            return <Text style={styles.eventEmoji}>🟥</Text>;
        }
        if (notification.eventType === 'yellow_card') {
            return <Text style={styles.eventEmoji}>🟨</Text>;
        }
        if (notification.eventType === 'penalty') {
            return <Text style={styles.eventEmoji}>🎯</Text>;
        }

        // Default icons by type
        switch (notification.type) {
            case 'success': return <CheckCircle color={COLORS.neonGreen} size={24} />;
            case 'warning': return <AlertTriangle color="#FFD700" size={24} />;
            case 'error': return <AlertTriangle color={COLORS.neonRed} size={24} />;
            default: return <Info color={COLORS.neonBlue} size={24} />;
        }
    };

    const getBackgroundColor = () => {
        if (notification.eventType === 'goal') {
            return !notification.read ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.05)';
        }
        if (notification.eventType === 'red_card') {
            return !notification.read ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)';
        }
        if (notification.eventType === 'yellow_card') {
            return !notification.read ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255,255,255,0.05)';
        }
        return !notification.read ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)';
    };

    return (
        <Animated.View entering={FadeInRight.delay(index * 100).duration(500)}>
            <TouchableOpacity 
                style={[
                    styles.itemContainer, 
                    { backgroundColor: getBackgroundColor() }
                ]}
            >
                <View style={styles.iconContainer}>
                    {getIcon()}
                </View>
                <View style={styles.contentContainer}>
                    <Text style={styles.itemTitle}>{notification.title}</Text>
                    <Text style={styles.itemMessage}>{notification.message}</Text>
                    <Text style={styles.itemTime}>{notification.time}</Text>
                </View>
                {!notification.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function NotificationsScreen() {
    const { notifications, clearNotifications } = useHomeStore();
    const { t, isRTL } = useLanguage();

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                headerShown: true,
                title: t.common.notifications || 'الإشعارات',
                headerStyle: { backgroundColor: COLORS.deepBlack },
                headerTintColor: COLORS.white,
                headerTitleStyle: { fontWeight: 'bold' },
                headerRight: notifications.length > 0 ? () => (
                    <TouchableOpacity onPress={clearNotifications} style={styles.clearButton}>
                        <Text style={styles.clearButtonText}>
                            {isRTL ? 'مسح الكل' : 'Clear All'}
                        </Text>
                    </TouchableOpacity>
                ) : undefined,
            }} />

            <LinearGradient
                colors={[COLORS.deepBlack, '#1a1a1a']}
                style={styles.background}
            />

            <FlatList
                data={notifications}
                renderItem={({ item, index }) => <NotificationItem notification={item} index={index} />}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Bell size={48} color="rgba(255,255,255,0.3)" />
                        <Text style={styles.emptyText}>
                            {isRTL ? 'لا توجد إشعارات بعد' : 'No notifications yet'}
                        </Text>
                        <Text style={styles.emptySubtext}>
                            {isRTL
                                ? 'قم بتفضيل مباراة لتلقي الإشعارات الحية'
                                : 'Favorite a match to receive live notifications'}
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.deepBlack,
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    listContent: {
        padding: 16,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    iconContainer: {
        marginRight: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 4,
    },
    itemMessage: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 4,
    },
    itemTime: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.neonGreen,
        marginLeft: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyText: {
        marginTop: 16,
        color: 'rgba(255,255,255,0.7)',
        fontSize: 18,
        fontWeight: '600',
    },
    emptySubtext: {
        marginTop: 8,
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    clearButton: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    clearButtonText: {
        color: COLORS.neonRed,
        fontSize: 14,
        fontWeight: '600',
    },
    eventEmoji: {
        fontSize: 28,
        textAlign: 'center',
    },
});
