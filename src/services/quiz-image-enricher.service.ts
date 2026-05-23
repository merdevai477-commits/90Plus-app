/**
 * Attaches API-Football media URLs to generated quiz questions.
 */

import { footballService } from './football.service';
import { logger } from '../utils/logger';
import type { StoredQuizQuestion } from '../types/quiz.types';

function pickLogo(fixtures: any[], type: string, index: number): string | null {
  const f = fixtures[index % fixtures.length];
  if (!f) return null;
  switch (type) {
    case 'team':
    case 'club':
      return f.teams?.home?.logo ?? f.teams?.away?.logo ?? null;
    case 'league':
      return f.league?.logo ?? null;
    case 'flag':
      return f.league?.flag ?? f.teams?.home?.logo ?? null;
    default:
      return f.teams?.home?.logo ?? null;
  }
}

export async function enrichQuizImages(
  questions: StoredQuizQuestion[],
  dateStr: string,
): Promise<StoredQuizQuestion[]> {
  if (!footballService.isConfigured()) {
    return questions;
  }

  try {
    const fixtures = await footballService.getFixtures({ date: dateStr });
    const withLogos = fixtures.filter(
      (f: any) =>
        f.teams?.home?.logo?.startsWith('http') || f.league?.logo?.startsWith('http'),
    );
    if (withLogos.length === 0) return questions;

    let logoIdx = 0;
    return questions.map((q) => {
      if (q.imageUrl?.startsWith('http')) return q;
      const type = (q.imageType || '').toLowerCase();
      if (!type && !q.imageLayout) return q;

      const url = pickLogo(withLogos, type || 'team', logoIdx++);
      if (!url) return q;

      return {
        ...q,
        imageUrl: url,
        imageLayout: type === 'venue' || q.imageLayout === 'wide' ? 'wide' : 'square',
      };
    });
  } catch (err) {
    logger.warn('[QuizImages] enrich failed', err);
    return questions;
  }
}
