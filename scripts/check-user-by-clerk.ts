/**
 * Full upload/reel diagnostic for one Clerk user id.
 * Usage: npx tsx scripts/check-user-by-clerk.ts user_xxx
 */
import 'dotenv/config';
import prisma from '../src/lib/prisma';

const REEL_UPLOAD_COOLDOWN_DAYS = 3;

async function main() {
  const clerkUserId = process.argv[2];
  if (!clerkUserId) {
    console.error('Usage: npx tsx scripts/check-user-by-clerk.ts <clerkUserId>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: {
      id: true,
      username: true,
      clerkUserId: true,
      lastReelUpload: true,
      reelUploadLockedUntil: true,
      storageUsedBytes: true,
      storageQuotaBytes: true,
      createdAt: true,
    },
  });

  if (!user) {
    console.log(`\n❌ No DB user for clerkUserId=${clerkUserId}`);
    process.exit(1);
  }

  const now = Date.now();
  const daysSince = user.lastReelUpload
    ? Math.floor((now - user.lastReelUpload.getTime()) / 86400000)
    : null;
  const canUploadByCooldown =
    user.lastReelUpload == null || (daysSince != null && daysSince >= REEL_UPLOAD_COOLDOWN_DAYS);
  const lockLeft =
    user.reelUploadLockedUntil && user.reelUploadLockedUntil.getTime() > now
      ? Math.ceil((user.reelUploadLockedUntil.getTime() - now) / 60000)
      : 0;

  console.log('\n=== User ===');
  console.log(`  username: @${user.username}`);
  console.log(`  clerkUserId: ${user.clerkUserId}`);
  console.log(`  db id: ${user.id}`);
  console.log(`  joined: ${user.createdAt.toISOString()}`);
  console.log(`  storage: ${(Number(user.storageUsedBytes) / 1e9).toFixed(2)} / ${(Number(user.storageQuotaBytes) / 1e9).toFixed(2)} GB`);
  console.log(`  lastReelUpload: ${user.lastReelUpload?.toISOString() ?? 'never'}`);
  console.log(`  cooldown (3d): ${canUploadByCooldown ? '✅ can upload' : `❌ wait ${REEL_UPLOAD_COOLDOWN_DAYS - (daysSince ?? 0)} more day(s)`}`);
  console.log(`  upload lock: ${lockLeft > 0 ? `❌ locked ~${lockLeft} min` : '✅ none'}`);

  const reels = await prisma.reel.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      status: true,
      createdAt: true,
      fileSizeBytes: true,
      muxUploadId: true,
      muxAssetId: true,
      videoUrl: true,
    },
  });

  console.log(`\n=== Reels (${reels.length} shown) ===`);
  if (reels.length === 0) console.log('  (none)');
  for (const r of reels) {
    console.log(
      `  ${r.createdAt.toISOString()}  ${r.status}  ${(Number(r.fileSizeBytes) / 1e6).toFixed(2)}MB  mux=${r.muxUploadId ? 'yes' : 'no'}  url=${r.videoUrl ? 'yes' : 'no'}  ${r.id.slice(0, 8)}…`,
    );
  }

  const events = await prisma.uploadEvent.findMany({
    where: { userId: user.id, type: 'REEL' },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  console.log('\n=== Upload events (reel) ===');
  if (events.length === 0) console.log('  (none)');
  for (const e of events) {
    console.log(
      `  ${e.createdAt.toISOString()}  ${e.status}  ${e.errorCode ?? '-'}  ${e.fileSizeMB.toFixed(2)}MB  ${Math.round(e.durationMs / 1000)}s`,
    );
  }

  const processing = reels.filter((r) => r.status === 'PROCESSING');
  console.log('\n=== Verdict ===');
  if (lockLeft > 0) {
    console.log('  Blocked by in-progress upload lock — retry after lock expires or clear reelUploadLockedUntil.');
  } else if (!canUploadByCooldown) {
    console.log('  Blocked by 3-day reel cooldown after last successful upload.');
  } else if (events[0]?.status === 'FAILED' && events[0].errorCode === 'MUX_UNAVAILABLE') {
    console.log('  Last server attempt failed (Mux was full). Mux is cleared now — should work if app reaches server.');
  } else if (events.length > 0 && events[0].createdAt.getTime() < now - 3 * 3600000) {
    console.log('  No upload attempt reached server in the last ~3 hours — likely client/network issue.');
  } else if (events[0]?.status === 'SUCCESS') {
    console.log('  Last upload succeeded on server.');
  } else {
    console.log('  Server allows upload — if app still fails, check client (video length, network, stay on screen).');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
