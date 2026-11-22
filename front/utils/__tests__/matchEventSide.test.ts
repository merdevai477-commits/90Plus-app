import { competitorIdFromLogo, isHomeSideEvent } from '../matchEventSide';

describe('matchEventSide', () => {
  const home = { id: 10, name: 'Egypt', logo: 'https://imagecache.365scores.com/image/upload/v1/Competitors/10' };
  const away = { id: 20, name: 'Senegal', logo: 'https://imagecache.365scores.com/image/upload/v1/Competitors/20' };

  it('matches by team id', () => {
    expect(isHomeSideEvent({ team: { id: 10, name: 'Egypt' } }, home, away)).toBe(true);
    expect(isHomeSideEvent({ team: { id: 20, name: 'Senegal' } }, home, away)).toBe(false);
  });

  it('matches by name when ids disagree (African fixtures)', () => {
    expect(
      isHomeSideEvent({ team: { id: 999, name: 'Egypt National Team' } }, home, away),
    ).toBe(true);
    expect(
      isHomeSideEvent({ team: { id: 888, name: 'Senegal' } }, home, away),
    ).toBe(false);
  });

  it('matches by competitor id embedded in logo', () => {
    expect(
      isHomeSideEvent(
        {
          team: {
            id: 0,
            name: 'EGY',
            logo: 'https://imagecache.365scores.com/image/upload/v1/Competitors/20',
          },
        },
        home,
        away,
      ),
    ).toBe(false);
  });

  it('extracts competitor ids from logos', () => {
    expect(competitorIdFromLogo(home.logo)).toBe(10);
    expect(competitorIdFromLogo('https://media.api-sports.io/football/teams/1.png')).toBeNull();
  });
});
