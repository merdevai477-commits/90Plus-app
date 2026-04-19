import { useCallback } from 'react';
import { Vibration } from 'react-native';

export const useHaptics = () => {
  const hapticFeedback = useCallback(() => {
    Vibration.vibrate(10);
  }, []);

  return { hapticFeedback };
};