import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

const CURRENT_TERMS_VERSION = '1.0';

export class TermsService {
  /**
   * Get the latest terms of service
   */
  static async getLatestTerms(): Promise<{ version: string; content: string }> {
    try {
      // Read terms content from file
      const termsPath = path.join(__dirname, '../data/terms-of-service-v1.0.md');
      const content = await fs.readFile(termsPath, 'utf-8');

      return {
        version: CURRENT_TERMS_VERSION,
        content,
      };
    } catch (error) {
      logger.error('Error reading terms of service:', error);
      throw new Error('Failed to load terms of service');
    }
  }

  /**
   * Record user acceptance of terms
   */
  static async recordAcceptance(
    userId: string,
    version: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await prisma.termsAcceptance.upsert({
        where: {
          userId_version: {
            userId,
            version,
          },
        },
        update: {
          acceptedAt: new Date(),
          ipAddress,
          userAgent,
        },
        create: {
          userId,
          version,
          ipAddress,
          userAgent,
        },
      });

      logger.info(`User ${userId} accepted terms version ${version}`);
    } catch (error) {
      logger.error('Error recording terms acceptance:', error);
      throw new Error('Failed to record terms acceptance');
    }
  }

  /**
   * Check if user has accepted the latest terms
   */
  static async hasAcceptedLatestTerms(userId: string): Promise<boolean> {
    try {
      const acceptance = await prisma.termsAcceptance.findUnique({
        where: {
          userId_version: {
            userId,
            version: CURRENT_TERMS_VERSION,
          },
        },
      });

      return !!acceptance;
    } catch (error) {
      logger.error('Error checking terms acceptance:', error);
      return false;
    }
  }

  /**
   * Get user's acceptance history
   */
  static async getUserAcceptanceHistory(userId: string) {
    try {
      const acceptances = await prisma.termsAcceptance.findMany({
        where: { userId },
        orderBy: { acceptedAt: 'desc' },
      });

      return acceptances;
    } catch (error) {
      logger.error('Error fetching acceptance history:', error);
      throw new Error('Failed to fetch acceptance history');
    }
  }

  /**
   * Get current terms version
   */
  static getCurrentVersion(): string {
    return CURRENT_TERMS_VERSION;
  }
}
