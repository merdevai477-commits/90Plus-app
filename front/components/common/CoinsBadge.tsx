import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Zap } from 'lucide-react-native';
import { useCoins } from '../../contexts/CoinsContext';

export const CoinsBadge: React.FC = () => {
    const { coins } = useCoins();

    return (
        <View style={styles.coinsBadge}>
            <Zap size={14} color="#FFD700" fill="#FFD700" />
            <Text style={styles.coinsText}>{coins}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    coinsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    coinsText: {
        color: '#FFD700',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
