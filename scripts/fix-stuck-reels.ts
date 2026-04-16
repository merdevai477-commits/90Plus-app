/**
 * Script to fix reels stuck in PROCESSING state by querying Mux directly.
 */
import Mux from '@mux/mux-node';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
        // Find all reels stuck in PROCESSING with a muxUploadId but no playbackId
        const stuckReels = await prisma.reel.findMany({
            where: {
                status: 'PROCESSING',
                muxUploadId: { not: null },
            },
            select: {
                id: true,
                muxUploadId: true,
                muxAssetId: true,
                muxPlaybackId: true,
                videoUrl: true,
                status: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        console.log(`\n📋 Found ${stuckReels.length} stuck PROCESSING reels:\n`);
        stuckReels.forEach(r => {
            console.log(`  ID: ${r.id}`);
            console.log(`  UploadId: ${r.muxUploadId}`);
            console.log(`  AssetId: ${r.muxAssetId}`);
            console.log(`  Status: ${r.status}`);
            console.log(`  Created: ${r.createdAt}`);
            console.log('---');
        });

        if (stuckReels.length === 0) {
            console.log('✅ No stuck reels found!');
            return;
        }

        // Try to get asset info from Mux for each stuck reel
        const muxClient = new Mux({
            tokenId: process.env.MUX_TOKEN_ID,
            tokenSecret: process.env.MUX_TOKEN_SECRET,
        });

        for (const reel of stuckReels) {
            console.log(`\n🔍 Checking Mux for reel ${reel.id}...`);

            try {
                // Try to get the upload to find the linked asset
                if (reel.muxUploadId) {
                    const upload = await muxClient.video.uploads.retrieve(reel.muxUploadId);
                    console.log(`  Upload status: ${upload.status}`);
                    console.log(`  Asset ID: ${upload.asset_id}`);

                    if (upload.asset_id) {
                        // Get the asset
                        const asset = await muxClient.video.assets.retrieve(upload.asset_id);
                        console.log(`  Asset status: ${asset.status}`);
                        console.log(`  Playback IDs: ${JSON.stringify(asset.playback_ids)}`);

                        if (asset.status === 'ready' && asset.playback_ids && asset.playback_ids.length > 0) {
                            const playbackId = asset.playback_ids[0].id;
                            const videoUrl = `https://stream.mux.com/${playbackId}.m3u8`;
                            const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1`;

                            // Update the reel!
                            await prisma.reel.update({
                                where: { id: reel.id },
                                data: {
                                    status: 'READY',
                                    muxAssetId: upload.asset_id,
                                    muxPlaybackId: playbackId,
                                    videoUrl,
                                    thumbnail: thumbnailUrl,
                                },
                            });

                            console.log(`  ✅ FIXED! Reel ${reel.id} is now READY`);
                            console.log(`  videoUrl: ${videoUrl}`);
                        } else if (asset.status === 'errored') {
                            await prisma.reel.update({
                                where: { id: reel.id },
                                data: { status: 'FAILED' },
                            });
                            console.log(`  ❌ Asset errored — marked reel as FAILED`);
                        } else {
                            console.log(`  ⏳ Asset still ${asset.status} — skipping`);
                        }
                    } else {
                        console.log(`  ⚠️ Upload not linked to asset yet (status: ${upload.status})`);
                    }
                }
            } catch (muxErr: any) {
                console.log(`  ❌ Mux error: ${muxErr.message}`);
            }
        }

        console.log('\n✅ Done fixing stuck reels!');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);
