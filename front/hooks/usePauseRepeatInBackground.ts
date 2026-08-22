import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { cancelAnimation, type SharedValue } from 'react-native-reanimated';

/** Stop infinite Reanimated loops while the app is backgrounded. */
export function usePauseRepeatInBackground(
  value: SharedValue<number>,
  start: () => void,
): void {
  useEffect(() => {
    const apply = (state: AppStateStatus) => {
      if (state === 'active') start();
      else cancelAnimation(value);
    };
    apply(AppState.currentState);
    const sub = AppState.addEventListener('change', apply);
    return () => {
      sub.remove();
      cancelAnimation(value);
    };
  }, [value, start]);
}
