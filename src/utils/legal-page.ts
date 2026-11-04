import fs from 'fs';
import type { Request, Response } from 'express';
import { logger } from './logger';

const HTML_OPEN = '<html lang="en" dir="ltr" data-lang="en">';

/**
 * Public legal HTML. `?lang=ar` or `?lang=en` is applied in the document
 * element so the correct language is visible even when JavaScript is off.
 */
export function sendLegalPage(req: Request, res: Response, filePath: string): void {
    const requested = typeof req.query.lang === 'string' ? req.query.lang : '';
    const lang = requested === 'ar' || requested === 'en' ? requested : null;

    res.set('Cache-Control', 'public, max-age=300');
    res.set('X-Robots-Tag', 'index, follow');

    if (!lang) {
        res.sendFile(filePath, (err) => {
            if (err) {
                logger.error(`Failed to send legal page ${filePath}:`, err);
                if (!res.headersSent) {
                    res.status(404).type('html').send('90Plus');
                }
            }
        });
        return;
    }

    fs.readFile(filePath, 'utf8', (err, html) => {
        if (err || !html) {
            logger.error(`Failed to read legal page ${filePath}:`, err);
            if (!res.headersSent) {
                res.status(404).type('html').send('90Plus');
            }
            return;
        }

        const dir = lang === 'ar' ? 'rtl' : 'ltr';
        const localized = html.replace(
            HTML_OPEN,
            `<html lang="${lang}" dir="${dir}" data-lang="${lang}">`,
        );
        res.type('html').send(localized);
    });
}
