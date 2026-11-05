import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { useTranslation } from '../../src/i18n';
import { usePWLocalize } from './localize';
import { PW, usePWFonts, usePWScale } from './theme';

type ClockListener = () => void;
const listeners = new Set<ClockListener>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: ClockListener) {
  listeners.add(listener);
  if (!timer && process.env.NODE_ENV !== 'test') {
    timer = setInterval(() => {
      listeners.forEach((fn) => fn());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** One shared second-tick for every sponsor card. Only this label re-renders. */
export function DeadlineCountdown({ deadlineIso }: { deadlineIso: string }) {
  const { formatRemaining } = usePWLocalize();
  const { t } = useTranslation();
  const endedLabel = t.predictAndWin.card.ended;
  const { f } = usePWScale();
  const { semibold } = usePWFonts();
  const [label, setLabel] = useState('—');

  useEffect(() => {
    const tick = () => {
      const ms = new Date(deadlineIso).getTime() - Date.now();
      const next = ms <= 0 ? endedLabel : formatRemaining(ms);
      setLabel((prev) => (prev === next ? prev : next));
    };
    tick();
    return subscribe(tick);
  }, [deadlineIso, endedLabel, formatRemaining]);

  return (
    <Text style={{ fontFamily: semibold, fontSize: f(10), color: PW.statValue, textAlign: 'center' }} numberOfLines={1}>
      {label}
    </Text>
  );
}
