import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { translateFootballNames } from '../services/football-translation.service';

const router = Router();

const bodySchema = z.object({
  texts: z.array(z.string().min(1).max(200)).min(1).max(200),
  targetLang: z.enum(['ar', 'en']).optional().default('ar'),
});

/**
 * POST /api/i18n/football-names
 * Batch translate team/league/country names with server-side cache.
 */
router.post('/football-names', async (req: Request, res: Response) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { texts, targetLang } = parsed.data;
  const translations = await translateFootballNames(texts, targetLang);
  res.json({ translations, targetLang });
});

export default router;
