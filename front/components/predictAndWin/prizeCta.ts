/**
 * Prize-card primary CTA kind. Colour and copy follow the prediction lifecycle
 * so the hub does not wait on a second screen to explain what happened.
 */

import { isEntryOpen, type CompetitionInfo } from '../../services/competitions.service';

export type PrizeCtaKind = 'predict' | 'waiting' | 'ended' | 'correct' | 'wrong';

export const PRIZE_CTA_GLASS: Record<
  PrizeCtaKind,
  { tint: readonly [string, string]; text: string }
> = {
  predict: {
    tint: ['rgba(140,40,255,0.48)', 'rgba(61,10,179,0.22)'],
    text: '#FFFFFF',
  },
  waiting: {
    tint: ['rgba(255,255,0,0.28)', 'rgba(180,180,0,0.12)'],
    text: '#FFF4A3',
  },
  ended: {
    tint: ['rgba(160,160,160,0.28)', 'rgba(70,70,70,0.16)'],
    text: '#C8C8C8',
  },
  correct: {
    tint: ['rgba(0,220,80,0.28)', 'rgba(0,120,40,0.12)'],
    text: '#7CFF9A',
  },
  wrong: {
    tint: ['rgba(255,70,70,0.30)', 'rgba(160,0,0,0.14)'],
    text: '#FF8A8A',
  },
};

export function prizeCtaKind(competition: CompetitionInfo): PrizeCtaKind {
  const entry = competition.myEntry;
  if (entry && (entry.isCorrect === true || entry.isWinner)) return 'correct';
  if (entry && entry.isCorrect === false) return 'wrong';
  // Wizard preview is DRAFT — still show the invite, not "ended".
  if (competition.status === 'DRAFT' || competition.status === 'REJECTED') return 'predict';
  if (entry && (competition.status === 'PUBLISHED' || competition.status === 'LOCKED')) {
    return 'waiting';
  }
  if (!isEntryOpen(competition)) return 'ended';
  return 'predict';
}

export function hasSponsorSocialLinks(
  links: CompetitionInfo['sponsor']['socialLinks'],
): boolean {
  if (!links) return false;
  return [links.facebook, links.instagram, links.whatsapp].some(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );
}
