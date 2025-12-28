import AsyncStorage from '@react-native-async-storage/async-storage';

const COINS_STORAGE_KEY = '@user_coins';
const INITIAL_COINS = 50;

export const CoinsService = {
    /**
     * Get current coin balance
     * Future: This will fetch from backend API
     */
    getBalance: async (): Promise<number> => {
        try {
            const storedCoins = await AsyncStorage.getItem(COINS_STORAGE_KEY);
            if (storedCoins !== null) {
                return parseInt(storedCoins, 10);
            } else {
                // Initialize for new user
                await AsyncStorage.setItem(COINS_STORAGE_KEY, INITIAL_COINS.toString());
                return INITIAL_COINS;
            }
        } catch (error) {
            console.error('Error getting coin balance:', error);
            return INITIAL_COINS;
        }
    },

    /**
     * Update coin balance
     * Future: This will send update to backend API
     */
    updateBalance: async (newBalance: number): Promise<void> => {
        try {
            await AsyncStorage.setItem(COINS_STORAGE_KEY, newBalance.toString());
            // Here we would also sync with backend
            // await api.post('/user/coins', { balance: newBalance });
        } catch (error) {
            console.error('Error updating coin balance:', error);
            throw error;
        }
    },

    /**
     * Reset balance (dev/debug only)
     */
    resetBalance: async (): Promise<number> => {
        try {
            await AsyncStorage.setItem(COINS_STORAGE_KEY, INITIAL_COINS.toString());
            return INITIAL_COINS;
        } catch (error) {
            console.error('Error resetting coin balance:', error);
            throw error;
        }
    }
};
