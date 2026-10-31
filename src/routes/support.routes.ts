/**
 * Support Routes
 * صفحات الدعم والمساعدة
 */

import { Router, Request, Response } from 'express';
import {
    REFERRAL_SIGNUP_CSP,
    SHARE_LANDING_CSP,
    buildProfileLandingPage,
    buildReelLandingPage,
    buildReferralLandingPage,
} from '../utils/share-landing-pages';
import { resolvePublicFile } from '../utils/public-path.util';
import { getClientIp } from '../utils/client-ip';
import { recordInviteClick } from '../services/share-win-invite-click.service';
import { logger } from '../utils/logger';

const PRIVACY_PAGE_PATH = resolvePublicFile(__dirname, 'privacy.html');
const SUPPORT_PAGE_PATH = resolvePublicFile(__dirname, 'support.html');

const router = Router();

function sendShareLanding(res: Response, html: string, csp: string = SHARE_LANDING_CSP): void {
    // Override Helmet's script-src 'self' so the inline opener (and visible
    // store buttons) actually run when a QR / share link lands in a browser.
    res.setHeader('Content-Security-Policy', csp);
    res.type('html').send(html);
}

function sendProfileLanding(req: Request, res: Response): void {
    const username = ensureString(req.params.username);
    sendShareLanding(res, buildProfileLandingPage(username));
}

router.get('/privacy', (_req: Request, res: Response) => {
    res.sendFile(PRIVACY_PAGE_PATH);
});

router.get('/support', (_req: Request, res: Response) => {
    res.sendFile(SUPPORT_PAGE_PATH);
});

router.get('/reels/:reelId', (req: Request, res: Response) => {
    const reelId = ensureString(req.params.reelId);
    sendShareLanding(res, buildReelLandingPage(reelId));
});

/**
 * GET /u/:username  (canonical profile share — chat-safe)
 * GET /@:username   (legacy QR / older shares)
 */
router.get('/u/:username', sendProfileLanding);
router.get('/@:username', sendProfileLanding);

/**
 * GET /invite/:code  (alias: /ref/:code)
 * Creates a durable click_id, then serves the signup or store landing with it.
 */
async function handleReferralLanding(req: Request, res: Response): Promise<void> {
    const raw = ensureString(req.params.code).trim().toUpperCase();
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(raw)) {
        res.status(404).type('html').send('<!DOCTYPE html><html><body><p>Invite not found</p></body></html>');
        return;
    }

    const ua = req.headers['user-agent'];
    const ip = getClientIp(req);

    let clickId: string | null = null;
    try {
        const click = await recordInviteClick({
            code: raw,
            userAgent: typeof ua === 'string' ? ua : undefined,
            ip,
        });
        clickId = click?.clickId ?? null;
    } catch (err) {
        logger.error('[ShareWin] invite click record failed on landing:', err);
    }

    const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY?.trim() || '';
    sendShareLanding(
        res,
        buildReferralLandingPage(raw, { clerkPublishableKey, clickId }),
        clerkPublishableKey ? REFERRAL_SIGNUP_CSP : SHARE_LANDING_CSP,
    );
}

router.get('/invite/:code', handleReferralLanding);
router.get('/ref/:code', handleReferralLanding);

function ensureString(param: string | string[] | undefined): string {
    if (Array.isArray(param)) return param[0];
    return param || '';
}

export default router;
