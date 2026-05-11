import { redisService } from './redis.service.js';
import { embeddingService } from './embedding.service.js';
import { hashQuestion } from '../utils/hash.utils.js';
import { detectCategory } from '../utils/category.utils.js';
import { logger } from './logger.service.js';
import { CONSTANTS } from '../config/constants.js';

export interface CacheResult {
  answer: string;
  source: 'redis' | 'pgvector' | 'none';
  similarity: number;
}

class CacheService {
  /**
   * Evaluates the 3-layer cache:
   * 1. Redis exact match (O(1) time)
   * 2. pgvector semantic search (High similarity threshold)
   * 3. Fallback to AI (handled by orchestrator outside this service)
   */
  async findAnswer(question: string): Promise<CacheResult> {
    const qHash = hashQuestion(question);
    const redisKey = `qa:${qHash}`;

    // ─── Layer 1: Redis Exact Match ───────────────────────────────────────────
    const redisAnswer = await redisService.get(redisKey);
    if (redisAnswer) {
      logger.debug(`⚡ Redis Hit (Exact Match) for: "${question.substring(0, 30)}..."`);
      return {
        answer: redisAnswer,
        source: 'redis',
        similarity: 1.0,
      };
    }

    // ─── Layer 2: pgvector Semantic Search ────────────────────────────────────
    const embedding = await embeddingService.generateEmbedding(question);
    
    if (embedding) {
      const pgMatch = await embeddingService.findSimilar(embedding, CONSTANTS.CACHE.SIMILARITY_THRESHOLD);
      
      if (pgMatch) {
        logger.debug(`🧠 pgvector Hit (Similarity: ${pgMatch.similarity.toFixed(2)}) for: "${question.substring(0, 30)}..."`);
        
        // Cache this semantic hit in Redis for future exact matches of this specific question phrasing
        await redisService.set(redisKey, pgMatch.answer, CONSTANTS.CACHE.QA_TTL_SECONDS);
        
        return {
          answer: pgMatch.answer,
          source: 'pgvector',
          similarity: pgMatch.similarity,
        };
      }
    }

    // ─── Layer 3: No Cache Hit ────────────────────────────────────────────────
    logger.debug(`❌ Cache Miss for: "${question.substring(0, 30)}..."`);
    return {
      answer: '',
      source: 'none',
      similarity: 0.0,
    };
  }

  /**
   * Saves an AI-generated answer to both PostgreSQL (pgvector) and Redis.
   */
  async saveAnswer(question: string, answer: string): Promise<void> {
    // Don't cache very short answers or generic errors
    if (answer.length < 20 || answer.includes('عذراً، حدث خطأ')) return;

    const category = detectCategory(question);
    const qHash = hashQuestion(question);
    const redisKey = `qa:${qHash}`;

    // 1. Save to Redis for exact match
    await redisService.set(redisKey, answer, CONSTANTS.CACHE.QA_TTL_SECONDS);

    // 2. Generate embedding and save to pgvector for semantic match
    const embedding = await embeddingService.generateEmbedding(question);
    if (embedding) {
      await embeddingService.saveToCache(question, answer, category, embedding);
    }
  }
}

export const cacheService = new CacheService();
