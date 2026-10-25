import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** Current software-keyboard height (0 when hidden). */
export function useKeyboardHeight(enabled = true): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates.height));
    const b = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => {
      a.remove();
      b.remove();
    };
  }, [enabled]);
  return height;
}
