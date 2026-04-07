/**
 * Delete ALL users and their data from the database
 * ⚠️ DESTRUCTIVE - Cannot be undone
 * 
 * Run: npx ts-node scripts/delete-all-users.ts
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function deleteAllUsers() {
  console.log('⚠️  Starting complete database cleanup...\n');

  try {
    // Delete in order to respect foreign key constraints
    const steps = [
      { name: 'ReelViews',          fn: () => prisma.reelView.deleteMany() },
      { name: 'CommentLikes',       fn: () => prisma.commentLike.deleteMany() },
      { name: 'Comments',           fn: () => prisma.comment.deleteMany() },
      { name: 'Likes',              fn: () => prisma.like.deleteMany() },
      { name: 'SavedReels',         fn: () => prisma.savedReel.deleteMany() },
      { name: 'ReelMentions',       fn: () => prisma.reelMention.deleteMany() },
      { name: 'ReelHashtags',       fn: () => prisma.reelHashtag.deleteMany() },
      { name: 'Reels',              fn: () => prisma.reel.deleteMany() },
      { name: 'Hashtags',           fn: () => prisma.hashtag.deleteMany() },
      { name: 'Predictions',        fn: () => prisma.prediction.deleteMany() },
      { name: 'QuizAttempts',       fn: () => prisma.quizAttempt.deleteMany() },
      { name: 'CoinTransactions',   fn: () => prisma.coinTransaction.deleteMany() },
      { name: 'Notifications',      fn: () => prisma.notification.deleteMany() },
      { name: 'Reports',            fn: () => prisma.report.deleteMany() },
      { name: 'Follows',            fn: () => prisma.follow.deleteMany() },
      { name: 'UserAchievements',   fn: () => prisma.userAchievement.deleteMany() },
      { name: 'Strikes',            fn: () => (prisma as any).strike?.deleteMany() },
      { name: 'RefreshTokens',      fn: () => (prisma as any).refreshTokens?.deleteMany() },
      { name: 'Sessions',           fn: () => (prisma as any).session?.deleteMany() },
      { name: 'Users',              fn: () => prisma.user.deleteMany() },
    ];

    for (const step of steps) {
      try {
        const result = await step.fn();
        console.log(`✅ Deleted ${(result as any)?.count ?? '?'} ${step.name}`);
      } catch (err: any) {
        // Skip if table doesn't exist
        if (err.code === 'P2021' || err.message?.includes('does not exist')) {
          console.log(`⏭️  Skipped ${step.name} (table not found)`);
        } else {
          console.warn(`⚠️  ${step.name}: ${err.message}`);
        }
      }
    }

    console.log('\n✅ Database cleanup complete!');
    console.log('\n📋 Next step: Delete users from Clerk Dashboard');
    console.log('   → https://dashboard.clerk.com → Users → Select All → Delete');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllUsers();
