import React from 'react';
import { View, Text, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from './homeStyles';
import { COLORS, GRADIENTS } from '../reels/constants';
import { useLanguage } from '../../contexts/LanguageContext';
import { Flame, Star } from 'lucide-react-native';

interface GamificationBarProps {
    streak?: number;
    levelProgress?: number; // 0 to 1
    nextLevel?: number;
}

export const GamificationBar: React.FC<GamificationBarProps> = ({
    streak = 5,
    levelProgress = 0.7,
    nextLevel = 2,
}) => {
    const { t } = useLanguage();

    return (
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <LinearGradient
                colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                style={{
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.05)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                {/* Streak Section */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: 'rgba(255, 95, 31, 0.2)',
                        justifyContent: 'center', alignItems: 'center'
                    }}>
                        <Flame size={18} color="#FF5F1F" fill="#FF5F1F" />
                    </View>
                    <View>
                        <Text style={{ color: COLORS.white, fontWeight: 'bold', fontSize: 14 }}>
                            {streak} {t.home?.days || 'Days'}
                        </Text>
                        <Text style={{ color: COLORS.textTertiary, fontSize: 10 }}>
                            {t.home?.streak || 'Daily Streak'}
                        </Text>
                    </View>
                </View>

                {/* Level Progress Section */}
                <View style={{ flex: 1, marginLeft: 24 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 10 }}>
                            {t.home?.nextLevel || 'Next Level'} {nextLevel}
                        </Text>
                        <Text style={{ color: COLORS.neonGreen, fontSize: 10, fontWeight: 'bold' }}>
                            {Math.round(levelProgress * 100)}%
                        </Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                        <LinearGradient
                            colors={GRADIENTS.greenGlow}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ width: `${levelProgress * 100}%`, height: '100%' }}
                        />
                    </View>
                </View>

            </LinearGradient>
        </View>
    );
};
