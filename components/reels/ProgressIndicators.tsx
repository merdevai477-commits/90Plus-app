import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from './constants';

interface ProgressIndicatorsProps {
    totalReels: number;
    currentIndex: number;
}

export const ProgressIndicators: React.FC<ProgressIndicatorsProps> = ({
    totalReels,
    currentIndex,
}) => {
    if (totalReels <= 1) return null;

    return (
        <View style={styles.container}>
            {Array.from({ length: Math.min(totalReels, 10) }).map((_, index) => (
                <View key={index} style={styles.indicatorWrapper}>
                    {index === currentIndex ? (
                        <LinearGradient
                            colors={[COLORS.goldenTrophy, COLORS.electricGreen]}
                            style={styles.activeIndicator}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        />
                    ) : (
                        <View
                            style={[
                                styles.indicator,
                                index < currentIndex && styles.completedIndicator,
                            ]}
                        />
                    )}
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 30,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        zIndex: 99,
    },
    indicatorWrapper: {
        flex: 1,
        maxWidth: 40,
        height: 3,
        borderRadius: 2,
        overflow: 'hidden',
    },
    indicator: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
    },
    activeIndicator: {
        flex: 1,
        borderRadius: 2,
        shadowColor: COLORS.goldenTrophy,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
        elevation: 5,
    },
    completedIndicator: {
        backgroundColor: 'rgba(255, 215, 0, 0.4)',
    },
});
