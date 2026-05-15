/**
 * Backfill XP Script
 *
 * Awards XP for existing profile completions without triggering toasts.
 * Safe to re-run: idempotency keys prevent duplicate awards.
 *
 * Usage: npx ts-node src/scripts/backfill-xp.ts
 */

import prisma from '../lib/prisma';
import { awardXp, levelFromXp, isValidSocialUrl, XP_VALUES } from '../services/xp.service';
import { XpActionType } from '@prisma/client';
import { logger } from '../utils/logger';

const TIMEZONE = 'UTC'; // backfill uses UTC since it's not user-initiated

interface BackfillSummary {
  usersProcessed: number;
  xpAwarded: number;
  levelUps: number;
}

async function backfillXp(): Promise<BackfillSummary> {
  const summary: BackfillSummary = { usersProcessed: 0, xpAwarded: 0, levelUps: 0 };

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
  });

  logger.info(`Backfill: Processing ${users.length} users`);

  for (const user of users) {
    let userXpAwarded = 0;

    // Avatar
    if (user.avatar) {
      const result = await awardXp({ userId: user.id, action: 'PROFILE_AVATAR', idempotencyKey: 'profile.avatar.first', timezone: TIMEZONE });
      userXpAwarded += result.awarded;
    }

    // Display name
    if (user.displayName && user.displayName.trim().length > 0) {
      const result = await awardXp({ userId: user.id, action: 'PROFILE_DISPLAY_NAME', idempotencyKey: 'profile.displayName.first', timezone: TIMEZONE });
      userXpAwarded += result.awarded;
    }

    // Bio (>= 20 chars)
    if (user.bio && user.bio.length >= 20) {
      const result = await awardXp({ userId: user.id, action: 'PROFILE_BIO', idempotencyKey: 'profile.bio.first', timezone: TIMEZONE });
      userXpAwarded += result.awarded;
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
        const result = await awardXp({ userId: user.id, action, idempotencyKey: `profile.social.${platform}.first`, timezone: TIMEZONE });
        userXpAwarded += result.awarded;
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
        const result = await awardXp({ userId: user.id, action, idempotencyKey: `profile.fifa.${field}.first`, timezone: TIMEZONE });
        userXpAwarded += result.awarded;
      }
    }

    // FIFA complete bonus
    if (fifaFilledCount === 8) {
      const result = await awardXp({ userId: user.id, action: 'PROFILE_FIFA_COMPLETE', idempotencyKey: 'profile.fifa.complete', timezone: TIMEZONE });
      userXpAwarded += result.awarded;
    }

    // Recompute level at end
    if (userXpAwarded > 0) {
      const updatedUser = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true, level: true } });
      if (updatedUser) {
        const correctLevel = levelFromXp(updatedUser.xp);
        if (correctLevel !== updatedUser.level) {
          await prisma.user.update({ where: { id: user.id }, data: { level: correctLevel } });
          if (correctLevel > user.level) summary.levelUps++;
        }
      }
    }

    summary.xpAwarded += userXpAwarded;
    summary.usersProcessed++;

    if (summary.usersProcessed % 100 === 0) {
      logger.info(`Backfill progress: ${summary.usersProcessed}/${users.length} users`);
    }
  }

  logger.info('Backfill complete', summary);
  return summary;
}

// Run if executed directly
backfillXp()
  .then((summary) => {
    logger.info('✅ Backfill finished', summary);
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Backfill failed', error);
    process.exit(1);
  });

export { backfillXp };
