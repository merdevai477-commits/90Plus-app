/**
 * Support Routes
 * صفحات الدعم والمساعدة
 */

import { Router, Request, Response } from 'express';
import {
    SHARE_LANDING_CSP,
    buildProfileLandingPage,
    buildReelLandingPage,
    buildReferralLandingPage,
} from '../utils/share-landing-pages';
import { resolvePublicFile } from '../utils/public-path.util';

const PRIVACY_PAGE_PATH = resolvePublicFile(__dirname, 'privacy.html');
const SUPPORT_PAGE_PATH = resolvePublicFile(__dirname, 'support.html');

const router = Router();

function sendShareLanding(res: Response, html: string): void {
    // Override Helmet's script-src 'self' so the inline opener (and visible
    // store buttons) actually run when a QR / share link lands in a browser.
    res.setHeader('Content-Security-Policy', SHARE_LANDING_CSP);
    res.type('html').send(html);
}

function sendProfileLanding(req: Request, res: Response): void {
    const raw = ensureString(req.params.username);
    const username = raw.replace(/^@/, '').trim();
    if (!/^[a-zA-Z0-9_]{1,64}$/.test(username)) {
        res.status(404).type('html').send('<!DOCTYPE html><html><body><p>Profile not found</p></body></html>');
        return;
    }

    sendShareLanding(res, buildProfileLandingPage(username));
}

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
    sendShareLanding(res, buildReelLandingPage(reelId));
});

/**
 * GET /u/:username  (canonical profile share — chat-safe)
 * GET /@:username   (legacy QR / older shares)
 * Profile share — app installed → open profile; otherwise → store
 */
router.get('/u/:username', sendProfileLanding);
router.get('/@:username', sendProfileLanding);

/**
 * GET /invite/:code  (alias: /ref/:code)
 * Share & Win referral link — app installed → open with the code; otherwise →
 * store, and the code is picked up on first launch.
 */
function handleReferralLanding(req: Request, res: Response): void {
    const raw = ensureString(req.params.code).trim().toUpperCase();
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(raw)) {
        res.status(404).type('html').send('<!DOCTYPE html><html><body><p>Invite not found</p></body></html>');
        return;
    }

    sendShareLanding(res, buildReferralLandingPage(raw));
}

router.get('/invite/:code', handleReferralLanding);
router.get('/ref/:code', handleReferralLanding);

function ensureString(param: string | string[] | undefined): string {
    if (Array.isArray(param)) return param[0];
    return param || '';
}

export default router;
