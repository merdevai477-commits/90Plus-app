import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type BootReadyContextValue = {
  navigationReady: boolean;
  markNavigationReady: () => void;
};

const BootReadyContext = createContext<BootReadyContextValue>({
  navigationReady: false,
  markNavigationReady: () => {},
});

export function BootReadyProvider({ children }: { children: React.ReactNode }) {
  const [navigationReady, setNavigationReady] = useState(false);
  const markNavigationReady = useCallback(() => {
    setNavigationReady(true);
  }, []);

  const value = useMemo(
    () => ({ navigationReady, markNavigationReady }),
    [navigationReady, markNavigationReady],
  );

  return (
    <BootReadyContext.Provider value={value}>{children}</BootReadyContext.Provider>
  );
}

export function useBootReady() {
  return useContext(BootReadyContext);
}
