/**
 * Where the welcome bubble sat on screen, so the typing orb can start from that
 * exact spot and size when the first message replaces the welcome view.
 */

export type WelcomeOrbOrigin = { x: number; y: number; size: number };

/** Once the welcome view has been gone this long, the orb just appears in place. */
const MAX_AGE_MS = 4000;

let origin: WelcomeOrbOrigin | null = null;
/** null while the welcome view is still on screen. */
let leftAt: number | null = null;

export function setWelcomeOrbOrigin(next: WelcomeOrbOrigin): void {
  origin = next;
  leftAt = null;
}

export function markWelcomeOrbLeft(): void {
  if (origin) leftAt = Date.now();
}

export function hasWelcomeOrbOrigin(): boolean {
  return origin !== null && (leftAt === null || Date.now() - leftAt <= MAX_AGE_MS);
}

export function takeWelcomeOrbOrigin(): WelcomeOrbOrigin | null {
  const current = hasWelcomeOrbOrigin() ? origin : null;
  origin = null;
  leftAt = null;
  return current;
}
