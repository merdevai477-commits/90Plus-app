/**
 * /api/community — Threads-style feed (المجتمع).
 * Thin HTTP layer; all rules live in community.service.
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/clerk.middleware';
import { validateUploadMagicBytes } from '../middleware/validateUpload.middleware';
import { validateUploadedImage } from '../middleware/image-moderation.middleware';
import { lenientLimiter, writeLimiter } from '../middleware/rateLimit.middleware';
import { logger } from '../utils/logger';
import * as community from '../services/community.service';
import { CommunityError, resolveActor, type CommunityActor } from '../services/community.service';

const router = Router();

const uploadImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, Boolean(file.mimetype?.startsWith('image/'))),
});

type AuthedHandler = (req: Request, res: Response, actor: CommunityActor) => Promise<unknown>;

function handle(fn: AuthedHandler) {
    return async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
        try {
            const clerkUserId = req.auth?.userId;
            if (!clerkUserId) {
                res.status(401).json({ status: 'ERROR', code: 'UNAUTHORIZED', message: 'Unauthorized' });
                return;
            }
            const actor = await resolveActor(clerkUserId);
            const data = await fn(req, res, actor);
            if (!res.headersSent) res.json({ status: 'SUCCESS', data });
        } catch (err: any) {
            if (err instanceof CommunityError) {
                if (typeof err.extra.retryAfterSec === 'number' && err.extra.retryAfterSec > 0) {
                    res.setHeader('X-Retry-After', String(err.extra.retryAfterSec));
                }
                res.status(err.status).json({ status: 'ERROR', code: err.code, message: err.message, ...err.extra });
                return;
            }
            logger.error('[community] request failed', { path: req.originalUrl, err: err?.message, stack: err?.stack });
            res.status(500).json({ status: 'ERROR', code: 'INTERNAL', message: 'Something went wrong' });
        }
    };
}

const param = (req: Request, key: string) => String(req.params[key] ?? '');

// ─── Feed ─────────────────────────────────────────────────────────────────

router.get('/feed', requireAuth, lenientLimiter, handle((req, _res, actor) => community.getFeed(actor.id, req.query.cursor)));

router.get('/trending', requireAuth, lenientLimiter, handle(() => community.getTrendingHashtags()));

router.get(
    '/hashtags/:tag/posts',
    requireAuth,
    lenientLimiter,
    handle((req, _res, actor) => community.getHashtagPosts(actor.id, param(req, 'tag'), req.query.cursor)),
);

router.get(
    '/users/:username/posts',
    requireAuth,
    lenientLimiter,
    handle((req, _res, actor) => community.getUserPosts(actor.id, param(req, 'username'), req.query.cursor)),
);

router.get(
    '/mentions/search',
    requireAuth,
    lenientLimiter,
    handle((req, _res, actor) => community.searchMentionUsers(actor.id, String(req.query.q ?? '').slice(0, 30))),
);

// ─── Media ────────────────────────────────────────────────────────────────

router.post(
    '/media',
    requireAuth,
    writeLimiter,
    uploadImage.single('image'),
    validateUploadMagicBytes,
    validateUploadedImage,
    handle(async (req, _res, actor) => {
        if (!req.file?.buffer?.length) throw new CommunityError(400, 'NO_FILE', 'No image provided');
        return community.uploadMedia(actor, req.file);
    }),
);

// ─── Posts ────────────────────────────────────────────────────────────────

router.post('/posts', requireAuth, writeLimiter, handle((req, _res, actor) => community.createPost(actor, req.body ?? {})));

router.get('/posts/:id', requireAuth, lenientLimiter, handle((req, _res, actor) => community.getPost(actor.id, param(req, 'id'))));

router.patch(
    '/posts/:id',
    requireAuth,
    writeLimiter,
    handle((req, _res, actor) => community.updatePost(actor, param(req, 'id'), req.body ?? {})),
);

router.delete(
    '/posts/:id',
    requireAuth,
    writeLimiter,
    handle(async (req, _res, actor) => {
        await community.deletePost(actor, param(req, 'id'));
        return { deleted: true };
    }),
);

router.post('/posts/:id/like', requireAuth, handle((req, _res, actor) => community.likePost(actor, param(req, 'id'))));
router.delete('/posts/:id/like', requireAuth, handle((req, _res, actor) => community.unlikePost(actor, param(req, 'id'))));

router.post(
    '/posts/:id/vote',
    requireAuth,
    writeLimiter,
    handle((req, _res, actor) => community.votePoll(actor, param(req, 'id'), req.body?.choice)),
);

router.post(
    '/posts/:id/share',
    requireAuth,
    writeLimiter,
    handle((req, _res, actor) => community.sharePost(actor, param(req, 'id'), req.body?.platform)),
);

router.post(
    '/posts/:id/report',
    requireAuth,
    writeLimiter,
    handle((req, _res, actor) => community.reportContent(actor, 'post', param(req, 'id'), req.body ?? {})),
);

// ─── Comments ─────────────────────────────────────────────────────────────

router.get(
    '/posts/:id/comments',
    requireAuth,
    lenientLimiter,
    handle((req, _res, actor) => community.getComments(actor.id, param(req, 'id'), req.query.cursor)),
);

router.post(
    '/posts/:id/comments',
    requireAuth,
    writeLimiter,
    handle((req, _res, actor) => community.createComment(actor, param(req, 'id'), req.body ?? {})),
);

router.get(
    '/comments/:id/replies',
    requireAuth,
    lenientLimiter,
    handle((req, _res, actor) => community.getReplies(actor.id, param(req, 'id'), req.query.cursor)),
);

router.delete(
    '/comments/:id',
    requireAuth,
    writeLimiter,
    handle(async (req, _res, actor) => {
        await community.deleteComment(actor, param(req, 'id'));
        return { deleted: true };
    }),
);

router.post('/comments/:id/like', requireAuth, handle((req, _res, actor) => community.likeComment(actor, param(req, 'id'))));
router.delete('/comments/:id/like', requireAuth, handle((req, _res, actor) => community.unlikeComment(actor, param(req, 'id'))));

router.post(
    '/comments/:id/report',
    requireAuth,
    writeLimiter,
    handle((req, _res, actor) => community.reportContent(actor, 'comment', param(req, 'id'), req.body ?? {})),
);

export default router;
