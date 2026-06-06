/**
 * Support Routes
 * صفحات الدعم والمساعدة
 */

import path from 'path';
import { Router, Request, Response } from 'express';
import {
    buildProfileLandingPage,
    buildReelLandingPage,
} from '../utils/share-landing-pages';

const PRIVACY_PAGE_PATH = path.join(__dirname, '../../public/privacy.html');
const SUPPORT_PAGE_PATH = path.join(__dirname, '../../public/support.html');

const router = Router();

/**
 * GET /support
 * صفحة الدعم — ثيم قانوني موحّد (public/support.html)
 */
router.get('/support', (_req: Request, res: Response): void => {
    res.sendFile(SUPPORT_PAGE_PATH, (err) => {
        if (err) {
            res.status(500).send('تعذّر تحميل صفحة الدعم');
        }
    });
});

/**
 * GET /privacy
 * صفحة سياسة الخصوصية — ثيم قانوني موحّد (public/privacy.html)
 */
router.get('/privacy', (_req: Request, res: Response): void => {
    res.sendFile(PRIVACY_PAGE_PATH, (err) => {
        if (err) {
            res.status(500).send('تعذّر تحميل صفحة سياسة الخصوصية');
        }
    });
});

/**
 * GET /reels/:reelId
 * Reel share — app installed → open reel; otherwise → store
 */
router.get('/reels/:reelId', (req: Request, res: Response): void => {
    const reelId = ensureString(req.params.reelId);
    res.type('html').send(buildReelLandingPage(reelId));
});

/**
 * GET /@:username
 * Profile share — app installed → open profile; otherwise → store
 */
router.get('/@:username', (req: Request, res: Response): void => {
    const raw = ensureString(req.params.username);
    const username = raw.replace(/^@/, '').trim();
    if (!/^[a-zA-Z0-9_]{1,64}$/.test(username)) {
        res.status(404).type('html').send('<!DOCTYPE html><html><body><p>Profile not found</p></body></html>');
        return;
    }

    res.type('html').send(buildProfileLandingPage(username));
});

function ensureString(param: string | string[] | undefined): string {
    if (Array.isArray(param)) return param[0];
    return param || '';
}

export default router;
