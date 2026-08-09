/**
 * Synthetic leagueId for 365Scores competitionId.
 * Kept separate from scores365-experiment.service to avoid heavy imports in export/util paths.
 */

export const SCORES365_LEAGUE_ID_OFFSET = 7_000_000;

export function scores365CompetitionToLeagueId(competitionId: number): number {
  return SCORES365_LEAGUE_ID_OFFSET + competitionId;
}
