/**
 * User Search Service with PostgreSQL Full-Text Search
 * 
 * Optimized search using database-level ranking instead of JavaScript ranking
 * Supports both Arabic and English text search
 */

import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

export interface SearchResult {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  isVerified: boolean;
  isDeveloper: boolean;
  level: number;
  favoriteTeam: string | null;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  currentUserId?: string;
}

export class UserSearchService {
  /**
   * Search users using PostgreSQL Full-Text Search
   * 
   * Ranking formula:
   * - Exact match on username: +1000
   * - Starts with on username: +500
   * - Contains on username: +200
   * - Exact match on displayName: +800
   * - Starts with on displayName: +400
   * - Contains on displayName: +150
   * - Verified bonus: +100
   * - Level bonus: +level
   * 
   * Uses both 'english' and 'simple' configurations for better Arabic support
   */
  static async searchUsers(options: SearchOptions): Promise<SearchResult[]> {
    const { query, limit = 10, offset = 0 } = options;
    
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchQuery = query.trim().toLowerCase();
    const searchLimit = Math.min(limit, 20);

    try {
      // Use raw SQL for Full-Text Search with custom ranking
      const results = await prisma.$queryRaw<SearchResult[]>`
        WITH ranked_users AS (
          SELECT 
            u.id,
            u.username,
            u."displayName",
            u.avatar,
            u.bio,
            u."isVerified",
            u."isDeveloper",
            u.level,
            u."favoriteTeam",
            (
              -- Exact match bonuses
              CASE WHEN LOWER(u.username) = ${searchQuery} THEN 1000 ELSE 0 END +
              CASE WHEN LOWER(u."displayName") = ${searchQuery} THEN 800 ELSE 0 END +
              
              -- Starts with bonuses
              CASE WHEN LOWER(u.username) LIKE ${searchQuery + '%'} THEN 500 ELSE 0 END +
              CASE WHEN LOWER(u."displayName") LIKE ${searchQuery + '%'} THEN 400 ELSE 0 END +
              
              -- Contains bonuses
              CASE WHEN LOWER(u.username) LIKE ${'%' + searchQuery + '%'} THEN 200 ELSE 0 END +
              CASE WHEN LOWER(u."displayName") LIKE ${'%' + searchQuery + '%'} THEN 150 ELSE 0 END +
              
              -- Full-Text Search ranking (English)
              ts_rank(
                to_tsvector('english', u.username) || 
                to_tsvector('english', COALESCE(u."displayName", '')),
                plainto_tsquery('english', ${searchQuery})
              ) * 50 +
              
              -- Full-Text Search ranking (Simple - for Arabic)
              ts_rank(
                to_tsvector('simple', u.username) || 
                to_tsvector('simple', COALESCE(u."displayName", '')),
                plainto_tsquery('simple', ${searchQuery})
              ) * 50 +
              
              -- User quality bonuses
              CASE WHEN u."isVerified" = true THEN 100 ELSE 0 END +
              COALESCE(u.level, 0)
            ) AS relevance_score
          FROM users u
          WHERE 
            u."isDeleted" = false
            AND (
              -- Use existing LOWER indexes for fast filtering
              LOWER(u.username) LIKE ${'%' + searchQuery + '%'}
              OR LOWER(u."displayName") LIKE ${'%' + searchQuery + '%'}
              OR 
              -- Full-Text Search match (English)
              (
                to_tsvector('english', u.username) || 
                to_tsvector('english', COALESCE(u."displayName", ''))
              ) @@ plainto_tsquery('english', ${searchQuery})
              OR
              -- Full-Text Search match (Simple - for Arabic)
              (
                to_tsvector('simple', u.username) || 
                to_tsvector('simple', COALESCE(u."displayName", ''))
              ) @@ plainto_tsquery('simple', ${searchQuery})
            )
        )
        SELECT 
          id,
          username,
          "displayName" as "displayName",
          avatar,
          bio,
          "isVerified" as "isVerified",
          "isDeveloper" as "isDeveloper",
          level,
          "favoriteTeam" as "favoriteTeam"
        FROM ranked_users
        WHERE relevance_score > 0
        ORDER BY relevance_score DESC
        LIMIT ${searchLimit}
        OFFSET ${offset}
      `;

      return results;
    } catch (error: any) {
      logger.error('[UserSearchService] Search error:', {
        error: error.message,
        query: searchQuery,
        limit: searchLimit,
      });
      
      // Fallback to simple LIKE search if FTS fails
      return await this.fallbackSearch(searchQuery, searchLimit, offset);
    }
  }

  /**
   * Fallback search using simple LIKE queries
   * Used when Full-Text Search fails
   */
  private static async fallbackSearch(
    query: string,
    limit: number,
    offset: number
  ): Promise<SearchResult[]> {
    logger.warn('[UserSearchService] Using fallback search');

    const users = await prisma.user.findMany({
      where: {
        isDeleted: false,
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        bio: true,
        isVerified: true,
        isDeveloper: true,
        level: true,
        favoriteTeam: true,
      },
      take: limit * 2,
    });

    // JavaScript ranking (same as before)
    const searchQueryLower = query.toLowerCase();
    const rankedUsers = users
      .map((user: any) => {
        const usernameLower = (user.username || '').toLowerCase();
        const displayNameLower = (user.displayName || '').toLowerCase();
        let score = 0;

        if (usernameLower === searchQueryLower) score += 1000;
        else if (usernameLower.startsWith(searchQueryLower)) score += 500;
        else if (usernameLower.includes(searchQueryLower)) score += 200;

        if (displayNameLower === searchQueryLower) score += 800;
        else if (displayNameLower.startsWith(searchQueryLower)) score += 400;
        else if (displayNameLower.includes(searchQueryLower)) score += 150;

        if (user.isVerified) score += 100;
        score += user.level || 0;

        return { ...user, _relevanceScore: score };
      })
      .sort((a: any, b: any) => b._relevanceScore - a._relevanceScore)
      .slice(offset, offset + limit)
      .map(({ _relevanceScore, ...user }: any) => user);

    return rankedUsers;
  }

  /**
   * Search with autocomplete suggestions
   * Returns top 5 most relevant results for autocomplete
   */
  static async autocomplete(query: string): Promise<SearchResult[]> {
    return await this.searchUsers({
      query,
      limit: 5,
      offset: 0,
    });
  }

  /**
   * Get search statistics
   */
  static async getSearchStats(query: string): Promise<{
    totalResults: number;
    hasExactMatch: boolean;
  }> {
    const searchQuery = query.trim().toLowerCase();

    if (!searchQuery) {
      return { totalResults: 0, hasExactMatch: false };
    }

    try {
      const [totalResults, exactMatch] = await Promise.all([
        prisma.user.count({
          where: {
            isDeleted: false,
            OR: [
              { username: { contains: searchQuery, mode: 'insensitive' } },
              { displayName: { contains: searchQuery, mode: 'insensitive' } },
            ],
          },
        }),
        prisma.user.findFirst({
          where: {
            isDeleted: false,
            OR: [
              { username: { equals: searchQuery, mode: 'insensitive' } },
              { displayName: { equals: searchQuery, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
        }),
      ]);

      return {
        totalResults,
        hasExactMatch: !!exactMatch,
      };
    } catch (error: any) {
      logger.error('[UserSearchService] Stats error:', error);
      return { totalResults: 0, hasExactMatch: false };
    }
  }
}
