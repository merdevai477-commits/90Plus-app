/**
 * Check reel upload cooldowns, locks, and recent attempts.
 * Usage: npx tsx scripts/check-reel-upload-users.ts [username]
 */
import 'dotenv/config';
import prisma from '../src/lib/prisma';

const REEL_UPLOAD_COOLDOWN_DAYS = 3;

async function main() {
  const usernameFilter = process.argv[2]?.replace(/^@/, '');

  const recentEvents = await prisma.uploadEvent.findMany({
    where: { type: 'REEL', createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  const userIds = [...new Set(recentEvents.map((e) => e.userId))];
  const usersById = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true },
      })
    ).map((u) => [u.id, u.username]),
  );

  console.log('\n=== Reel uploads last 48h ===');
  for (const e of recentEvents) {
    const uname = usersById.get(e.userId) ?? e.userId.slice(0, 8);
    console.log(
      `  ${e.createdAt.toISOString()}  @${uname}  ${e.status}  ${e.errorCode ?? '-'}  ${e.fileSizeMB.toFixed(2)}MB`,
    );
  }

  const usersWithRecentUpload = await prisma.user.findMany({
    where: {
      lastReelUpload: { not: null },
      ...(usernameFilter ? { username: usernameFilter } : {}),
    },
    orderBy: { lastReelUpload: 'desc' },
    take: usernameFilter ? 5 : 15,
    select: {
      username: true,
      lastReelUpload: true,
      reelUploadLockedUntil: true,
      storageUsedBytes: true,
      storageQuotaBytes: true,
    },
  });

  console.log('\n=== Reel cooldown / lock status ===');
  const now = Date.now();
  for (const u of usersWithRecentUpload) {
    const last = u.lastReelUpload!;
    const daysSince = Math.floor((now - last.getTime()) / (86400000));
    const canUpload = daysSince >= REEL_UPLOAD_COOLDOWN_DAYS;
    const lockLeft =
      u.reelUploadLockedUntil && u.reelUploadLockedUntil.getTime() > now
        ? Math.ceil((u.reelUploadLockedUntil.getTime() - now) / 60000)
        : 0;
    console.log(
      `  @${u.username}  lastUpload=${last.toISOString()}  daysSince=${daysSince}  canUpload=${canUpload ? 'YES' : 'NO (cooldown)'}  lockMin=${lockLeft}`,
    );
  }

  if (usernameFilter) {
    const user = await prisma.user.findUnique({
      where: { username: usernameFilter },
      select: {
        id: true,
        username: true,
        lastReelUpload: true,
        reelUploadLockedUntil: true,
        storageUsedBytes: true,
        storageQuotaBytes: true,
      },
    });
    if (user) {
      const usedGb = Number(user.storageUsedBytes) / 1e9;
      const quotaGb = Number(user.storageQuotaBytes) / 1e9;
      const lockLeft =
        user.reelUploadLockedUntil && user.reelUploadLockedUntil.getTime() > Date.now()
          ? Math.ceil((user.reelUploadLockedUntil.getTime() - Date.now()) / 60000)
          : 0;
      console.log(`\n=== User @${usernameFilter} ===`);
      console.log(`  lastReelUpload: ${user.lastReelUpload?.toISOString() ?? 'never'}`);
      console.log(`  uploadLock: ${lockLeft > 0 ? lockLeft + ' min left' : 'none'}`);
      console.log(`  storage: ${usedGb.toFixed(2)} / ${quotaGb.toFixed(2)} GB`);

      const reels = await prisma.reel.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, status: true, createdAt: true, fileSizeBytes: true },
      });
      console.log(`\n=== Last reels for @${usernameFilter} ===`);
      for (const r of reels) {
        console.log(
          `  ${r.createdAt.toISOString()}  ${r.status}  ${(Number(r.fileSizeBytes) / 1e6).toFixed(2)}MB  ${r.id.slice(0, 8)}…`,
        );
      }
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
