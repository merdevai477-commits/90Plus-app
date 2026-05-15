/**
 * Backfill XP Script (Batched & Safe)
 *
 * Awards XP for existing profile completions without triggering toasts.
 * Safe to re-run: idempotency keys prevent duplicate awards.
 *
 * Features:
 * - Processes users in configurable batches (BACKFILL_BATCH_SIZE, default 100)
 * - Delay between batches (BACKFILL_BATCH_DELAY_MS, default 200ms)
 * - Failed users logged to backfill_errors.json (not thrown)
 * - Fully idempotent (safe to run multiple times)
 * - --dry-run flag: logs what would be awarded without writing to DB
 *
 * Usage:
 *   npx ts-node src/scripts/backfill-xp.ts
 *   npx ts-node src/scripts/backfill-xp.ts --dry-run
 */

import prisma from '../lib/prisma';
import { awardXp, levelFromXp, isValidSocialUrl } from '../services/xp.service';
import { XpActionType } from '@prisma/client';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const TIMEZONE = 'UTC';
const BATCH_SIZE = parseInt(process.env.BACKFILL_BATCH_SIZE || '100', 10);
const BATCH_DELAY_MS = parseInt(process.env.BACKFILL_BATCH_DELAY_MS || '200', 10);
const DRY_RUN = process.argv.includes('--dry-run');

interface BackfillSummary {
  usersProcessed: number;
  xpAwarded: number;
  levelUps: number;
  errors: number;
  durationMs: number;
}

interface BackfillError {
  userId: string;
  error: string;
  timestamp: string;
}

/**
 * Process a single user's profile for XP backfill.
 * Returns the total XP that was (or would be) awarded.
 */
async function processUser(user: {
  id: string;
  avatar: string | null;
  displayName: string | null;
  bio: string | null;
  socialLinks: unknown;
  position: string | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  preferredFoot: string | null;
  countryFlag: string | null;
  clubLogo: string | null;
  brandLogo: string | null;
  xp: number;
  level: number;
}): Promise<number> {
  let userXpAwarded = 0;

  const awards: Array<{ action: XpActionType; key: string; condition: boolean }> = [
    { action: 'PROFILE_AVATAR', key: 'profile.avatar.first', condition: !!user.avatar },
    { action: 'PROFILE_DISPLAY_NAME', key: 'profile.displayName.first', condition: !!(user.displayName && user.displayName.trim().length > 0) },
    { action: 'PROFILE_BIO', key: 'profile.bio.first', condition: !!(user.bio && user.bio.length >= 20) },
  ];

  for (const { action, key, condition } of awards) {
    if (condition) {
      if (DRY_RUN) {
        logger.info(`[DRY-RUN] Would award ${action} to ${user.id}`);
        userXpAwarded += 1; // placeholder count
      } else {
        const result = await awardXp({ userId: user.id, action, idempotencyKey: key, timezone: TIMEZONE });
        userXpAwarded += result.awarded;
      }
    }
  }

  // Social links
  const socialLinks = (user.socialLinks as Array<{ platform: string; url: string }>) || [];
  const xpPlatforms: Record<string, XpActionType> = {
    instagram: 'PROFILE_SOCIAL_INSTAGRAM',
    twitter: 'PROFILE_SOCIAL_TWITTER',
    tiktok: 'PROFILE_SOCIAL_TIKTOK',
    snapchat: 'PROFILE_SOCIAL_SNAPCHAT',
  };

  for (const link of socialLinks) {
    const platform = link.platform?.toLowerCase();
    const action = xpPlatforms[platform];
    if (action && link.url && isValidSocialUrl(platform, link.url)) {
      if (DRY_RUN) {
        logger.info(`[DRY-RUN] Would award ${action} to ${user.id}`);
        userXpAwarded += 1;
      } else {
        const result = await awardXp({ userId: user.id, action, idempotencyKey: `profile.social.${platform}.first`, timezone: TIMEZONE });
        userXpAwarded += result.awarded;
      }
    }
  }

  // FIFA fields
  const fifaFields: Array<{ field: string; action: XpActionType; value: unknown }> = [
    { field: 'position', action: 'PROFILE_FIFA_POSITION', value: user.position },
    { field: 'age', action: 'PROFILE_FIFA_AGE', value: user.age },
    { field: 'height', action: 'PROFILE_FIFA_HEIGHT', value: user.height },
    { field: 'weight', action: 'PROFILE_FIFA_WEIGHT', value: user.weight },
    { field: 'foot', action: 'PROFILE_FIFA_FOOT', value: user.preferredFoot },
    { field: 'country', action: 'PROFILE_FIFA_COUNTRY', value: user.countryFlag },
    { field: 'club', action: 'PROFILE_FIFA_CLUB', value: user.clubLogo },
    { field: 'brand', action: 'PROFILE_FIFA_BRAND', value: user.brandLogo },
  ];

  let fifaFilledCount = 0;
  for (const { field, action, value } of fifaFields) {
    if (value !== null && value !== undefined) {
      fifaFilledCount++;
      if (DRY_RUN) {
        logger.info(`[DRY-RUN] Would award ${action} to ${user.id}`);
        userXpAwarded += 1;
      } else {
        const result = await awardXp({ userId: user.id, action, idempotencyKey: `profile.fifa.${field}.first`, timezone: TIMEZONE });
        userXpAwarded += result.awarded;
      }
    }
  }

  // FIFA complete bonus
  if (fifaFilledCount === 8) {
    if (DRY_RUN) {
      logger.info(`[DRY-RUN] Would award PROFILE_FIFA_COMPLETE to ${user.id}`);
      userXpAwarded += 1;
    } else {
      const result = await awardXp({ userId: user.id, action: 'PROFILE_FIFA_COMPLETE', idempotencyKey: 'profile.fifa.complete', timezone: TIMEZONE });
      userXpAwarded += result.awarded;
    }
  }

  return userXpAwarded;
}

/**
 * Main backfill function with batching.
 */
async function backfillXp(): Promise<BackfillSummary> {
  const startTime = Date.now();
  const summary: BackfillSummary = { usersProcessed: 0, xpAwarded: 0, levelUps: 0, errors: 0, durationMs: 0 };
  const errors: BackfillError[] = [];

  const totalUsers = await prisma.user.count({ where: { isDeleted: false } });
  const totalBatches = Math.ceil(totalUsers / BATCH_SIZE);

  logger.info(`Backfill starting${DRY_RUN ? ' [DRY-RUN]' : ''}: ${totalUsers} users, ${totalBatches} batches of ${BATCH_SIZE}`);

  let cursor: string | undefined;

  for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
    const users = await prisma.user.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        avatar: true,
        displayName: true,
        bio: true,
        socialLinks: true,
        position: true,
        age: true,
        height: true,
        weight: true,
        preferredFoot: true,
        countryFlag: true,
        clubLogo: true,
        brandLogo: true,
        xp: true,
        level: true,
      },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (users.length === 0) break;
    cursor = users[users.length - 1].id;

    for (const user of users) {
      try {
        const awarded = await processUser(user);
        summary.xpAwarded += awarded;

        // Recompute level if not dry-run
        if (!DRY_RUN && awarded > 0) {
          const updatedUser = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true, level: true } });
          if (updatedUser) {
            const correctLevel = levelFromXp(updatedUser.xp);
            if (correctLevel !== updatedUser.level) {
              await prisma.user.update({ where: { id: user.id }, data: { level: correctLevel } });
              if (correctLevel > user.level) summary.levelUps++;
            }
          }
        }

        summary.usersProcessed++;
      } catch (err: unknown) {
        summary.errors++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push({ userId: user.id, error: errorMsg, timestamp: new Date().toISOString() });
        logger.error(`Backfill error for user ${user.id}: ${errorMsg}`);
      }
    }

    logger.info(`Batch ${batchNum}/${totalBatches} complete — ${summary.usersProcessed} users processed`);

    // Delay between batches
    if (batchNum < totalBatches) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  summary.durationMs = Date.now() - startTime;

  // Write errors to file if any
  if (errors.length > 0) {
    const errorsPath = path.join(process.cwd(), 'backfill_errors.json');
    fs.writeFileSync(errorsPath, JSON.stringify(errors, null, 2));
    logger.warn(`${errors.length} errors written to backfill_errors.json`);
  }

  return summary;
}

// Run if executed directly
backfillXp()
  .then((summary) => {
    const durationSec = (summary.durationMs / 1000).toFixed(1);
    logger.info(`✅ Backfill complete${DRY_RUN ? ' [DRY-RUN]' : ''}. ${summary.usersProcessed} users processed in ${durationSec}s. XP awarded: ${summary.xpAwarded}, Level-ups: ${summary.levelUps}, Errors: ${summary.errors}`);
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Backfill failed', error);
    process.exit(1);
  });

export { backfillXp };
