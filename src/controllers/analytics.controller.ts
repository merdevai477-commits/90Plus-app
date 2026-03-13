import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export class AnalyticsController {
  /**
   * GET /api/analytics/me - جلب تحليلات المستخدم الحالي
   */
  static async getMyAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      // Get all user's reels with stats
      const reels = await prisma.reel.findMany({
        where: { userId: user.id },
        include: {
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      });

      // Calculate totals
      const totalViews = reels.reduce((sum, r) => sum + r.views, 0);
      const totalLikes = reels.reduce((sum, r) => sum + r._count.likes, 0);
      const totalComments = reels.reduce((sum, r) => sum + r._count.comments, 0);
      const totalVideos = reels.length;

      // Calculate averages
      const avgViews = totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0;
      const avgLikes = totalVideos > 0 ? Math.round(totalLikes / totalVideos) : 0;
      const avgComments = totalVideos > 0 ? Math.round(totalComments / totalVideos) : 0;
      const avgEngagement = totalVideos > 0 ? Math.round((totalLikes + totalComments) / totalVideos) : 0;

      // Get engagement rate (likes + comments / views * 100)
      const engagementRate = totalViews > 0 
        ? ((totalLikes + totalComments) / totalViews * 100).toFixed(2) 
        : '0.00';

      // Get top performing video
      const topVideo = reels.length > 0
        ? reels.reduce((top, current) => {
            const currentScore = current.views + current._count.likes * 2 + current._count.comments * 3;
            const topScore = top.views + top._count.likes * 2 + top._count.comments * 3;
            return currentScore > topScore ? current : top;
          })
        : null;

      // Get recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentLikes = await prisma.like.count({
        where: {
          reel: { userId: user.id },
          createdAt: { gte: sevenDaysAgo },
        },
      });

      const recentComments = await prisma.comment.count({
        where: {
          reel: { userId: user.id },
          createdAt: { gte: sevenDaysAgo },
        },
      });

      const recentFollowers = await prisma.follow.count({
        where: {
          followingId: user.id,
          createdAt: { gte: sevenDaysAgo },
        },
      });

      // Get video performance breakdown
      const videoPerformance = reels.map((r) => ({
        id: r.id,
        thumbnail: r.thumbnail,
        caption: r.caption?.substring(0, 50),
        views: r.views,
        likes: r._count.likes,
        comments: r._count.comments,
        engagement: r.views > 0 
          ? ((r._count.likes + r._count.comments) / r.views * 100).toFixed(2)
          : '0.00',
        createdAt: r.createdAt,
      })).sort((a, b) => b.views - a.views);

      res.json({
        status: 'SUCCESS',
        data: {
          overview: {
            totalVideos,
            totalViews,
            totalLikes,
            totalComments,
            engagementRate: `${engagementRate}%`,
          },
          averages: {
            avgViews,
            avgLikes,
            avgComments,
            avgEngagement,
          },
          recentActivity: {
            period: 'Last 7 days',
            likes: recentLikes,
            comments: recentComments,
            newFollowers: recentFollowers,
          },
          topVideo: topVideo
            ? {
                id: topVideo.id,
                thumbnail: topVideo.thumbnail,
                views: topVideo.views,
                likes: topVideo._count.likes,
                comments: topVideo._count.comments,
              }
            : null,
          videoPerformance: videoPerformance.slice(0, 10), // Top 10 videos
        },
      });
    } catch (error) {
      logger.error('Get analytics error:', error);
      res.status(500).json({ status: 'ERROR', message: 'Failed to get analytics' });
    }
  }

  /**
   * GET /api/analytics/video/:id - تحليلات فيديو معين
   */
static async getVideoAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;
      const id = req.params.id as string;

      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      const reel = await prisma.reel.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
          likes: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
              user: {
                select: {
                  username: true,
                  avatar: true,
                },
              },
            },
          },
          comments: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
              user: {
                select: {
                  username: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });

      if (!reel) {
        res.status(404).json({ status: 'ERROR', message: 'Video not found' });
        return;
      }

      if (reel.userId !== user.id) {
        res.status(403).json({ status: 'ERROR', message: 'Not authorized to view analytics' });
        return;
      }

      const engagementRate = reel.views > 0
        ? ((reel._count.likes + reel._count.comments) / reel.views * 100).toFixed(2)
        : '0.00';

      res.json({
        status: 'SUCCESS',
        data: {
          id: reel.id,
          thumbnail: reel.thumbnail,
          caption: reel.caption,
          createdAt: reel.createdAt,
          stats: {
            views: reel.views,
            likes: reel._count.likes,
            comments: reel._count.comments,
            engagementRate: `${engagementRate}%`,
          },
          recentLikes: reel.likes.map((l) => ({
            username: l.user.username,
            avatar: l.user.avatar,
            at: l.createdAt,
          })),
          recentComments: reel.comments.map((c) => ({
            username: c.user.username,
            avatar: c.user.avatar,
            content: c.content,
            at: c.createdAt,
          })),
        },
      });
    } catch (error) {
      logger.error('Get video analytics error:', error);
      res.status(500).json({ status: 'ERROR', message: 'Failed to get video analytics' });
    }
  }}