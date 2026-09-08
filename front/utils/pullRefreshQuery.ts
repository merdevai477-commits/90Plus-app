/** Client pull-to-refresh query helper — never sets `fresh=1`. */

export const PTR_CLIENT_COOLDOWN_MS = 2500;

export function appendPullQuery(url: string, pull?: boolean): string {
  if (!pull) return url;
  return url.includes('?') ? `${url}&pull=1` : `${url}?pull=1`;
}

export function shouldSkipClientPullCooldown(lastAtMs: number, now = Date.now()): boolean {
  return lastAtMs > 0 && now - lastAtMs < PTR_CLIENT_COOLDOWN_MS;
}
