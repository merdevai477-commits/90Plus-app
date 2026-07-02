/**
 * 365Scores player lookup + formatting for Captain AI chat context.
 * Same data source as GET /api/football/cached/365/player/lookup.
 */

import { footballDataCacheService } from './football-data-cache.service';
import type { ThreeSixFivePlayerLookupEntry } from './threeSixFiveScores.service';
import { logger } from '../utils/logger';
import type { MessageLanguage } from '../utils/message-language.util';

export function format365PlayerForChatContext(entry: ThreeSixFivePlayerLookupEntry): string {
  const profile = entry.career?.profile;
  const name = entry.name || profile?.name || 'Unknown';
  const lines: string[] = [`PLAYER (365Scores athleteId=${entry.athleteId}): ${name}`];

  const club = entry.clubName ?? profile?.clubName;
  if (club) lines.push(`Club: ${club}`);
  if (profile?.position) lines.push(`Position: ${profile.position}`);
  if (profile?.nationality) lines.push(`Nationality: ${profile.nationality}`);
  if (profile?.age != null) lines.push(`Age: ${profile.age}`);
  if (profile?.jerseyNumber != null) lines.push(`Jersey: #${profile.jerseyNumber}`);

  const career = entry.career;
  if (career?.currentSeasonHighlights?.length) {
    lines.push('\nCurrent season (365):');
    for (const comp of career.currentSeasonHighlights.slice(0, 5)) {
      lines.push(`  ${comp.competitionName}:`);
      for (const stat of comp.stats.slice(0, 10)) {
        const label = stat.shortName ?? stat.name;
        if (label) lines.push(`    ${label}: ${stat.value}`);
      }
    }
  } else if (career?.seasons?.length) {
    const current = career.seasons[0];
    lines.push(
      `\nLatest season ${current.label}: ${current.goals} goals, ${current.assists} assists, ${current.appearances} apps`,
    );
  }

  if (career?.seasons && career.seasons.length > 1) {
    lines.push('\nRecent seasons:');
    for (const s of career.seasons.slice(0, 5)) {
      lines.push(`  ${s.label}: ${s.goals}G ${s.assists}A in ${s.appearances} apps`);
    }
  }

  if (career?.trophies?.length) {
    lines.push('\nTrophies (365):');
    for (const t of career.trophies.slice(0, 15)) {
      lines.push(`  ${t.displayName ?? t.name}: ${t.count}x`);
    }
  }

  return lines.join('\n');
}

export async function fetch365PlayerChatContext(
  playerName: string,
  language: MessageLanguage = 'en',
): Promise<{ block: string; athleteId: number; displayName: string } | null> {
  try {
    const result = await footballDataCacheService.lookup365Player(playerName, language, {
      limit: 1,
    });
    const player = result.data?.players?.[0];
    if (!player) return null;

    const block = format365PlayerForChatContext(player);
    if (block.length < 24) return null;

    return {
      block: `365SCORES PLAYER DATA (authoritative — use ONLY these numbers):\n${block}`,
      athleteId: player.athleteId,
      displayName: player.name,
    };
  } catch (err) {
    logger.warn('[Chat365] player lookup failed:', err);
    return null;
  }
}
