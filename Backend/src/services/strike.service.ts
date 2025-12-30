import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export enum StrikeType {
    CONTENT_VIOLATION = 'CONTENT_VIOLATION',
    USER_VIOLATION = 'USER_VIOLATION',
    SPAM = 'SPAM',
    HARASSMENT = 'HARASSMENT',
    COPYRIGHT = 'COPYRIGHT',
    INAPPROPRIATE = 'INAPPROPRIATE',
    OTHER = 'OTHER',
}

export interface StrikeThresholds {
    contentAutoDelete: number; // 5 strikes
    userSuspension: number; // 10 strikes
}

const DEFAULT_THRESHOLDS: StrikeThresholds = {
    contentAutoDelete: 5,
    userSuspension: 10,
};

export class StrikeService {
    /**
     * Add a strike to a user/content
     */
    static async addStrike(params: {
        userId: string;
        reportId: string;
        reportedReelId?: string;
        reportedCommentId?: string;
        strikeType: StrikeType;
        reason: string;
    }) {
        try {
            const strike = await prisma.strike.create({
                data: {
                    userId: params.userId,
                    reportId: params.reportId,
                    reportedReelId: params.reportedReelId || null,
                    reportedCommentId: params.reportedCommentId || null,
                    strikeType: params.strikeType as any,
                    reason: params.reason,
                },
            });

            logger.info(`Strike created: ${strike.id} for user ${params.userId}`);

            return strike;
        } catch (error) {
            logger.error('Error adding strike:', error);
            throw error;
        }
    }

    /**
     * Get all strikes for a user
     */
    static async getUserStrikes(userId: string) {
        try {
            const strikes = await prisma.strike.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                include: {
                    report: {
                        select: {
                            id: true,
                            type: true,
                            status: true,
                            createdAt: true,
                        },
                    },
                },
            });

            return strikes;
        } catch (error) {
            logger.error('Error getting user strikes:', error);
            throw error;
        }
    }

    /**
     * Get strikes for specific content (reel or comment)
     */
    static async getContentStrikes(contentId: string, contentType: 'reel' | 'comment') {
        try {
            const whereClause =
                contentType === 'reel'
                    ? { reportedReelId: contentId }
                    : { reportedCommentId: contentId };

            const strikes = await prisma.strike.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                include: {
                    report: {
                        select: {
                            id: true,
                            type: true,
                            status: true,
                            createdAt: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            username: true,
                        },
                    },
                },
            });

            return strikes;
        } catch (error) {
            logger.error('Error getting content strikes:', error);
            throw error;
        }
    }

    /**
     * Get strike count for a user
     */
    static async getUserStrikeCount(userId: string): Promise<number> {
        try {
            const count = await prisma.strike.count({
                where: { userId },
            });

            return count;
        } catch (error) {
            logger.error('Error getting user strike count:', error);
            throw error;
        }
    }

    /**
     * Get strike count for specific content
     */
    static async getContentStrikeCount(
        contentId: string,
        contentType: 'reel' | 'comment'
    ): Promise<number> {
        try {
            const whereClause =
                contentType === 'reel'
                    ? { reportedReelId: contentId }
                    : { reportedCommentId: contentId };

            const count = await prisma.strike.count({
                where: whereClause,
            });

            return count;
        } catch (error) {
            logger.error('Error getting content strike count:', error);
            throw error;
        }
    }

    /**
     * Check if thresholds are reached
     */
    static async checkThresholds(
        userId: string,
        contentId?: string,
        contentType?: 'reel' | 'comment',
        thresholds: StrikeThresholds = DEFAULT_THRESHOLDS
    ): Promise<{
        contentThresholdReached: boolean;
        userThresholdReached: boolean;
        contentStrikeCount: number;
        userStrikeCount: number;
    }> {
        try {
            const [userStrikeCount, contentStrikeCount] = await Promise.all([
                this.getUserStrikeCount(userId),
                contentId && contentType
                    ? this.getContentStrikeCount(contentId, contentType)
                    : Promise.resolve(0),
            ]);

            const contentThresholdReached =
                contentId && contentStrikeCount >= thresholds.contentAutoDelete;
            const userThresholdReached = userStrikeCount >= thresholds.userSuspension;

            return {
                contentThresholdReached,
                userThresholdReached,
                contentStrikeCount,
                userStrikeCount,
            };
        } catch (error) {
            logger.error('Error checking thresholds:', error);
            throw error;
        }
    }

    /**
     * Map ReportType to StrikeType
     */
    static mapReportTypeToStrikeType(reportType: string): StrikeType {
        const mapping: Record<string, StrikeType> = {
            SPAM: StrikeType.SPAM,
            HARASSMENT: StrikeType.HARASSMENT,
            INAPPROPRIATE: StrikeType.INAPPROPRIATE,
            COPYRIGHT: StrikeType.COPYRIGHT,
            FAKE_INFO: StrikeType.CONTENT_VIOLATION,
            OTHER: StrikeType.OTHER,
        };

        return mapping[reportType] || StrikeType.CONTENT_VIOLATION;
    }
}

