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

function buildMissingFieldsPatch(
  signUp: SignUpResource,
  legalAccepted: boolean,
): Record<string, unknown> {
  const missing = signUp.missingFields ?? [];
  const patch: Record<string, unknown> = {};

  if (legalAccepted || missing.includes('legal_accepted')) {
    patch.legalAccepted = true;
  }

  if (missing.includes('username') && signUp.emailAddress) {
    const local = signUp.emailAddress.split('@')[0] ?? 'user';
    const safe = local.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20);
    patch.username = `${safe}_${Math.floor(Math.random() * 9000 + 1000)}`;
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

/** Apply missing OAuth sign-up fields (legal consent, username, etc.). */
export async function completeOAuthMissingRequirements(
  signUp: SignUpResource,
  options: { legalAccepted?: boolean } = {},
): Promise<OAuthCompletionResult> {
  const legalAccepted = options.legalAccepted ?? false;
  const patch = buildMissingFieldsPatch(signUp, legalAccepted);

  if (Object.keys(patch).length > 0) {
    const updated = await signUp.update(patch);
    if (updated.status === 'complete') {
      const sessionId = resolveSessionId(signUp, updated);
      if (sessionId) return { kind: 'session', sessionId };
    }
  } else if (legalAccepted) {
    const updated = await signUp.update({ legalAccepted: true });
    if (updated.status === 'complete') {
      const sessionId = resolveSessionId(signUp, updated);
      if (sessionId) return { kind: 'session', sessionId };
    }
  }

  const stillMissing = signUp.missingFields ?? [];
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
