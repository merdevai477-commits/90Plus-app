import {
  isFollowedCompetitionId,
  toCompetitionId,
} from '../leagueFavorites.storage';
import { SCORES365_LEAGUE_ID_OFFSET } from '../../../constants/worldCup';

describe('leagueFavorites.storage helpers', () => {
  it('normalizes offset league ids to competition ids', () => {
    expect(toCompetitionId(7)).toBe(7);
    expect(toCompetitionId(SCORES365_LEAGUE_ID_OFFSET + 7)).toBe(7);
    expect(toCompetitionId(0)).toBe(0);
  });

  it('matches followed competitions across id forms', () => {
    const favs = [7, 572];
    expect(isFollowedCompetitionId(7, favs)).toBe(true);
    expect(isFollowedCompetitionId(SCORES365_LEAGUE_ID_OFFSET + 7, favs)).toBe(true);
    expect(isFollowedCompetitionId(SCORES365_LEAGUE_ID_OFFSET + 572, favs)).toBe(true);
    expect(isFollowedCompetitionId(11, favs)).toBe(false);
  });
});
