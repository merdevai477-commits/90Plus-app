/**
 * Shared age / parental-consent API helpers + optional reactive hook.
 * Screens (age-gate, waiting-consent) should call the async helpers; use the hook only when you need polling/state.
 */

import { getApiEndpoint } from '../config/api.config';
import { logger } from '../services/logger';

/** Passive hook & extras — set true when you wire dashboard / settings age status */
export const AGE_VERIFICATION_HOOK_ENABLED = false;

export type AgeVerifyTier = 'BLOCKED' | 'TEEN' | 'ADULT';

export interface VerifyAgeSuccess {
  ok: true;
  ageTier: AgeVerifyTier;
  requiresParentalConsent?: boolean;
  raw: unknown;
}

export interface VerifyAgeFailure {
  ok: false;
  status: number;
  code?: string;
  message?: string;
  ageTier?: AgeVerifyTier;
  raw: unknown;
}

/**
 * POST /auth/verify-age — used by age-gate
 */
export async function verifyAgeWithBackend(
  token: string,
  dateOfBirthYmd: string
): Promise<VerifyAgeSuccess | VerifyAgeFailure> {
  const response = await fetch(getApiEndpoint('auth/verify-age'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ dateOfBirth: dateOfBirthYmd }),
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      code: data?.code,
      message: data?.message,
      ageTier: data?.ageTier,
      raw: data,
    };
  }

  return {
    ok: true,
    ageTier: data?.ageTier,
    requiresParentalConsent: data?.requiresParentalConsent,
    raw: data,
  };
}

/**
 * GET /auth/age-status — used by waiting-consent polling
 */
export async function fetchParentalConsentStatus(token: string): Promise<{
  ok: boolean;
  parentalConsent?: boolean;
  raw: unknown;
}> {
  const response = await fetch(getApiEndpoint('auth/age-status'), {
    headers: { Authorization: `Bearer ${token}` },
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return {
    ok: response.ok,
    parentalConsent: data?.parentalConsent === true,
    raw: data,
  };
}

export type AgeVerificationHookState =
  | { status: 'disabled' }
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; parentalConsent?: boolean };

/**
 * Optional reactive wrapper — disabled by default (AGE_VERIFICATION_HOOK_ENABLED).
 * When enabled, call refresh() after you have a token.
 */
export function useAgeVerification(_clerkUserId?: string | null) {
  const state: AgeVerificationHookState = AGE_VERIFICATION_HOOK_ENABLED
    ? { status: 'idle' }
    : { status: 'disabled' };

  const refresh = async () => {
    if (!AGE_VERIFICATION_HOOK_ENABLED) return;
    logger.debug('[useAgeVerification] refresh() — implement when hook is enabled');
  };

  return {
    hookEnabled: AGE_VERIFICATION_HOOK_ENABLED,
    state,
    refresh,
    verifyAgeWithBackend,
    fetchParentalConsentStatus,
  };
}
