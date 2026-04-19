/**
 * Bounded parental-consent polling — avoids endless 30s requests while the screen is open.
 * Stops when: consent granted, expiry passed, or max HTTP checks. Clears timer on background.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { fetchParentalConsentStatus } from './useAgeVerification';

export interface UseParentalConsentPollOptions {
  getToken: () => Promise<string | null>;
  expiresAt?: string | null;
  fastIntervalMs?: number;
  maxFastPolls?: number;
  slowIntervalMs?: number;
  maxTotalChecks?: number;
  onConsentGranted?: () => void;
}

export type ConsentPollStopReason = 'none' | 'granted' | 'expired' | 'cap';

export interface UseParentalConsentPollResult {
  pollCount: number;
  autoPollingActive: boolean;
  lastError: string | null;
  stopReason: ConsentPollStopReason;
  checkNow: () => Promise<void>;
}

export function useParentalConsentPoll(
  options: UseParentalConsentPollOptions
): UseParentalConsentPollResult {
  const {
    getToken,
    expiresAt,
    fastIntervalMs = 30_000,
    maxFastPolls = 12,
    slowIntervalMs = 120_000,
    maxTotalChecks = 40,
    onConsentGranted,
  } = options;

  const [pollCount, setPollCount] = useState(0);
  const [autoPollingActive, setAutoPollingActive] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [stopReason, setStopReason] = useState<ConsentPollStopReason>('none');

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const onGrantedRef = useRef(onConsentGranted);
  onGrantedRef.current = onConsentGranted;

  const checkNow = useCallback(async () => {
    try {
      if (expiresAt) {
        const t = new Date(expiresAt).getTime();
        if (Number.isFinite(t) && Date.now() >= t) return;
      }
      const token = await getTokenRef.current();
      if (!token) return;
      const { ok, parentalConsent } = await fetchParentalConsentStatus(token);
      setLastError(null);
      if (ok && parentalConsent) {
        setStopReason('granted');
        setAutoPollingActive(false);
        onGrantedRef.current?.();
      }
    } catch (e: any) {
      setLastError(e?.message || 'check failed');
    }
  }, [expiresAt]);

  useEffect(() => {
    setStopReason('none');
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let totalHttpChecks = 0;
    let stopped = false;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const pastExpiry = () => {
      if (!expiresAt) return false;
      const t = new Date(expiresAt).getTime();
      return Number.isFinite(t) && Date.now() >= t;
    };

    const stopAll = (reason: ConsentPollStopReason) => {
      stopped = true;
      clearTimer();
      setStopReason(reason);
      setAutoPollingActive(false);
    };

    const doCheck = async (): Promise<'granted' | 'continue' | 'halt'> => {
      if (cancelled || stopped) return 'halt';
      if (pastExpiry()) {
        stopAll('expired');
        return 'halt';
      }
      if (totalHttpChecks >= maxTotalChecks) {
        stopAll('cap');
        return 'halt';
      }

      totalHttpChecks += 1;
      setPollCount(totalHttpChecks);

      try {
        const token = await getTokenRef.current();
        if (!token) {
          setLastError(null);
          return 'continue';
        }
        const { ok, parentalConsent } = await fetchParentalConsentStatus(token);
        setLastError(null);
        if (ok && parentalConsent) {
          stopAll('granted');
          onGrantedRef.current?.();
          return 'granted';
        }
      } catch (e: any) {
        setLastError(e?.message || 'check failed');
      }
      return 'continue';
    };

    const nextDelay = () => {
      const doneFastPhase = totalHttpChecks >= maxFastPolls;
      if (doneFastPhase && slowIntervalMs <= 0) return null;
      return doneFastPhase ? slowIntervalMs : fastIntervalMs;
    };

    const scheduleChain = () => {
      clearTimer();
      if (cancelled || stopped) return;
      const d = nextDelay();
      if (d === null) {
        stopAll('cap');
        return;
      }
      timer = setTimeout(() => void tick(), d);
    };

    const tick = async () => {
      if (cancelled || stopped) return;
      const r = await doCheck();
      if (r !== 'continue' || cancelled || stopped) return;
      scheduleChain();
    };

    void (async () => {
      const r = await doCheck();
      if (r === 'continue' && !cancelled && !stopped) {
        scheduleChain();
      }
    })();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next.match(/inactive|background/)) {
        clearTimer();
      }
    });

    return () => {
      cancelled = true;
      stopped = true;
      clearTimer();
      setAutoPollingActive(false);
      sub.remove();
    };
  }, [expiresAt, fastIntervalMs, maxFastPolls, maxTotalChecks, slowIntervalMs]);

  return { pollCount, autoPollingActive, lastError, stopReason, checkNow };
}
