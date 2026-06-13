import { Animated } from 'react-native';

/**
 * One opacity pulse shared by every live match row on the matches screen.
 * Avoids N separate Animated.loop instances when many fixtures are live.
 */
const pulse = new Animated.Value(1);
let subscriberCount = 0;
let loop: Animated.CompositeAnimation | null = null;

function startLoop() {
  if (loop) return;
  loop = Animated.loop(
    Animated.sequence([
      Animated.timing(pulse, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
    ]),
  );
  loop.start();
}

function stopLoop() {
  loop?.stop();
  loop = null;
  pulse.setValue(1);
}

/** Call when a live MatchRow mounts. */
export function subscribeSharedLivePulse(): void {
  subscriberCount += 1;
  if (subscriberCount === 1) startLoop();
}

/** Call when a live MatchRow unmounts or is no longer live. */
export function unsubscribeSharedLivePulse(): void {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount === 0) stopLoop();
}

export function getSharedLivePulse(): Animated.Value {
  return pulse;
}
