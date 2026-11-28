/**
 * Auto +1 friend for the locked Share & Win seed account every 7 minutes.
 * Reuses adjustSeedFriends so ranking score (+3) and profile XP (+1) stay in sync.
 */

import { logger } from '../utils/logger';
import { adjustSeedFriends, SEED_FRIENDS_MAX } from './seed-account-adjust.service';

const INTERVAL_MS = 7 * 60 * 1000;
/** Opt-in only — leave off unless SEED_FRIENDS_AUTO_ENABLED=true. */
const ENABLED = process.env.SEED_FRIENDS_AUTO_ENABLED === 'true';

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) {
    logger.warn('[SeedFriendsAuto] previous tick still running — skipping');
    return;
  }
  running = true;
  try {
    const result = await adjustSeedFriends(1);
    logger.info('[SeedFriendsAuto] +1 friend', {
      friends: result.friends,
      score: result.score,
      xp: result.xp,
      xpDelta: result.xpDelta,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cannot exceed|not found/i.test(msg)) {
      logger.warn(`[SeedFriendsAuto] stopped this tick: ${msg} (max ${SEED_FRIENDS_MAX})`);
    } else {
      logger.error('[SeedFriendsAuto] tick failed:', msg);
    }
  } finally {
    running = false;
  }
}

/** Schedule +1 seed friend every 7 minutes. No immediate fire on boot. */
export function startSeedFriendsAutoBoost(): void {
  if (!ENABLED) {
    logger.info('[SeedFriendsAuto] disabled (set SEED_FRIENDS_AUTO_ENABLED=true to enable)');
    return;
  }
  if (timer) return;
  timer = setInterval(() => {
    void tick();
  }, INTERVAL_MS);
  timer.unref?.();
  logger.info('✅ Seed friends auto-boost scheduled (+1 every 7m, with XP + ranking)');
}

export function stopSeedFriendsAutoBoost(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
