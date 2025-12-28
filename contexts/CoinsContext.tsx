import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CoinsService } from '../services/coins.service';

const INITIAL_COINS = 50;

interface CoinsContextType {
  coins: number;
  addCoins: (amount: number) => Promise<void>;
  subtractCoins: (amount: number) => Promise<boolean>;
  resetCoins: () => Promise<void>;
  loading: boolean;
}

const CoinsContext = createContext<CoinsContextType | undefined>(undefined);

export const CoinsProvider = ({ children }: { children: ReactNode }) => {
  const [coins, setCoins] = useState<number>(INITIAL_COINS);
  const [loading, setLoading] = useState(true);

  // تحميل الكوينات عند بدء التطبيق
  useEffect(() => {
    loadCoins();
  }, []);

  const loadCoins = async () => {
    try {
      const balance = await CoinsService.getBalance();
      setCoins(balance);
    } catch (error) {
      console.error('Error loading coins:', error);
      setCoins(INITIAL_COINS);
    } finally {
      setLoading(false);
    }
  };

  const addCoins = async (amount: number) => {
    try {
      const newCoins = coins + amount;
      setCoins(newCoins);
      await CoinsService.updateBalance(newCoins);
    } catch (error) {
      console.error('Error adding coins:', error);
      // Revert state on error if needed, or re-fetch
      loadCoins();
    }
  };

  const subtractCoins = async (amount: number): Promise<boolean> => {
    if (coins < amount) {
      return false; // مش كفاية كوينات
    }

    try {
      const newCoins = coins - amount;
      setCoins(newCoins);
      await CoinsService.updateBalance(newCoins);
      return true;
    } catch (error) {
      console.error('Error subtracting coins:', error);
      loadCoins();
      return false;
    }
  };

  const resetCoins = async () => {
    try {
      const initialBalance = await CoinsService.resetBalance();
      setCoins(initialBalance);
    } catch (error) {
      console.error('Error resetting coins:', error);
    }
  };

  return (
    <CoinsContext.Provider value={{ coins, addCoins, subtractCoins, resetCoins, loading }}>
      {children}
    </CoinsContext.Provider>
  );
};

export const useCoins = () => {
  const context = useContext(CoinsContext);
  if (context === undefined) {
    throw new Error('useCoins must be used within a CoinsProvider');
  }
  return context;
};
