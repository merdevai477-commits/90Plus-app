/**
 * TEMP DEBUG routes — remove after iOS LMT logo diagnosis.
 */
import { Router, Request, Response } from 'express';

const router = Router();

// TEMP DEBUG ENDPOINT - REMOVE AFTER iOS LMT LOGO DIAGNOSIS
router.post('/lmt-log', (req: Request, res: Response): void => {
  console.log('[LMT-REMOTE]', JSON.stringify(req.body));
  res.status(200).json({ ok: true });
});

export default router;
