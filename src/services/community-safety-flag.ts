import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export type CommunitySafetyFlag = 'NSFW' | 'REPORTED' | 'NSFW_REPORTED';

export function mergeSafetyFlag(current: string | null | undefined, kind: 'NSFW' | 'REPORTED'): CommunitySafetyFlag {
    if (kind === 'NSFW') return current === 'REPORTED' || current === 'NSFW_REPORTED' ? 'NSFW_REPORTED' : 'NSFW';
    return current === 'NSFW' || current === 'NSFW_REPORTED' ? 'NSFW_REPORTED' : 'REPORTED';
}

/** Distinctive user flag so admins can identify violators by name + email. */
export async function markCommunitySafetyFlag(userId: string, kind: 'NSFW' | 'REPORTED'): Promise<void> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { communitySafetyFlag: true },
        });
        if (!user) return;
        const flag = mergeSafetyFlag(user.communitySafetyFlag, kind);
        await prisma.user.update({
            where: { id: userId },
            data: {
                communitySafetyFlag: flag,
                communitySafetyFlagAt: new Date(),
                ...(kind === 'NSFW'
                    ? { communityNsfwAttempts: { increment: 1 } }
                    : { communityReportHits: { increment: 1 } }),
            },
        });
        logger.warn('[community-safety-flag]', { userId, kind, flag });
    } catch (err: any) {
        logger.warn('[community-safety-flag] mark failed:', err?.message);
    }
}
