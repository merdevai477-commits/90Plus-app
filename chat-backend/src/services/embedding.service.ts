import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from './logger.service.js';
import { CONSTANTS } from '../config/constants.js';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_KEY);

export interface SemanticSearchResult {
  id: string;
  question: string;
  answer: string;
  similarity: number;
}

class EmbeddingService {
  /**
   * Generates a 3072-dimensional vector embedding for a given text using Gemini.
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
      const result = await model.embedContent(text.trim());
      return result.embedding.values;
    } catch (error) {
      logger.error('❌ Failed to generate embedding via Gemini', error);
      return null;
    }
  }

  /**
   * Searches the QACache table for similar questions using pgvector cosine similarity.
   * Returns null if no match meets the similarity threshold.
   */
  async findSimilar(embedding: number[], threshold: number = CONSTANTS.CACHE.SIMILARITY_THRESHOLD): Promise<SemanticSearchResult | null> {
    try {
      const vectorString = `[${embedding.join(',')}]`;

      // Perform a raw query to calculate cosine distance (<=>)
      // distance = 0 means identical, distance = 1 means completely orthogonal
      // We convert distance to similarity (1 - distance)
      const results: any[] = await prisma.$queryRaw`
        SELECT 
          id, 
          question, 
          answer, 
          1 - (embedding <=> ${vectorString}::vector) AS similarity
        FROM "QACache"
        WHERE 1 - (embedding <=> ${vectorString}::vector) >= ${threshold}
        ORDER BY similarity DESC
        LIMIT 1;
      `;

      if (results.length > 0) {
        // Log hit and update hitCount in background
        this.updateHitCount(results[0].id).catch(err => logger.error('Failed to update hit count', err));
        
        return {
          id: results[0].id,
          question: results[0].question,
          answer: results[0].answer,
          similarity: parseFloat(results[0].similarity),
        };
      }

      return null;
    } catch (error) {
      logger.error('❌ Failed to execute pgvector search query', error);
      return null;
    }
  }

  /**
   * Saves a new question and answer pair to the database with its vector embedding.
   */
  async saveToCache(question: string, answer: string, category: string, embedding: number[]): Promise<void> {
    try {
      const vectorString = `[${embedding.join(',')}]`;

      await prisma.$executeRaw`
        INSERT INTO "QACache" (
          id, question, answer, category, language, "hitCount", "lastHit", "createdAt", embedding
        ) VALUES (
          gen_random_uuid(), 
          ${question.trim()}, 
          ${answer}, 
          ${category}, 
          'ar', 
          0, 
          NOW(), 
          NOW(), 
          ${vectorString}::vector
        )
        ON CONFLICT (question) DO NOTHING;
      `;
      logger.debug(`✅ Saved to pgvector cache: "${question.substring(0, 30)}..."`);
    } catch (error) {
      logger.error('❌ Failed to save new entry to pgvector', error);
    }
  }

  /**
   * Helper to increment the hit count for analytics
   */
  private async updateHitCount(id: string) {
    await prisma.$executeRaw`
      UPDATE "QACache"
      SET "hitCount" = "hitCount" + 1, "lastHit" = NOW()
      WHERE id = ${id}
    `;
  }
}

export const embeddingService = new EmbeddingService();
