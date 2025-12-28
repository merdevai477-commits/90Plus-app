import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';

interface StatsRowProps {
    followers: string;
    following: string;
    videos: string;
}

export default function StatsRow({ followers, following, videos }: StatsRowProps) {
    return (
        <View style={styles.container}>
            <StatCard label="متابع" value={followers} />
            <StatCard label="يتابع" value={following} />
            <StatCard label="فيديو" value={videos} />
        </View>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
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
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 30,
        gap: 12,
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
