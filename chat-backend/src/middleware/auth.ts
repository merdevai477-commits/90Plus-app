import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export interface AuthRequest extends Request {
  userId?: string
}

interface JwtPayload {
  userId: string
  iat: number
  exp: number
}

import { prisma } from '../config/database.js';

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const guestId = req.headers['x-user-id'] as string;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      req.userId = payload.userId;
      return next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      } else {
        res.status(401).json({ error: 'Invalid token' });
      }
      return;
    }
  }

  // Fallback to x-user-id for guest users
  if (guestId) {
    req.userId = guestId;
    
    // Ensure the guest user exists in the database synchronously for the request
    // This prevents foreign key constraint errors when creating conversations
    try {
      await prisma.user.upsert({
        where: { id: guestId },
        create: { 
          id: guestId, 
          email: `${guestId}@guest.local`, 
          name: 'Guest', 
          passwordHash: 'none' 
        },
        update: {}
      });
    } catch (err) {
      console.error('Failed to upsert guest user:', err);
    }

    return next();
  }

  res.status(401).json({ error: 'Unauthorized — missing token or x-user-id' });
}

export function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload
}
