/**
 * useCooldownTimer
 *
 * UX Fix 3: Provides a live countdown for upload cooldowns.
 * Returns formatted remaining time string that updates every second.
 */

import { useState, useEffect, useRef } from 'react';

export interface CooldownInfo {
  canChange: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  nextAllowedDate?: string;
}

export interface CooldownTimerResult {
  /** Human-readable remaining time, e.g. "2 أيام و 3 ساعات" */
  remainingText: string;
  /** True when the cooldown has expired (timer hit zero) */
  expired: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
}

export function useCooldownTimer(cooldown: CooldownInfo | null | undefined): CooldownTimerResult {
  const getRemaining = () => {
    if (!cooldown || cooldown.canChange) {
      return { days: 0, hours: 0, minutes: 0, expired: true };
    }
    if (cooldown.nextAllowedDate) {
      const ms = new Date(cooldown.nextAllowedDate).getTime() - Date.now();
      if (ms <= 0) return { days: 0, hours: 0, minutes: 0, expired: true };
      const totalMinutes = Math.ceil(ms / 60000);
      const days = Math.floor(totalMinutes / (60 * 24));
      const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
      const minutes = totalMinutes % 60;
      return { days, hours, minutes, expired: false };
    }
    // Fallback to static values from cooldown object
    return {
      days: cooldown.daysRemaining,
      hours: cooldown.hoursRemaining % 24,
      minutes: 0,
      expired: false,
    };
  };

  const [state, setState] = useState(getRemaining);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState(getRemaining());

    if (!cooldown || cooldown.canChange) return;

    intervalRef.current = setInterval(() => {
      const next = getRemaining();
      setState(next);
      if (next.expired && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 60_000); // update every minute

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cooldown?.canChange, cooldown?.nextAllowedDate, cooldown?.daysRemaining, cooldown?.hoursRemaining]);

  const buildText = () => {
    if (state.expired) return '';
    const parts: string[] = [];
    if (state.days > 0) parts.push(`${state.days} ${state.days === 1 ? 'يوم' : 'أيام'}`);
    if (state.hours > 0) parts.push(`${state.hours} ساعة`);
    if (state.minutes > 0 && state.days === 0) parts.push(`${state.minutes} دقيقة`);
    return parts.join(' و ');
  };

  return {
    remainingText: buildText(),
    expired: state.expired,
    daysRemaining: state.days,
    hoursRemaining: state.hours,
    minutesRemaining: state.minutes,
  };
}
