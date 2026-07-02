/**
 * Resolve quiz player photos via 365Scores search (same source as /cached/365/player/lookup).
 */

import { threeSixFiveScoresService } from './threeSixFiveScores.service';
import { buildScores365AthletePhotoUrl } from '../utils/scores365-athlete-photo';
import { logger } from '../utils/logger';
import {
  normalizeName,
  scoreEntityNameMatch,
  scorePlayerMatch,
} from './quiz-name-match.util';

export interface Quiz365PlayerMatch {
  athleteId: number;
  name: string;
  clubName: string | null;
  imageUrl: string;
  score: number;
}

function normalizeClub(name: string | undefined | null): string {
  return normalizeName(name ?? '');
}

export async function resolve365QuizPlayerImage(options: {
  entityName: string;
  teamName?: string;
  correctAnswerText?: string;
  targetNames?: string[];
}): Promise<Quiz365PlayerMatch | null> {
  const query = options.entityName?.trim();
  if (!query || query.length < 2) return null;

  try {
    const search = await threeSixFiveScoresService.searchAthletes(query, 'en');
    const athletes = search.data ?? [];
    if (!athletes.length) return null;

    const targetNames =
      options.targetNames?.length
        ? options.targetNames
        : [normalizeName(query)];
    const teamNorm = normalizeClub(options.teamName);
    const correctAnswer = options.correctAnswerText?.trim() ?? '';

    let best: Quiz365PlayerMatch | null = null;

    for (const athlete of athletes) {
      const pseudoPlayer = {
        name: athlete.name,
        lastname: athlete.shortName,
      };
      let score = scorePlayerMatch(query, targetNames, pseudoPlayer);

      if (teamNorm && athlete.clubName) {
        const clubScore = scoreEntityNameMatch(options.teamName ?? '', athlete.clubName);
        if (clubScore >= 0.72) score = Math.min(1, score + 0.08);
        else if (clubScore < 0.45) score *= 0.75;
      }

      if (correctAnswer) {
        const answerScore = scoreEntityNameMatch(correctAnswer, athlete.name);
        if (answerScore < 0.78) score *= 0.55;
        else score = Math.max(score, answerScore);
      }

      const imageUrl =
        athlete.imageUrl ??
        buildScores365AthletePhotoUrl(athlete.athleteId, athlete.imageVersion ?? 68);

      if (!best || score > best.score) {
        best = {
          athleteId: athlete.athleteId,
          name: athlete.name,
          clubName: athlete.clubName,
          imageUrl,
          score,
        };
      }
    }

    if (best) {
      logger.info(
        `[Quiz365] "${query}" -> athleteId=${best.athleteId} (${best.name}) score=${best.score.toFixed(2)}`,
      );
    }
    return best;
  } catch (err: unknown) {
    logger.warn('[Quiz365] player lookup failed:', (err as Error)?.message);
    return null;
  }
}
