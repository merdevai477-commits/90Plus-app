import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { cacheService } from '../services/cache.service.js';
import { queueService } from '../services/queue.service.js';
import { aiOrchestrator } from '../services/ai.orchestrator.js';
import { logger } from '../services/logger.service.js';
import { chatRateLimiter } from '../middleware/rateLimit.middleware.js';
import { env } from '../config/env.js';
import { detectCategory } from '../utils/category.utils.js';
import { estimateCostSaved } from '../utils/cost.utils.js';
import { LimitService } from '../services/limit.service.js';

export const chatRouter = Router();
const prisma = new PrismaClient();

// Create a dedicated Redis subscriber for SSE
const subscriber = new Redis(env.REDIS_URL);
// Create a publisher for the worker
const publisher = new Redis(env.REDIS_URL);

/**
 * Worker Processor setup.
 * In a real production app with multiple dynos, this might run on a separate worker process.
 * Here we run it in the same process but it communicates via Redis Pub/Sub.
 */
queueService.startWorker(async (job) => {
  const { question, history, systemPrompt, conversationId } = job.data;
  const channel = `stream:${job.id}`;
  let fullAnswer = '';
  let usedModel = '';

  try {
    const stream = aiOrchestrator.streamChat(question, history, systemPrompt);

    for await (const chunk of stream) {
      if (chunk.modelUsed) {
        usedModel = chunk.modelUsed;
      }
      
      // Publish token to Redis
      await publisher.publish(channel, JSON.stringify(chunk));
      
      if (!chunk.done) {
        fullAnswer += chunk.token;
      }
    }

    // Save to Cache & Analytics after successful completion
    const category = detectCategory(question);
    await cacheService.saveAnswer(question, fullAnswer);
    
    // Create Message in DB
    if (conversationId) {
      await prisma.message.create({
        data: {
          conversationId,
          role: 'ai',
          text: fullAnswer,
          category,
          modelUsed: usedModel,
          fromCache: false,
        }
      });
    }

    // Analytics
    await prisma.analytics.create({
      data: {
        fromCache: false,
        modelUsed: usedModel,
        category,
        costSaved: 0,
      }
    });

  } catch (error: any) {
    logger.error(`❌ Worker failed for job ${job.id}`, error);
    await publisher.publish(channel, JSON.stringify({ 
      token: 'حدث خطأ غير متوقع. حاول مرة أخرى.', 
      done: true 
    }));
    throw error; // Let BullMQ mark it as failed
  }
});


/**
 * GET /api/chat/limit
 * Returns remaining daily messages for the user
 */
chatRouter.get('/limit', async (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(400).json({ error: 'x-user-id header is required' });
  }
  const status = await LimitService.getStatus(userId);
  res.json(status);
});

/**
 * POST /api/chat/stream
 * Streaming endpoint using SSE
 */
chatRouter.post('/stream', chatRateLimiter, async (req: Request, res: Response) => {
  const { conversationId, message, history, systemPrompt = 'أنت مساعد رياضي متخصص.' } = req.body;
  const userId = req.headers['x-user-id'] as string;
  const startTime = Date.now();

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!userId) {
    return res.status(400).json({ error: 'x-user-id is required' });
  }

  // 0. Check User Limit
  const canSend = await LimitService.canSend(userId);
  if (!canSend) {
    const status = await LimitService.getStatus(userId);
    return res.status(429).json({ 
      error: 'انتهت رسائلك اليومية.', 
      resetAt: status.resetAt 
    });
  }

  // Increment limit usage
  await LimitService.increment(userId);

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Ensure headers are sent immediately

  try {
    // 1. Check Cache (Layers 1 & 2)
    const cacheResult = await cacheService.findAnswer(message);
    
    if (cacheResult.source !== 'none') {
      logger.info(`✅ Cache Hit (${cacheResult.source}) for user ${userId}`);
      
      // Stream the cached response artificially to maintain SSE UX
      const words = cacheResult.answer.split(' ');
      for (const word of words) {
        res.write(`data: ${JSON.stringify({ token: word + ' ', done: false })}\n\n`);
        await new Promise(r => setTimeout(r, 20)); // Small delay for visual effect
      }
      res.write(`data: ${JSON.stringify({ token: '', done: true })}\n\n`);
      res.end();

      const responseTime = Date.now() - startTime;
      const category = detectCategory(message);

      // Save user message
      if (conversationId) {
        await prisma.message.create({
          data: { conversationId, role: 'user', text: message, category }
        });
        // Save AI cached message
        await prisma.message.create({
          data: { 
            conversationId, 
            role: 'ai', 
            text: cacheResult.answer, 
            category,
            fromCache: true,
            responseTimeMs: responseTime
          }
        });
      }

      // Analytics
      await prisma.analytics.create({
        data: {
          fromCache: true,
          category,
          responseMs: responseTime,
          costSaved: estimateCostSaved(message, cacheResult.answer),
        }
      });
      return;
    }

    // 2. Cache Miss -> Queue for AI processing
    logger.info(`⏳ Cache Miss. Queuing AI job for user ${userId}`);
    
    // Save User Message instantly
    if (conversationId) {
      await prisma.message.create({
        data: { conversationId, role: 'user', text: message, category: detectCategory(message) }
      });
    }

    const wordCount = message.trim().split(/\s+/).length;
    const priority = wordCount < 5 ? 1 : 2; // High priority (1) for short questions

    const job = await queueService.aiQueue.add('process_chat', {
      userId,
      conversationId,
      question: message,
      history: history || [],
      systemPrompt,
    }, { priority });

    const channel = `stream:${job.id}`;

    // 3. Listen to Pub/Sub for streamed tokens from Worker
    const messageHandler = (ch: string, messageStr: string) => {
      if (ch === channel) {
        const data = JSON.parse(messageStr);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        
        if (data.done) {
          subscriber.unsubscribe(channel);
          subscriber.removeListener('message', messageHandler);
          res.end();
        }
      }
    };

    subscriber.on('message', messageHandler);
    await subscriber.subscribe(channel);

    // Handle client disconnect gracefully
    req.on('close', () => {
      logger.warn(`⚠️ Client disconnected prematurely. Job ${job.id} continues in background.`);
      subscriber.unsubscribe(channel);
      subscriber.removeListener('message', messageHandler);
    });

  } catch (error) {
    logger.error('❌ Chat stream endpoint error', error);
    res.write(`data: ${JSON.stringify({ token: 'حدث خطأ، يرجى المحاولة.', done: true })}\n\n`);
    res.end();
  }
});
