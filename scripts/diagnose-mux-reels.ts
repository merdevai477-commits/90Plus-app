/**
 * Diagnose Mux asset cap vs reel upload blockers.
 * Usage: npx tsx scripts/diagnose-mux-reels.ts
 */
import 'dotenv/config';
import Mux from '@mux/mux-node';
import prisma from '../src/lib/prisma';
import { freeMuxAssetSlots } from '../src/services/mux-cleanup.service';

async function main() {
  const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID!,
    tokenSecret: process.env.MUX_TOKEN_SECRET!,
  });

  const page = await mux.video.assets.list({ limit: 100 });
  const assets = ((page as { data?: unknown[] }).data ?? []) as Array<{
    id: string;
    status?: string;
    created_at?: number | string;
    passthrough?: string;
  }>;

  const reels = await prisma.reel.findMany({
    where: {
      OR: [{ muxAssetId: { not: null } }, { status: 'PROCESSING' }],
    },
    select: {
      id: true,
      status: true,
      muxAssetId: true,
      muxUploadId: true,
      createdAt: true,
      user: { select: { username: true, reelUploadLockedUntil: true, lastReelUpload: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  const assetIdsInDb = new Set(reels.map((r) => r.muxAssetId).filter(Boolean) as string[]);
  const processing = reels.filter((r) => r.status === 'PROCESSING');
  const lockedUsers = await prisma.user.findMany({
    where: { reelUploadLockedUntil: { gt: new Date() } },
    select: { username: true, reelUploadLockedUntil: true },
    take: 20,
  });

  console.log('\n=== Mux assets:', assets.length, '/ 10 cap ===');
  for (const a of assets) {
    const inDb = assetIdsInDb.has(a.id) ? 'in-DB' : 'ORPHAN?';
    console.log(`  ${a.id}  status=${a.status ?? '?'}  ${inDb}  passthrough=${(a.passthrough ?? '').slice(0, 70)}`);
  }

  console.log('\n=== Recent PROCESSING / mux reels ===');
  for (const r of reels.slice(0, 15)) {
    const ageMin = Math.round((Date.now() - r.createdAt.getTime()) / 60_000);
    console.log(
      `  ${r.id.slice(0, 8)}… status=${r.status} age=${ageMin}m asset=${r.muxAssetId ?? '-'} upload=${r.muxUploadId ?? '-'} user=@${r.user.username}`,
    );
  }

  console.log('\n=== PROCESSING count:', processing.length, '===');
  console.log('=== Users with upload lock:', lockedUsers.length, '===');
  for (const u of lockedUsers) {
    const leftMin = Math.ceil((u.reelUploadLockedUntil!.getTime() - Date.now()) / 60_000);
    console.log(`  @${u.username} locked for ~${leftMin} more min`);
  }

  try {
    await mux.video.uploads.create({
      cors_origin: '*',
      new_asset_settings: { playback_policy: ['public'], video_quality: 'basic' },
    });
    console.log('\n✅ createUploadUrl would succeed now');
  } catch (err: unknown) {
    const msg = String((err as { message?: string })?.message ?? err);
    console.log('\n❌ createUploadUrl blocked:', msg.slice(0, 120));
    if (msg.includes('10 assets')) {
      const freed = await freeMuxAssetSlots(2);
      console.log(`   auto-prune attempt freed ${freed} slot(s)`);
    }
  }

  const recentUploads = await prisma.uploadEvent.findMany({
    where: { type: 'REEL' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { createdAt: true, status: true, errorCode: true, fileSizeMB: true },
  });
  console.log('\n=== Recent reel upload analytics ===');
  for (const row of recentUploads) {
    console.log(
      `  ${row.createdAt.toISOString()}  ${row.status}  ${row.errorCode ?? '-'}  ${row.fileSizeMB?.toFixed?.(2) ?? row.fileSizeMB}MB`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
