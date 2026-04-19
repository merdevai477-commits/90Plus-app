import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import * as Haptics from 'expo-haptics';

interface StatsRowProps {
    followers: string;
    following: string;
    videos: string;
    onFollowersPress?: () => void;
    onFollowingPress?: () => void;
    onVideosPress?: () => void;
}

const StatsRow = memo(function StatsRow({ 
    followers, 
    following, 
    videos,
    onFollowersPress,
    onFollowingPress,
    onVideosPress,
}: StatsRowProps) {
    const { t } = useTranslation();
    
    return (
        <View style={styles.container}>
            <StatCard 
                label={t.profile.followers} 
                value={followers} 
                onPress={onFollowersPress}
            />
            <StatCard 
                label={t.profile.following} 
                value={following} 
                onPress={onFollowingPress}
            />
            <StatCard 
                label={t.profile.videos} 
                value={videos} 
                onPress={onVideosPress}
            />
        </View>
    );
});

export default StatsRow;

function StatCard({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
    const handlePress = () => {
        if (onPress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
        }
    };

    const content = (
        <LinearGradient
            colors={[ProfileTheme.colors.glassWhite, 'transparent']}
            style={styles.statCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </LinearGradient>
    );

    if (onPress) {
        return (
            <TouchableOpacity style={styles.touchable} onPress={handlePress} activeOpacity={0.7}>
                {content}
            </TouchableOpacity>
        );
    }

    return <View style={styles.touchable}>{content}</View>;
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 30,
        gap: 12,
    },
    touchable: {
        flex: 1,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    statValue: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
        textShadowColor: ProfileTheme.colors.neonBlue,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
    statLabel: {
        color: ProfileTheme.colors.textSecondary,
        fontSize: 12,
        fontWeight: '500',
    },
});
