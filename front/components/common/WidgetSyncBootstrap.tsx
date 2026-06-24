import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { scheduleMatchesWidgetSync, syncMatchesWidget, primeIosWidgetFromCache } from '../../src/widgets/syncMatchesWidget';

/** Keeps home-screen widgets in sync when the app is opened or returns to foreground. */
export function WidgetSyncBootstrap() {
  const initialSyncDone = useRef(false);

  useEffect(() => {
    if (!initialSyncDone.current) {
      initialSyncDone.current = true;
      void primeIosWidgetFromCache();
      scheduleMatchesWidgetSync(2500);
    }

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        scheduleMatchesWidgetSync(800);
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  return null;
}

export { syncMatchesWidget, scheduleMatchesWidgetSync };
