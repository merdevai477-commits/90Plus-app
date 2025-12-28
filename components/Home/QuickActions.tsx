import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from './homeStyles';
import { COLORS, GRADIENTS } from '../reels/constants';
import { useLanguage } from '../../contexts/LanguageContext';
import { Brain, Trophy, PlayCircle, BarChart2, ArrowUpRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface QuickActionItem {
    id: string;
    title: string;
    icon: any;
    route: string;
    gradient: readonly [string, string];
}

export const QuickActions: React.FC = () => {
    const { t } = useLanguage();
    const router = useRouter();

    const actions: QuickActionItem[] = [
        {
            id: 'predict',
            title: t.home?.predict || 'Predict',
            icon: Brain,
            route: '/(tabs)/leagues',
            gradient: ['rgba(50, 205, 50, 0.2)', 'rgba(50, 205, 50, 0.05)'],
        },
        {
            id: 'quiz',
            title: t.home?.quiz || 'Daily Quiz',
            icon: Trophy,
            route: '/(tabs)/quiz',
            gradient: ['rgba(255, 215, 0, 0.2)', 'rgba(255, 215, 0, 0.05)'],
        },
        {
            id: 'reels',
            title: t.home?.reels || 'Reels',
            icon: PlayCircle,
            route: '/(tabs)/reels',
            gradient: ['rgba(255, 59, 48, 0.2)', 'rgba(255, 59, 48, 0.05)'],
        },
        {
            id: 'rank',
            title: t.home?.rank || 'Leaderboard',
            icon: BarChart2,
            route: '/(tabs)/rank',
            gradient: ['rgba(0, 217, 255, 0.2)', 'rgba(0, 217, 255, 0.05)'],
        },
    ];

    return (
        <View style={styles.actionsGrid}>
            {actions.map((action) => (
                <TouchableOpacity
                    key={action.id}
                    style={styles.actionCard}
                    activeOpacity={0.8}
                    onPress={() => router.push(action.route as any)}
                >
                    <LinearGradient
                        colors={action.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.actionGradient}
                    >
                        <View style={styles.actionIconBox}>
                            <action.icon size={20} color={COLORS.white} />
                        </View>

                        <ArrowUpRight size={16} color={COLORS.white} style={styles.actionArrow} />

                        <Text style={styles.actionTitle}>{action.title}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            ))}
        </View>
    );
};
