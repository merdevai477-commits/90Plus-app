import type { MatchesWidgetPayload } from './types';

/** Props safe for ExpoWidgets native bridge (no nulls, integer timestamps). */
export function toNativeWidgetProps(payload: MatchesWidgetPayload): Record<string, unknown> {
  return {
    updatedAt: Math.trunc(payload.updatedAt),
    liveCount: payload.liveCount,
    matches: payload.matches.map((match) => ({
      id: match.id,
      fixtureId: match.fixtureId,
      homeName: match.homeName,
      awayName: match.awayName,
      homeShort: match.homeShort,
      awayShort: match.awayShort,
      homeScore: match.homeScore ?? -1,
      awayScore: match.awayScore ?? -1,
      status: match.status,
      statusLabel: match.statusLabel,
      league: match.league,
      ...(match.kickoff ? { kickoff: match.kickoff } : {}),
    })),
  };
}
