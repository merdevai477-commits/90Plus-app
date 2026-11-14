import prisma from '../lib/prisma';

/** Likes received on reels plus likes received on community posts. */
export async function countReceivedLikes(userId: string): Promise<number> {
    const [reelLikes, postLikes] = await Promise.all([
        prisma.like.count({ where: { reel: { userId } } }),
        prisma.communityPostLike.count({
            where: { post: { userId, status: 'ACTIVE' } },
        }),
    ]);
    return reelLikes + postLikes;
}
