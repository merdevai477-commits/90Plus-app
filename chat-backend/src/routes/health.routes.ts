import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { redisService } from '../services/redis.service.js';
import { env } from '../config/env.js';

export const healthRouter = Router();
const prisma = new PrismaClient();

healthRouter.get('/', async (req: Request, res: Response) => {
  let dbStatus = 'error';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'error';
  }

  const redisStatus = redisService.isConnected ? 'connected' : 'error';

  const groqStatus = env.GROQ_API_KEY ? 'available' : 'unavailable';
  const openRouterStatus = env.OPENROUTER_API_KEY ? 'available' : 'unavailable';

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
      ai_providers: {
        groq: groqStatus,
        openrouter: openRouterStatus,
      },
    },
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage().heapUsed / 1024 / 1024, // in MB
    },
  });
});
