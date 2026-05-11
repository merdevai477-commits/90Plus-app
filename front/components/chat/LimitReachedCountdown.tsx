/**
 * LimitReachedCountdown.tsx — Native
 * Renders the HH:MM:SS countdown string only (no wrapper).
 * Used inline inside the input bar limit state.
 */

import React, { useState, useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors, FontSize } from '../../../constants/theme';

interface LimitReachedCountdownProps {
  resetTime: Date;
  style?: object;
}

function formatCountdown(resetTime: Date): string {
  const now = new Date();
  const diff = resetTime.getTime() - now.getTime();

  if (diff <= 0) return '00:00:00';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return [hours, minutes, seconds]
    .map(n => n.toString().padStart(2, '0'))
    .join(':');
}

export function LimitReachedCountdown({ resetTime, style }: LimitReachedCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(() => formatCountdown(resetTime));

  useEffect(() => {
    setTimeLeft(formatCountdown(resetTime));
    const interval = setInterval(() => {
      setTimeLeft(formatCountdown(resetTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [resetTime]);

  return (
    <Text style={[styles.countdown, style]}>
      {timeLeft}
    </Text>
  );
}

const styles = StyleSheet.create({
  countdown: {
    fontSize: FontSize['5xl'],
    fontWeight: '300',
    color: Colors.white50,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
});
