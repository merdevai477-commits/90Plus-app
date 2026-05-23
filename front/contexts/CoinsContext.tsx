import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { CoinsService } from '../services/coins.service';
import { useAuth, useUser } from '@clerk/clerk-expo';

const INITIAL_COINS = 50;

interface CoinsContextType {
  coins: number;
  addCoins: (amount: number) => Promise<void>;
  subtractCoins: (amount: number) => Promise<boolean>;
  applyCoinsBalance: (balance: number) => void;
  resetCoins: () => Promise<void>;
  refreshCoins: () => Promise<void>;
  loading: boolean;
}

const CoinsContext = createContext<CoinsContextType | undefined>(undefined);

export const CoinsProvider = ({ children }: { children: ReactNode }) => {
  const [coins, setCoins] = useState<number>(INITIAL_COINS);
  const [loading, setLoading] = useState(true);
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  // Clerk's `getToken` returns a NEW function reference on every render. Don't
  // put it in effect dependency arrays directly — read it from a ref instead.
  const getTokenRef = React.useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  // تحميل الكوينات عند تغيير المستخدم
  useEffect(() => {
    if (isSignedIn && user?.id) {
      // Set the current user and token in CoinsService
      const setupCoins = async () => {
        const token = await getTokenRef.current();
        CoinsService.setCurrentUser(user.id, token);
        CoinsService.setToken(token);
        await loadCoins();
      };
      setupCoins();
    } else {
      // Clear user and reset to initial coins
      CoinsService.clearCurrentUser();
      setCoins(INITIAL_COINS);
      setLoading(false);
    }
  }, [isSignedIn, user?.id]);

  const loadCoins = useCallback(async () => {
    try {
      setLoading(true);
      // Update token before loading
      const token = await getTokenRef.current();
      if (token) {
        CoinsService.setToken(token);
      }
      const balance = await CoinsService.getBalance();
      setCoins(balance);
    } catch (error) {
      console.error('Error loading coins:', error);
      setCoins(INITIAL_COINS);
    } finally {
      setLoading(false);
    }
  }, []);

  const addCoins = async (amount: number) => {
    try {
      // Update token before operation
      const token = await getToken();
      if (token) {
        CoinsService.setToken(token);
      }
      const newCoins = coins + amount;
      // ✅ PERFORMANCE: Update UI immediately (optimistic)
      setCoins(newCoins);
      // Update backend in background (non-blocking)
      CoinsService.updateBalance(newCoins).catch(() => {
        // On error, reload to sync
        loadCoins();
      });
    } catch (error) {
      // Revert state on error
      loadCoins();
    }
  };

  const subtractCoins = async (amount: number): Promise<boolean> => {
    if (coins < amount) {
      return false;
    }

    const newCoins = coins - amount;
    setCoins(newCoins);

    try {
      const token = await getToken();
      if (token) {
        CoinsService.setToken(token);
      }
      CoinsService.updateBalance(newCoins).catch(() => {
        loadCoins();
      });
      return true;
    } catch {
      loadCoins();
      return false;
    }
  };

  const applyCoinsBalance = useCallback((balance: number) => {
    setCoins(balance);
  }, []);

  const resetCoins = async () => {
    try {
      const initialBalance = await CoinsService.resetBalance();
      setCoins(initialBalance);
    } catch (error) {
      console.error('Error resetting coins:', error);
    }
  };

  return (
    <CoinsContext.Provider value={{ coins, addCoins, subtractCoins, applyCoinsBalance, resetCoins, refreshCoins: loadCoins, loading }}>
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
