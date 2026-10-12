/**
 * Where the welcome bubble sat on screen, so the typing orb can start from that
 * exact spot and size when the first message replaces the welcome view.
 */

export type WelcomeOrbOrigin = { x: number; y: number; size: number };

/** Older than this, the welcome view is long gone and the orb starts from screen centre instead. */
const MAX_AGE_MS = 4000;

let origin: (WelcomeOrbOrigin & { at: number }) | null = null;

export function setWelcomeOrbOrigin(next: WelcomeOrbOrigin): void {
  origin = { ...next, at: Date.now() };
}

export function markWelcomeOrbLeft(): void {
  if (origin) origin.at = Date.now();
}

export function takeWelcomeOrbOrigin(): WelcomeOrbOrigin | null {
  const current = origin;
  origin = null;
  if (!current || Date.now() - current.at > MAX_AGE_MS) return null;
  return { x: current.x, y: current.y, size: current.size };
}
