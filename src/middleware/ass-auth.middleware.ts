import type { Request, Response, NextFunction } from 'express';
import { ASS_COOKIE_NAME, verifyAssSession } from '../services/ass-session.service';

export async function requireAssSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[ASS_COOKIE_NAME] as string | undefined;
  const ok = await verifyAssSession(token);
  if (!ok) {
    res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
    return;
  }
  next();
}
