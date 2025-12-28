import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface LevelCardProps {
    level: number;
    currentXP: number;
    maxXP: number;
    coins: number;
}

export default function LevelCard({ level, currentXP, maxXP, coins }: LevelCardProps) {
    const progress = (currentXP / maxXP) * 100;

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a1a1a', '#111']}
                style={styles.card}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.header}>
                    <View style={styles.levelContainer}>
                        <Text style={styles.levelLabel}>المستوى</Text>
                        <Text style={styles.levelValue}>{level}</Text>
                    </View>

                    <View style={styles.coinsContainer}>
                        <Text style={styles.coinsValue}>{(coins / 1000).toFixed(1)}K</Text>
                        <View style={styles.coinIcon}>
                            <Ionicons name="logo-bitcoin" size={16} color="#FFD700" />
                        </View>
                    </View>
                </View>

                <Text style={styles.xpText}>{currentXP} / {maxXP} XP</Text>

                <View style={styles.progressBarBackground}>
                    <LinearGradient
                        colors={['#22c55e', '#16a34a']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressBarFill, { width: `${progress}%` }]}
                    />
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    card: {
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    levelContainer: {
        flexDirection: 'row-reverse', // Arabic layout support
        alignItems: 'center',
        gap: 8,
    },
    levelLabel: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    levelValue: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    coinsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    coinsValue: {
        color: '#FFD700',
        fontSize: 18,
        fontWeight: 'bold',
    },
    coinIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 215, 0, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    xpText: {
        color: '#888',
        fontSize: 14,
        marginBottom: 12,
        textAlign: 'left', // Or right for Arabic
    },
    progressBarBackground: {
        height: 8,
        backgroundColor: '#333',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
});
