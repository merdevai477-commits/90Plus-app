/** Detect backend cooldown responses without matching localized message text. */
export function isCooldownApiError(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  const code = p.code ?? p.errorCode ?? (p.data as Record<string, unknown> | undefined)?.code;
  if (code === 'COOLDOWN_ACTIVE' || code === 'USERNAME_COOLDOWN') return true;
  return p.error === 'COOLDOWN' || p.type === 'USERNAME_COOLDOWN';
}

export function isReelUploadConflictError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('already') ||
    m.includes('in progress') ||
    m.includes('upload_in_progress') ||
    message.includes('بالفعل') ||
    message.includes('يتم رفع')
  );
}

export function isGatewayOrServerError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /502|503|504|bad gateway|gateway|econnrefused|network request failed|fetch failed|server error|الخادم|المحفوظة/i.test(
    message,
  );
}

export function formatVideoUploadCooldown(
  t: {
    profile: {
      videoCooldownDaysHours: string;
      videoCooldownHoursOnly: string;
    };
  },
  daysRemaining: number,
  hoursRemaining: number,
): string {
  if (daysRemaining > 0) {
    return t.profile.videoCooldownDaysHours
      .replace('{days}', String(daysRemaining))
      .replace('{hours}', String(hoursRemaining));
  }
  return t.profile.videoCooldownHoursOnly.replace('{hours}', String(hoursRemaining));
}
