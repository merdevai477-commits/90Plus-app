import { InteractionManager } from 'react-native';

/** Defer modal dismiss so RN Modal unmount does not collide with parent setState. */
export function runSafeModalClose(onClose: () => void): void {
  InteractionManager.runAfterInteractions(() => {
    requestAnimationFrame(() => {
      onClose();
    });
  });
}
