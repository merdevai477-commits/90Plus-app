import { useFocusEffect } from 'expo-router';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface TabBarContextValue {
  isTabBarHidden: boolean;
  setTabBarHidden: (hidden: boolean) => void;
}

const TabBarContext = createContext<TabBarContextValue>({
  isTabBarHidden: false,
  setTabBarHidden: () => {},
});

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const [isTabBarHidden, setHidden] = useState(false);

  const setTabBarHidden = useCallback((hidden: boolean) => {
    setHidden(hidden);
  }, []);

  const value = useMemo(
    () => ({ isTabBarHidden, setTabBarHidden }),
    [isTabBarHidden, setTabBarHidden],
  );

  return <TabBarContext.Provider value={value}>{children}</TabBarContext.Provider>;
}

export function useTabBarContext() {
  return useContext(TabBarContext);
}

/** Hide native tab bar while a screen is focused (e.g. quiz full-screen). */
export function useHideTabBarOnFocus() {
  const { setTabBarHidden } = useTabBarContext();

  useFocusEffect(
    useCallback(() => {
      setTabBarHidden(true);
      return () => setTabBarHidden(false);
    }, [setTabBarHidden]),
  );
}
