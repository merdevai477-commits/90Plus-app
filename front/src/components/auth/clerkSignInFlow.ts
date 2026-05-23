import type { SignInResource } from '@clerk/types';

export const MIN_PASSWORD_LENGTH = 8;

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type SecondFactorKind = 'email_code' | 'phone_code' | 'totp' | 'backup_code' | null;

export function resolveSecondFactor(signIn: SignInResource): {
  kind: SecondFactorKind;
  emailAddressId?: string;
  phoneNumberId?: string;
} {
  const factors = signIn.supportedSecondFactors ?? [];

  const emailFactor = factors.find((f) => f.strategy === 'email_code') as
    | { strategy: 'email_code'; emailAddressId: string }
    | undefined;
  if (emailFactor?.emailAddressId) {
    return { kind: 'email_code', emailAddressId: emailFactor.emailAddressId };
  }

  const phoneFactor = factors.find((f) => f.strategy === 'phone_code') as
    | { strategy: 'phone_code'; phoneNumberId: string }
    | undefined;
  if (phoneFactor?.phoneNumberId) {
    return { kind: 'phone_code', phoneNumberId: phoneFactor.phoneNumberId };
  }

  if (factors.some((f) => f.strategy === 'totp')) {
    return { kind: 'totp' };
  }

  if (factors.some((f) => f.strategy === 'backup_code')) {
    return { kind: 'backup_code' };
  }

  return { kind: null };
}

export function signInNeedsVerification(status: string | null | undefined): boolean {
  return (
    status === 'needs_second_factor' ||
    status === 'needs_client_trust'
  );
}

export async function prepareSignInSecondFactor(
  signIn: SignInResource,
  factor: ReturnType<typeof resolveSecondFactor>,
): Promise<void> {
  if (factor.kind === 'email_code' && factor.emailAddressId) {
    await signIn.prepareSecondFactor({
      strategy: 'email_code',
      emailAddressId: factor.emailAddressId,
    });
    return;
  }

  if (factor.kind === 'phone_code' && factor.phoneNumberId) {
    await signIn.prepareSecondFactor({
      strategy: 'phone_code',
      phoneNumberId: factor.phoneNumberId,
    });
  }
}

export async function attemptSignInSecondFactor(
  signIn: SignInResource,
  kind: SecondFactorKind,
  code: string,
): Promise<SignInResource> {
  if (!kind) {
    throw new Error('No second factor strategy selected');
  }

  return signIn.attemptSecondFactor({
    strategy: kind,
    code,
  });
}
