/**
 * Daily spin — the Share & Win wheel.
 *
 * Wraps the app's existing `/api/daily-spin` endpoints rather than introducing
 * a second spin system: the server owns the prize table, the 24h cooldown and
 * the coin award, and returns the winning `prizeIndex`. The UI's only job is to
 * land the wheel on that index.
 *
 * A single in-flight guard lives here (not in the component) so a double-tap,
 * a re-render or a second mounted wheel can never fire two spins.
 *
 * ── WHY spin() RETURNS A DISCRIMINATED RESULT, NOT A BARE OUTCOME ────────────
 * A wheel that goes quiet on failure is indistinguishable from a wheel that's
 * simply broken. Every way `POST /spin` can fail was previously collapsed into
 * `null`, so a legitimate 24h cooldown looked identical to a dropped network
 * request — the caller could only cancel the animation and say nothing, which
 * reads as "I tapped Spin and nothing happened." Distinguishing the two lets
 * the UI tell the user something true in both cases, and only the second case
 * (server truly unreachable) falls back to a local result so the interaction
 * still completes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';

import { getApiUrl } from '../config/api.config';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { getClerkBearerToken } from '../utils/clerkAuthToken';
import { logger } from '../utils/logger';

export interface SpinPrize {
  coins: number;
  label: string;
  colorLight: string;
  colorDark: string;
}

export interface DailySpinStatus {
  canSpin: boolean;
  timeRemaining: { hours: number; minutes: number };
  currentCoins: number;
  prizes: SpinPrize[];
}

export interface SpinOutcome {
  prizeIndex: number;
  coins: number;
  label: string;
  newBalance: number;
  /** 'offline' means the server could not be reached — see spin() below. */
  source: 'server' | 'offline';
}

export type SpinAttempt =
  | { status: 'ok'; outcome: SpinOutcome }
  | { status: 'cooldown'; timeRemaining: { hours: number; minutes: number } }
  /** A spin is already in flight — the caller should no-op, not animate again. */
  | { status: 'locked' };

/**
 * Fallback wheel face, used only until `/daily-spin/status` answers, so the
 * card never renders an empty wheel. Mirrors the server's prize table.
 */
export const FALLBACK_PRIZES: SpinPrize[] = [
  { coins: 5, label: '5', colorLight: '#8B5CF6', colorDark: '#6D28D9' },
  { coins: 10, label: '10', colorLight: '#7C3AED', colorDark: '#5B21B6' },
  { coins: 25, label: '25', colorLight: '#8B5CF6', colorDark: '#6D28D9' },
  { coins: 50, label: '50', colorLight: '#7C3AED', colorDark: '#5B21B6' },
  { coins: 100, label: '100', colorLight: '#8B5CF6', colorDark: '#6D28D9' },
  { coins: 200, label: '200', colorLight: '#7C3AED', colorDark: '#5B21B6' },
  { coins: 5, label: '5', colorLight: '#8B5CF6', colorDark: '#6D28D9' },
  { coins: 10, label: '10', colorLight: '#7C3AED', colorDark: '#5B21B6' },
];

/**
 * Mirrors SPIN_PRIZES in src/routes/daily-spin.routes.ts, for the offline
 * fallback only. The server is always the source of truth when reachable —
 * this table exists purely so a disconnected demo still lands somewhere
 * believable instead of doing nothing.
 */
const FALLBACK_WEIGHTS = [35, 25, 20, 8.9, 1, 0.1, 6, 4];

function pickFallbackIndex(): number {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (let i = 0; i < FALLBACK_WEIGHTS.length; i += 1) {
    cumulative += FALLBACK_WEIGHTS[i];
    if (roll <= cumulative) return i;
  }
  return 0;
}

export function useDailySpin() {
  const { getToken, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [status, setStatus] = useState<DailySpinStatus | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  /** Ref, not state — the guard must be correct within a single tick. */
  const spinLock = useRef(false);
  const prizesRef = useRef(FALLBACK_PRIZES);

  const loadStatus = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) return;

      const res = await fetchWithTimeout(`${getApiUrl()}/daily-spin/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const json = await res.json();
      const data = json?.data;
      if (!data) return;

      const prizes: SpinPrize[] =
        Array.isArray(data.prizes) && data.prizes.length > 0 ? data.prizes : FALLBACK_PRIZES;
      prizesRef.current = prizes;

      setStatus({
        canSpin: !!data.canSpin,
        timeRemaining: data.timeRemaining ?? { hours: 0, minutes: 0 },
        currentCoins: data.currentCoins ?? 0,
        prizes,
      });
    } catch (error) {
      logger.debug('[DailySpin] status failed:', error);
    }
  }, [isSignedIn]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const offlineOutcome = useCallback((): SpinOutcome => {
    const index = pickFallbackIndex();
    const prize = prizesRef.current[index] ?? FALLBACK_PRIZES[index];
    return {
      prizeIndex: index,
      coins: prize.coins,
      label: prize.label,
      newBalance: status?.currentCoins ?? 0,
      source: 'offline',
    };
  }, [status?.currentCoins]);

  /**
   * Ask the server for a result.
   *
   *   • A real cooldown (the account already spun today) comes back as
   *     `{ status: 'cooldown' }` with the server's exact remaining time — the
   *     caller surfaces that, it never fakes a spin around it.
   *   • Anything that means "the server could not be reached" — no auth
   *     token, a thrown network error, a malformed response — falls back to
   *     a local result so the wheel still completes a real spin. The result
   *     is tagged `source: 'offline'` and never claims a balance the server
   *     hasn't actually credited.
   */
  const spin = useCallback(async (): Promise<SpinAttempt> => {
    if (spinLock.current) return { status: 'locked' };
    spinLock.current = true;
    setIsSpinning(true);

    try {
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) {
        logger.debug('[DailySpin] No auth token — falling back to an offline spin');
        return { status: 'ok', outcome: offlineOutcome() };
      }

      const res = await fetchWithTimeout(`${getApiUrl()}/daily-spin/spin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        // A cooldown is a real, informative rejection — never masked.
        if (res.status === 429) {
          try {
            const body = await res.json();
            const timeRemaining = body?.timeRemaining ?? body?.error?.timeRemaining;
            if (timeRemaining) {
              return { status: 'cooldown', timeRemaining };
            }
          } catch {
            /* fall through to offline fallback below */
          }
        }
        logger.debug(`[DailySpin] spin request failed (${res.status}) — offline fallback`);
        return { status: 'ok', outcome: offlineOutcome() };
      }

      const json = await res.json();
      const prize = json?.data?.prize;
      if (!prize || typeof prize.prizeIndex !== 'number') {
        logger.debug('[DailySpin] spin response malformed — offline fallback');
        return { status: 'ok', outcome: offlineOutcome() };
      }

      return {
        status: 'ok',
        outcome: {
          prizeIndex: prize.prizeIndex,
          coins: prize.coins ?? 0,
          label: String(prize.label ?? prize.coins ?? ''),
          newBalance: json?.data?.newBalance ?? 0,
          source: 'server',
        },
      };
    } catch (error) {
      logger.debug('[DailySpin] spin threw — offline fallback:', error);
      return { status: 'ok', outcome: offlineOutcome() };
    } finally {
      spinLock.current = false;
    }
  }, [offlineOutcome]);

  /** Called by the wheel once its animation has fully settled. */
  const finishSpin = useCallback(() => {
    setIsSpinning(false);
    void loadStatus();
  }, [loadStatus]);

  return {
    status,
    prizes: status?.prizes ?? FALLBACK_PRIZES,
    canSpin: status?.canSpin ?? true,
    timeRemaining: status?.timeRemaining ?? null,
    isSpinning,
    spin,
    finishSpin,
    reloadStatus: loadStatus,
  };
}
