/**
 * Complete Clerk OAuth sign-up when status is `missing_requirements`.
 * Production requires legal consent; Google/Apple may not supply it automatically.
 */

type SignUpResource = {
  update: (params: Record<string, unknown>) => Promise<{
    status?: string | null;
    createdSessionId?: string | null;
    missingFields?: string[];
  }>;
  missingFields?: string[];
  emailAddress?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  createdSessionId?: string | null;
  prepareEmailAddressVerification?: (opts: {
    strategy: 'email_code';
  }) => Promise<unknown>;
};

export type OAuthCompletionResult =
  | { kind: 'session'; sessionId: string }
  | { kind: 'email_verification' }
  | { kind: 'failed'; missingFields: string[] };

function generateUsernameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'user';
  const safe = local.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20);
  return `${safe}_${Math.floor(Math.random() * 9000 + 1000)}`;
}

function buildMissingFieldsPatch(
  signUp: SignUpResource,
  legalAccepted: boolean,
  missingFields?: string[],
  emailFallback?: string,
): Record<string, unknown> {
  const missing = missingFields ?? signUp.missingFields ?? [];
  const patch: Record<string, unknown> = {};

  if (legalAccepted || missing.includes('legal_accepted')) {
    patch.legalAccepted = true;
  }

  if (missing.includes('username')) {
    const emailAddr = signUp.emailAddress ?? emailFallback;
    if (emailAddr) {
      patch.username = generateUsernameFromEmail(emailAddr);
    }
  }

  if (missing.includes('first_name') && signUp.firstName) {
    patch.firstName = signUp.firstName;
  }
  if (missing.includes('last_name') && signUp.lastName) {
    patch.lastName = signUp.lastName;
  }

  return patch;
}

function resolveSessionId(
  signUp: SignUpResource,
  updated?: { createdSessionId?: string | null },
): string | null {
  return updated?.createdSessionId ?? signUp.createdSessionId ?? null;
}

export type CompleteSignUpOptions = {
  legalAccepted?: boolean;
  /** Fresh list from `attemptEmailAddressVerification` — hook `missingFields` is often stale. */
  missingFields?: string[];
  /** Email from the registration form when `signUp.emailAddress` is not set yet. */
  email?: string;
};

/** Apply missing sign-up fields (legal consent, username, etc.) after OAuth or email OTP. */
export async function completeOAuthMissingRequirements(
  signUp: SignUpResource,
  options: CompleteSignUpOptions = {},
): Promise<OAuthCompletionResult> {
  const legalAccepted = options.legalAccepted ?? false;
  let missing = options.missingFields ?? signUp.missingFields ?? [];

  for (let attempt = 0; attempt < 3; attempt++) {
    const patch = buildMissingFieldsPatch(signUp, legalAccepted, missing, options.email);

    if (Object.keys(patch).length > 0) {
      const updated = await signUp.update(patch);
      if (updated.status === 'complete') {
        const sessionId = resolveSessionId(signUp, updated);
        if (sessionId) return { kind: 'session', sessionId };
      }
      missing = updated.missingFields ?? signUp.missingFields ?? [];
      if (missing.length === 0) continue;
    } else if (legalAccepted) {
      const updated = await signUp.update({ legalAccepted: true });
      if (updated.status === 'complete') {
        const sessionId = resolveSessionId(signUp, updated);
        if (sessionId) return { kind: 'session', sessionId };
      }
      missing = updated.missingFields ?? signUp.missingFields ?? [];
    } else {
      break;
    }
  }

  const stillMissing = missing.length > 0 ? missing : (signUp.missingFields ?? []);
  const needsEmail =
    stillMissing.includes('email_address') ||
    stillMissing.some((f) => f.includes('email') && f.includes('verif'));

  if (needsEmail && signUp.prepareEmailAddressVerification) {
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      return { kind: 'email_verification' };
    } catch {
      // fall through
    }
  }

  return { kind: 'failed', missingFields: stillMissing };
}
